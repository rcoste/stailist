import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { correoDiario } from "@/lib/admin/campana";
import { datosCorreoDiario } from "@/lib/admin/campana-datos";
import { correoDiarioHtml } from "@/lib/admin/campana-correo";
import { actualizarGastoMeta, avisoGastoMeta } from "@/lib/admin/gasto-guardar";

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

  // Primero el gasto de Meta, para que el correo ya lo traiga (el de Google
  // llega solo a las 6 am con su script). Si falla, el correo sale igual y lo dice.
  const meta = await actualizarGastoMeta();
  const aviso = avisoGastoMeta(meta);
  const datos = { ...(await datosCorreoDiario()), ...(aviso ? { avisos: [aviso] } : {}) };
  const { subject, text } = correoDiario(datos);

  const destino = process.env.ADMIN_EMAIL;
  if (!destino) {
    console.error("[campana] no hay ADMIN_EMAIL; el resumen del día queda sólo aquí:\n" + text);
    return NextResponse.json({ ok: false, error: "sin_admin_email" });
  }

  // El HTML con formato (lib/admin/campana-correo.ts) y el texto como
  // alternativa del mismo correo: los dos dicen lo mismo.
  const enviado = await sendEmail({ to: destino, subject, text, html: correoDiarioHtml(datos) });
  return NextResponse.json({ ok: enviado.ok });
}
