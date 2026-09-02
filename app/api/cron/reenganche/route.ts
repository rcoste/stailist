import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { reengagementEmail } from "@/lib/email-template";
import { elegirGancho, leToca, type LookParaGancho } from "@/lib/reenganche";

// Cron del REENGANCHE DE 48 HORAS (Vercel lo dispara a diario — ver vercel.json).
//
// POR QUÉ DIARIO Y NO SEMANAL: una ventana de 48h no se pilla corriendo una vez
// por semana, y ése es exactamente el bug que este correo arregla. A Andy —que
// se dio de alta el lunes 10, después del envío semanal, y se fue el 12— su
// primer correo le habría llegado el 17: cinco días tarde. La gente se apaga a
// los 2-3 días.
//
// LA HORA (01:00 UTC = 7:00 pm de CDMX del día anterior) tampoco es al azar: es
// cuando uno piensa "¿qué me pongo mañana?", no a las 8am cuando ya se está
// vistiendo y llegar tarde da igual.
//
// Protegido por CRON_SECRET igual que el semanal: Vercel manda
// `Authorization: Bearer <CRON_SECRET>`.
//
// MODO ENSAYO: `?ensayo=1` calcula TODO —a quién le toca, con qué gancho, con
// qué asunto— y NO manda nada ni escribe en la base. Existe porque mandar
// correos es una acción hacia afuera e irreversible: la lista se revisa antes,
// no después. Es también la forma de auditar el criterio sin esperar al cron.
export const maxDuration = 60;

/** Cuántos looks recientes se miran para elegir el gancho. Con 10 sobra: si en
 *  sus últimos 10 no hay ninguno con 👍, el gancho del 👍 no era el suyo. */
const LOOKS_A_REVISAR = 10;

