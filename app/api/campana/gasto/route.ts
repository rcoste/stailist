import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { filasValidas, secretoValido } from "@/lib/admin/gasto-ads";

// RECIBE EL GASTO DE GOOGLE ADS que manda el script de la cuenta (ver
// lib/admin/gasto-ads.ts y docs/google-ads-script-gasto.js). Protegido por
// GASTO_ADS_SECRET en el encabezado x-stailist-secreto, como los crons por
// CRON_SECRET. Escribe en campana_gasto, la misma tabla que la captura a mano:
// lo de Google manda y pisa lo capturado del mismo día y campaña.
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
  const filas = filasValidas(body);
  if (filas.length === 0) return NextResponse.json({ ok: true, guardadas: 0 });

  await withDb((c) =>
    c.query(
      `insert into public.campana_gasto (dia, campana, impresiones, clics, costo_mxn, registros_google, nota, actualizado)
       select x.dia, x.campana, x.impresiones, x.clics, x.costo_mxn, x.registros,
              'automático: script de Google Ads', now()
       from jsonb_to_recordset($1::jsonb) as x(dia date, campana text, impresiones int, clics int, costo_mxn numeric, registros int)
       on conflict (dia, campana) do update set
         impresiones = excluded.impresiones, clics = excluded.clics, costo_mxn = excluded.costo_mxn,
         registros_google = excluded.registros_google, nota = excluded.nota, actualizado = now()`,
      [JSON.stringify(filas)]
    )
  );
  return NextResponse.json({ ok: true, guardadas: filas.length });
}
