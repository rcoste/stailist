import { NextResponse, type NextRequest } from "next/server";
import { actualizarGastoMeta } from "@/lib/admin/gasto-guardar";

// TRAE EL GASTO DE META A MANO, sin mandar el correo. Lo normal es que corra
// solo dentro de /api/cron/campana (8 am); esta puerta existe para probar el
// token recién puesto o volver a jalar después de una falla. Sin horario en
// vercel.json a propósito. Protegido por CRON_SECRET, como los demás crons.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const r = await actualizarGastoMeta();
  return NextResponse.json(r, { status: r.estado === "error" ? 502 : 200 });
}
