import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { invitarViajeEmail } from "@/lib/email-template";
import { leTocaCorreoInvitar } from "@/lib/correo-invitar-viaje";
import { diaEnZona } from "@/lib/admin/adquisicion";
import { nombreDeViaje, type Parada } from "@/lib/trip";

// Cron del CORREO "¿CON QUIÉN VAS?" (2026-10-16; Vercel lo dispara a diario a
// las 16:00 UTC = 10 am de CDMX, lejos del reenganche de las 7 pm para que
// nadie reciba dos correos juntos). Un día después de armar un viaje que
// todavía no empieza, le recuerda a la persona que puede invitar a quien viaja
// con ella. Una vez por viaje (trips.correo_invitar_enviado_at, migración 0177).
//
// Mismo contrato que el reenganche: CRON_SECRET, y `?ensayo=1` calcula a quién
// le toca y con qué asunto SIN mandar ni escribir nada — mandar correos es
// irreversible y la lista se revisa antes, no después.
export const maxDuration = 60;

type Fila = {
  trip_id: string;
  lugar: string;
  paradas: Parada[] | null;
  fecha_inicio: string;
  fecha_fin: string;
  created_at: string;
  invitacion: string | null;
  invitado_de: string | null;
  email: string;
  email_unsub_token: string;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dm = (d: string) => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const ensayo = request.nextUrl.searchParams.get("ensayo") === "1";
  const ahora = new Date();
  const hoy = diaEnZona(ahora);

  return await withDb(async (c) => {
    // Conjunto (barato en SQL): viajes vivos sin correo todavía, de personas
    // con los correos prendidos, sin borrado programado y que no son cuentas
    // de prueba. Las reglas de tiempo y de sentido van en leTocaCorreoInvitar.
    const { rows } = await c.query<Fila>(
      `select t.id as trip_id, t.lugar, t.paradas, t.fecha_inicio::text, t.fecha_fin::text, t.created_at::text,
              t.invitacion, t.invitado_de, p.email, p.email_unsub_token
         from trips t
         join profiles p on p.id = t.user_id
        where t.deleted_at is null
          and t.correo_invitar_enviado_at is null
          and t.fecha_inicio > $1::date
          and p.email is not null
          and p.email not like '%@stailist.app'
          and p.email_semanal = 'semanal'
          and p.borrado_programado_para is null`,
      [hoy]
    );

    const enviados: { email: string; destino: string; asunto: string }[] = [];
    const saltados: { email: string; motivo: string }[] = [];
    const fallidos: { email: string; error: string }[] = [];

    for (const f of rows) {
      const v = leTocaCorreoInvitar(
        {
          creadoEn: f.created_at,
          fechaInicio: f.fecha_inicio,
          yaTieneLink: Boolean(f.invitacion),
          vinoInvitado: Boolean(f.invitado_de),
        },
        ahora,
        hoy
      );
      if (!v.toca) {
        saltados.push({ email: f.email, motivo: v.motivo });
        continue;
      }
      const destino = nombreDeViaje(f.lugar, Array.isArray(f.paradas) ? f.paradas : null);
      const { subject, html, text } = invitarViajeEmail({
        unsubToken: f.email_unsub_token,
        destino,
        tripId: f.trip_id,
        fechas: `${dm(f.fecha_inicio)} – ${dm(f.fecha_fin)}`,
      });
      if (ensayo) {
        enviados.push({ email: f.email, destino, asunto: subject });
        continue;
      }
      const res = await sendEmail({ to: f.email, subject, html, text, stream: "broadcast" });
      if (!res.ok) {
        console.error(`[invitar-viaje] Postmark rechazó el envío a ${f.email}:`, res.error);
        fallidos.push({ email: f.email, error: res.error });
        continue;
      }
      // Después del envío exitoso, como en el reenganche: preferimos el riesgo
      // de un segundo correo al de marcar sin haber escrito.
      try {
        await c.query(`update trips set correo_invitar_enviado_at = now() where id = $1`, [f.trip_id]);
      } catch (e) {
        console.error(`[invitar-viaje] ¡ojo! le escribí a ${f.email} pero no pude marcar el viaje:`, e instanceof Error ? e.message : e);
      }
      enviados.push({ email: f.email, destino, asunto: subject });
    }

    return NextResponse.json({ ok: true, ensayo, revisados: rows.length, enviados, fallidos, saltados });
  });
}