type FilaCandidata = {
  id: string;
  email: string;
  email_unsub_token: string;
  email_semanal_last_sent: string | null;
  ultima_actividad: string;
  looks: string;
  prendas: string;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const ensayo = request.nextUrl.searchParams.get("ensayo") === "1";
  const ahora = new Date();

  return await withDb(async (c) => {
    // Los filtros de CONJUNTO van aquí (baratos en SQL, sin matices): opt-in,
    // onboarding terminado y no haberlo recibido nunca. Las reglas de TIEMPO
    // —que son las que se discuten y se rompen— viven en lib/reenganche.ts,
    // probadas una por una.
    //
    // "Última actividad" es el máximo de las cinco huellas que deja usar la
    // app. Ninguna sola cuenta la historia: alguien puede pasar un día
    // agregando ropa sin generar un solo look, y estuvo aquí. Los borrados NO
    // se filtran a propósito — borrar una prenda también es haber entrado.
    const { rows } = await c.query<FilaCandidata>(
      `select p.id, p.email, p.email_unsub_token, p.email_semanal_last_sent,
              greatest(
                coalesce((select max(created_at) from events  e where e.user_id = p.id), p.created_at),
                coalesce((select max(created_at) from outfits o where o.user_id = p.id), p.created_at),
                coalesce((select max(created_at) from items   i where i.user_id = p.id), p.created_at),
                coalesce((select max(created_at) from trips   t where t.user_id = p.id), p.created_at),
                p.created_at
              ) as ultima_actividad,
              (select count(*) from outfits o where o.user_id = p.id and o.deleted_at is null) as looks,
              (select count(*) from items   i where i.user_id = p.id and i.deleted_at is null) as prendas
         from profiles p
        where p.email_semanal = 'semanal'
          and p.onboarding_step >= 5
          and p.email_reenganche_sent_at is null`
    );

    const enviados: { email: string; gancho: string; asunto: string }[] = [];
    const saltados: { email: string; motivo: string }[] = [];
    const fallidos: { email: string; error: string }[] = [];

    for (const fila of rows) {
      const veredicto = leToca(
        {
          email: fila.email,
          ultimaActividad: fila.ultima_actividad,
          looks: Number(fila.looks),
          semanalUltimoEnvio: fila.email_semanal_last_sent,
        },
        ahora
      );
      if (!veredicto.toca) {
        saltados.push({ email: fila.email, motivo: veredicto.motivo });
        continue;
      }

      // Sus últimos looks con el voto que les dio. `gen_status` puede ser NULL
      // en los looks viejos (la columna nació después): null vale por 'ready',
      // igual que en /hoy. Filtrar por = 'ready' a secas escondería 148 looks
      // de la base, entre ellos los de Andy.
      let looks: LookParaGancho[] = [];
      try {
        const r = await c.query<{
          title: string | null;
          item_ids: string[];
          created_at: string;
          voto: string | null;
        }>(
          `select o.title, o.item_ids, o.created_at,
                  (select e.type from events e
                    where e.outfit_id = o.id and e.user_id = $1
                      and e.type in ('vote_up','vote_down') limit 1) as voto
             from outfits o
            where o.user_id = $1
              and o.deleted_at is null
              and (o.gen_status is null or o.gen_status = 'ready')
            order by o.created_at desc
            limit ${LOOKS_A_REVISAR}`,
          [fila.id]
        );

        // Nombres de las prendas de esos looks, en una sola consulta. El
        // arquetipo gana sobre el nombre escrito, igual que en /hoy.
        const ids = Array.from(new Set(r.rows.flatMap((o) => o.item_ids ?? [])));
        const nombres = new Map<string, string>();
        if (ids.length > 0) {
          const n = await c.query<{ id: string; nombre: string | null }>(
            // Sin borradas: el correo nombraba prendas que la persona ya sacó
            // de su clóset ("tu chamarra de mezclilla" cuando ya no la tiene).
            `select i.id, coalesce(a.name, i.attrs->>'nombre') as nombre
               from items i left join archetypes a on a.id = i.archetype_id
              where i.id = any($1::uuid[]) and i.deleted_at is null`,
            [ids]
          );
          for (const it of n.rows) if (it.nombre) nombres.set(it.id, it.nombre);
        }

        looks = r.rows.map((o) => ({
          titulo: o.title,
          prendas: (o.item_ids ?? []).map((id) => nombres.get(id) ?? "").filter(Boolean),
          voto: o.voto === "vote_up" ? "up" : o.voto === "vote_down" ? "down" : null,
          creadoEn: new Date(o.created_at).toISOString(),
        }));
      } catch (e) {
        // NUNCA en silencio: dos bugs vivieron semanas este mes por un error de
        // consulta que nadie logueó. Si no puedo leer sus looks, no le mando un
        // correo a medias — lo reporto y sigo con la siguiente persona.
        const error = e instanceof Error ? e.message : "consulta de looks falló";
        console.error(`[reenganche] no pude leer los looks de ${fila.email}:`, error);
        fallidos.push({ email: fila.email, error });
        continue;
      }

      const gancho = elegirGancho({ looks, prendas: Number(fila.prendas), ahora });
      const { subject, html, text } = reengagementEmail({
        unsubToken: fila.email_unsub_token,
        gancho,
      });

      if (ensayo) {
        enviados.push({ email: fila.email, gancho: gancho.tipo, asunto: subject });
        continue;
      }

      const res = await sendEmail({
        to: fila.email,
        subject,
        html,
        text,
        // Broadcast, no transaccional: comparte reputación y unsubscribes con
        // el semanal, y los mantiene lejos del magic link.
        stream: "broadcast",
      });
      if (!res.ok) {
        console.error(`[reenganche] Postmark rechazó el envío a ${fila.email}:`, res.error);
        fallidos.push({ email: fila.email, error: res.error });
        continue;
      }

      // Se marca DESPUÉS del envío exitoso: si esto fallara, la persona
      // recibiría un segundo correo mañana. Preferimos ese riesgo al inverso
      // (marcarla sin haberle escrito nunca, y perderla en silencio).
      try {
        await c.query(
          `update profiles set email_reenganche_sent_at = now() where id = $1`,
          [fila.id]
        );
      } catch (e) {
        console.error(
          `[reenganche] ¡ojo! le escribí a ${fila.email} pero no pude marcarlo:`,
          e instanceof Error ? e.message : e
        );
      }
      enviados.push({ email: fila.email, gancho: gancho.tipo, asunto: subject });
    }

    return NextResponse.json({
      ok: true,
      ensayo,
      revisados: rows.length,
      enviados,
      fallidos,
      saltados,
    });
  });
}
