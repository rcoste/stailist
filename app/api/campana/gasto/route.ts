import { NextResponse, type NextRequest } from "next/server";
import { filasValidas, secretoValido } from "@/lib/admin/gasto-ads";
import { NOTA_GOOGLE, guardarGasto } from "@/lib/admin/gasto-guardar";

// RECIBE EL GASTO DE GOOGLE ADS que manda el script de la cuenta (ver
// lib/admin/gasto-ads.ts y docs/google-ads-script-gasto.js). Protegido por
// GASTO_ADS_SECRET en el encabezado x-stailist-secreto, como los crons por
// CRON_SECRET. Escribe en campana_gasto con guardarGasto (lib/admin/gasto-guardar.ts).
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!secretoValido(request.headers.get("x-stailist-secreto"), process.env.GASTO_ADS_SECRET)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const guardadas = await guardarGasto(filasValidas(body), NOTA_GOOGLE);
  return NextResponse.json({ ok: true, guardadas });
}
