import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import {
  fechaLocal,
  leTocaAviso,
  MAX_TELEFONOS,
  pushActivo,
  textoDelAviso,
  ZONA_HORARIA,
} from "@/lib/avisos-push";
import { enviarAviso, vapidListo } from "@/lib/push-envio";

// Cron de los AVISOS PUSH (Vercel lo dispara a diario a las 13:00 UTC = 7:00
// de CDMX — ver vercel.json). "Tu look de hoy te espera", a cada teléfono
// que dijo que sí.
//
// APAGADO SIN SU SWITCH: sin NEXT_PUBLIC_AVISOS_PUSH=1 y las llaves VAPID
// responde {apagado:true} y no toca nada.
//
// A QUIÉN: suscripciones vivas (revoked_at null) de cuentas que no apagaron
// los avisos ni programaron su borrado. Las reglas de TIEMPO —ya recibió hoy,
// ya generó su look, está usando la app ahora, lleva siete avisos sin volver—
// viven en lib/avisos-push.ts, probadas una por una. Aquí sólo se consulta y
// se aplica.
//
// MODO ENSAYO: `?ensayo=1` calcula a quién le toca y con qué texto, y NO manda
// nada ni escribe. Mandar es una acción hacia afuera: la lista se revisa
// antes, no después. Es también la forma de auditar el criterio sin esperar.
//
// Protegido por CRON_SECRET igual que los demás crons.
export const maxDuration = 60;

