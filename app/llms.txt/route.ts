import { textoLlms } from "@/lib/ficha-publica";

// /llms.txt: un resumen en texto plano de qué es stailist, para asistentes de IA
// que leen sitios (formato propuesto en llmstxt.org). No hay evidencia de que
// los grandes asistentes lo lean hoy; se sirve porque cuesta nada y sale de la
// misma ficha que el JSON-LD de la landing (lib/ficha-publica.ts). Público en
// proxy.ts.
export const dynamic = "force-static";

export function GET() {
  return new Response(textoLlms(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
