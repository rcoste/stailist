import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { correoDeAlarmas, decidirAlarmas } from "@/lib/vigilancia";
import { TOPE_USD_DIA_GLOBAL } from "@/lib/cuotas";

// LA VIGILANCIA DE LA IA. Corre cada hora (ver vercel.json).
//
// Es la mitad que faltaba del blindaje: las cuotas impiden que UNA persona
// gaste de más, pero nada avisaba si el gasto se desbocaba entre todos, ni si
// la IA empezaba a fallarle a TODO el mundo. Las dos cosas eran invisibles
// hasta que alguien entrara a /admin/ia por su cuenta.
//
// El correo va a ADMIN_EMAIL, no a una lista: es una alarma operativa.
//
// Protegido por CRON_SECRET, igual que los otros dos crons: Vercel manda
// `Authorization: Bearer <CRON_SECRET>`.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  // Una sola consulta para las tres cifras. Va por `withDb` (Postgres directo)
  // y no por el cliente con sesión a propósito: esto mira el gasto de TODA la
  // app, que ninguna sesión de usuario puede ver por RLS.
  const m = await withDb((c) =>
    c
      .query<{ fallos: string; llamadas: string; gasto: string }>(
        `select
           count(*) filter (where not ok and created_at >= now() - interval '1 hour') as fallos,
           count(*) filter (where created_at >= now() - interval '1 hour') as llamadas,
           coalesce(sum(costo_usd) filter (where created_at >= now() - interval '24 hours'), 0) as gasto
         from ai_calls
         where created_at >= now() - interval '24 hours'`
      )
      .then((r) => r.rows[0])
  );

  const alarmas = decidirAlarmas({
    fallosUltimaHora: Number(m?.fallos ?? 0),
    llamadasUltimaHora: Number(m?.llamadas ?? 0),
    gastoUltimasHoras: Number(m?.gasto ?? 0),
    topeGasto: TOPE_USD_DIA_GLOBAL,
  });

  // Sin nada que decir, no se manda nada. Un "todo bien" cada hora se aprende a
  // ignorar, y entonces el que sí importa tampoco se lee.
  if (alarmas.length === 0) {
    return NextResponse.json({ ok: true, alarmas: 0 });
  }

  const destino = process.env.ADMIN_EMAIL;
  if (!destino) {
    // Sin destinatario configurado el aviso no se pierde del todo: queda en los
    // logs de Vercel, que es donde alguien va a buscar cuando algo falle.
    console.error("[vigilancia] hay alarmas y no hay ADMIN_EMAIL:", alarmas);
    return NextResponse.json({ ok: false, error: "sin_admin_email", alarmas: alarmas.length });
  }

  const { subject, text } = correoDeAlarmas(alarmas);
  const enviado = await sendEmail({ to: destino, subject, text, html: `<pre>${text}</pre>` });

  return NextResponse.json({
    ok: enviado.ok,
    alarmas: alarmas.map((a) => a.clave),
  });
}
