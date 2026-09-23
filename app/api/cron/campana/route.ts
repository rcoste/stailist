import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { correoDiario } from "@/lib/admin/campana";
import { datosCorreoDiario } from "@/lib/admin/campana-datos";

// EL CORREO DIARIO: cuánto costó ayer, quién llegó y cómo va el criterio de
// paro de la campaña. Corre a las 14:00 UTC = 8:00 de la Ciudad de México (ver
// vercel.json).
//
// A diferencia de /api/cron/vigilancia, éste SÍ se manda aunque todo esté
// bien: vigilancia es una alarma (callada salvo incendio) y esto es el pulso
// que se lee con el café. Uno al día, no cada hora. Lo que no llega al correo
// no se mira (el TTV estuvo meses fallando en un panel que nadie abría).
//
// Mismos números que /admin/campana: los dos llaman lib/admin/campana-datos.ts.
// Protegido por CRON_SECRET, como los demás crons.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const { subject, text } = correoDiario(await datosCorreoDiario());

  const destino = process.env.ADMIN_EMAIL;
  if (!destino) {
    console.error("[campana] no hay ADMIN_EMAIL; el resumen del día queda sólo aquí:\n" + text);
    return NextResponse.json({ ok: false, error: "sin_admin_email" });
  }

  const enviado = await sendEmail({ to: destino, subject, text, html: `<pre>${escapar(text)}</pre>` });
  return NextResponse.json({ ok: enviado.ok });
}

/** El texto trae correos y nombres de campaña: nada de eso se interpreta como HTML. */
function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
