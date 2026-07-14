import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { weeklyEmail } from "@/lib/email-template";

// Cron del correo semanal (Vercel lo dispara los lunes — ver vercel.json).
// Manda a los opted-in ('semanal') que no hayan recibido en los últimos 6 días.
// Protegido por CRON_SECRET: Vercel manda `Authorization: Bearer <CRON_SECRET>`.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  // Candidatos: opt-in 'semanal' que no recibieron en los últimos 6 días
  // (idempotencia semanal: si el cron corre dos veces o se reintenta, nadie
  // recibe doble).
  const users = await withDb((c) =>
    c
      .query<{ id: string; email: string; email_unsub_token: string }>(
        `select id, email, email_unsub_token
         from profiles
         where email_semanal = 'semanal'
           and (email_semanal_last_sent is null
                or email_semanal_last_sent < now() - interval '6 days')`
      )
      .then((r) => r.rows)
  );

  let enviados = 0;
  let fallidos = 0;
  for (const u of users) {
    const { subject, html, text } = weeklyEmail({ unsubToken: u.email_unsub_token });
    const res = await sendEmail({ to: u.email, subject, html, text, stream: "broadcast" });
    if (res.ok) {
      enviados++;
      await withDb((c) =>
        c.query(`update profiles set email_semanal_last_sent = now() where id = $1`, [u.id])
      );
    } else {
      fallidos++;
    }
  }

  return NextResponse.json({ ok: true, candidatos: users.length, enviados, fallidos });
}
