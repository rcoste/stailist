import { NextResponse } from "next/server";

// PRUEBA T1 DE LA VITRINA DE UNIQLO (2026-10-20) — TEMPORAL, SE BORRA ANTES DEL MERGE.
//
// La API interna de Uniqlo respondió a peticiones simples desde la Mac de
// Roberto (IP residencial), pero las páginas HTML de uniqlo.com dan 403 a
// curl, y nunca se probó desde una IP de datacenter como la de Vercel. Esta
// ruta pega a los tres mercados desde un deploy de preview y reporta status y
// total. Si da 403 o un cascarón, el camino se cancela antes de escribir la
// card (docs/designs/vitrina-de-tienda.md, revisión de ingeniería, T1).
//
// Sin caché a propósito (`cache: "no-store"`): queremos ver la respuesta real.

export const dynamic = "force-dynamic";

const MERCADOS = [
  ["us", "en"],
  ["jp", "ja"],
  ["kr", "ko"],
] as const;

export async function GET() {
  const resultados = await Promise.all(
    MERCADOS.map(async ([mercado, idioma]) => {
      const url = `https://www.uniqlo.com/${mercado}/api/commerce/v5/${idioma}/products?q=jeans&offset=0&limit=3&httpFailure=true`;
      const inicio = Date.now();
      try {
        const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const texto = await res.text();
        let status: string | null = null;
        let total: number | null = null;
        try {
          const json = JSON.parse(texto) as {
            status?: string;
            result?: { pagination?: { total?: number } };
          };
          status = json.status ?? null;
          total = json.result?.pagination?.total ?? null;
        } catch {
          // no era JSON: cascarón de bloqueo o HTML
        }
        return {
          mercado,
          http: res.status,
          status,
          total,
          bytes: texto.length,
          ms: Date.now() - inicio,
          firma: /bm-verify|Access Denied|Challenge/i.test(texto) ? "bloqueo" : null,
          muestra: status ? null : texto.slice(0, 200),
        };
      } catch (e) {
        return { mercado, http: null, status: null, total: null, bytes: 0, ms: Date.now() - inicio, firma: "error", muestra: String(e).slice(0, 200) };
      }
    })
  );
  return NextResponse.json({ desde: "vercel", cuando: new Date().toISOString(), resultados });
}