type Fila = {
  sub_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_sent_at: string | null;
  fallos: number;
  ultima_actividad: string | null;
  envios_sin_actividad: string;
  looks_hoy: string;
  titulo_hoy: string | null;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  if (!pushActivo() || !vapidListo()) {
    return NextResponse.json({ apagado: true });
  }

  const ensayo = request.nextUrl.searchParams.get("ensayo") === "1";
  const ahora = new Date();
  const hoy = fechaLocal(ahora);

  return await withDb(async (c) => {
    const { rows } = await c.query<Fila>(
      `select s.id as sub_id, s.user_id, s.endpoint, s.p256dh, s.auth, s.last_sent_at, s.fallos,
              a.ultima_actividad,
              (select count(*) from events e
                where e.user_id = p.id and e.type = 'push_enviado'
                  and (a.ultima_actividad is null or e.created_at > a.ultima_actividad)) as envios_sin_actividad,
              (select count(*) from outfits o
                where o.user_id = p.id and o.deleted_at is null
                  and (o.created_at at time zone $2)::date = $1::date) as looks_hoy,
              (select o.title from outfits o
                where o.user_id = p.id and o.deleted_at is null
                  and (o.gen_status is null or o.gen_status = 'ready')
                  and ((o.is_look_of_day and o.look_date = $1::date) or o.planned_for = $1::date)
                order by o.created_at desc limit 1) as titulo_hoy
         from (
           -- Sólo los MAX_TELEFONOS más recientes de cada persona, ANTES de las
           -- subconsultas de abajo: con cien mil filas de una sola cuenta el
           -- cron se pasaría del minuto y nadie recibiría su aviso.
           select x.* from (
             select t.*, row_number() over (partition by t.user_id order by t.created_at desc) as n
               from push_subscriptions t
              where t.revoked_at is null
           ) x where x.n <= $3
         ) s
         join profiles p on p.id = s.user_id
         cross join lateral (
           -- La última huella de uso, SIN contar nuestros propios avisos (si
           -- contaran, nadie llegaría nunca a "siete sin respuesta").
           select greatest(
             (select max(created_at) from events  e where e.user_id = p.id and e.type <> 'push_enviado'),
             (select max(created_at) from outfits o where o.user_id = p.id),
             (select max(created_at) from items   i where i.user_id = p.id)
           ) as ultima_actividad
         ) a
        where s.revoked_at is null
          and p.avisos_push is distinct from 'off'
          and p.borrado_programado_para is null
        order by s.user_id, s.created_at`,
      [hoy, ZONA_HORARIA, MAX_TELEFONOS]
    );

    // Un texto por persona; se manda a cada uno de sus teléfonos.
    const porPersona = new Map<string, Fila[]>();
    for (const f of rows) porPersona.set(f.user_id, [...(porPersona.get(f.user_id) ?? []), f]);

    const enviados: { user_id: string; dispositivos: number; con_titulo: boolean; titulo: string }[] = [];
    const saltados: { user_id: string; motivo: string }[] = [];
    const fallidos: { user_id: string; error: string }[] = [];
    let muertas = 0;

    for (const [userId, todas] of porPersona) {
      // Los más recientes (la consulta ordena por created_at): si alguien
      // tuviera cien filas, las viejas no se comen el minuto del cron.
      const subs = todas.slice(-MAX_TELEFONOS);
      const persona = subs[0];
      const aviso = textoDelAviso({ tituloHoy: persona.titulo_hoy, hoy });
      let dispositivos = 0;

      for (const s of subs) {
        const v = leTocaAviso(
          {
            ultimoEnvio: s.last_sent_at,
            ultimaActividad: s.ultima_actividad,
            enviosSinActividad: Number(s.envios_sin_actividad),
            fallos: s.fallos,
            looksHoy: Number(s.looks_hoy),
          },
          ahora,
          hoy
        );
        if (!v.toca) {
          saltados.push({ user_id: userId, motivo: v.motivo });
          continue;
        }
        if (ensayo) {
          dispositivos++;
          continue;
        }
        const r = await enviarAviso({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, aviso);
        if (r.ok) {
          dispositivos++;
          await c.query(`update push_subscriptions set last_sent_at = now(), fallos = 0 where id = $1`, [s.sub_id]);
        } else if (r.muerta) {
          // Quitó el permiso, borró la app o la dirección no era de un servicio
          // de avisos: la fila se BORRA (no se marca). /privacidad dice que al
          // apagarlo borramos la dirección, y apagarlo desde los ajustes del
          // teléfono también es apagarlo.
          muertas++;
          await c.query(`delete from push_subscriptions where id = $1`, [s.sub_id]);
        } else {
          fallidos.push({ user_id: userId, error: r.error });
          // Sólo cuenta contra la suscripción lo que es culpa de la suscripción
          // (lib/push-envio.ts): llaves nuestras mal puestas o una caída del
          // servicio no deben darla por rota.
          if (r.culpaDeLaSuscripcion) {
            await c.query(`update push_subscriptions set fallos = fallos + 1 where id = $1`, [s.sub_id]);
          }
        }
      }

      if (dispositivos > 0) {
        enviados.push({ user_id: userId, dispositivos, con_titulo: !!persona.titulo_hoy, titulo: aviso.titulo });
        if (!ensayo) {
          // Una huella por persona y día, no por teléfono: es lo que se lee
          // contra push_abierto para la tasa de apertura.
          try {
            await c.query(`insert into events (user_id, type, data) values ($1, 'push_enviado', $2::jsonb)`, [
              userId,
              JSON.stringify({ dispositivos, con_titulo: !!persona.titulo_hoy }),
            ]);
          } catch (e) {
            console.error("[push] no se anotó push_enviado:", e instanceof Error ? e.message : e);
          }
        }
      }
    }

    // Los fallos tienen que VERSE: antes sólo viajaban en esta respuesta, que
    // nadie lee. Van al log de Vercel y a /admin/errores (uno por persona).
    if (fallidos.length > 0) {
      console.error(`[push] ${fallidos.length} envíos fallaron:`, fallidos.slice(0, 5).map((f) => f.error).join(" | "));
      for (const f of fallidos.slice(0, 20)) {
        try {
          await c.query(
            `insert into errores (user_id, origen, clave, pantalla, tecnico, version)
             values ($1, 'servidor', 'push:envio', '/api/cron/avisos', $2, $3)`,
            [f.user_id, f.error.slice(0, 500), process.env.NEXT_PUBLIC_APP_VERSION ?? null]
          );
        } catch (e) {
          console.error("[push] no se anotó el fallo:", e instanceof Error ? e.message : e);
        }
      }
    }

    return NextResponse.json({
      ensayo,
      hoy,
      suscripciones: rows.length,
      personas: porPersona.size,
      enviados,
      saltados,
      fallidos,
      muertas,
    });
  });
}
