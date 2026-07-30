import type { RenderArgs } from "@/components/ideal-tile";

// Precalienta las imágenes de las prendas SUGERIDAS de la cápsula.
//
// El problema (feedback de Alberto, 2026-07-30): "me dio la lista de cosas en mi
// cápsula pero la mayoría salía sin imagen… se ve medio mal todo vacío". Las
// imágenes de prendas ideales se generan bajo demanda (tocas el tile → se
// genera), así que una cápsula recién armada es una pared de recuadros grises.
// Es la PRIMERA vez que ve su cápsula: el peor momento para verse rota.
//
// Por qué en el cliente y no al generar la cápsula: armar la cápsula ya consume
// ~40s de los 60s que da Vercel por función. Sumarle 8 generaciones de imagen
// ahí mataría la función y la persona perdería la cápsula entera — que es
// exactamente el error que Alberto vio después del quiz.
//
// El costo es real (cada render es una llamada a un modelo de imagen), así que:
//  · TOPE de piezas por visita — las que se ven como card grande, no las 33;
//  · concurrencia de 2, para no saturar ni la red ni el rate limit;
//  · el resultado se registra en la biblioteca COMPARTIDA (catalog_renders), así
//    que el segundo usuario con ese mismo combo ya no paga nada. El chino azul
//    marino de Alberto es el mismo chino azul marino de Toño.
export const PREWARM_TOPE = 8;
const CONCURRENCIA = 2;

export type PrewarmJob = { key: string; args: RenderArgs };

/**
 * Genera en segundo plano las imágenes que faltan y va reportando cada una en
 * cuanto está lista (`onReady`), para que los tiles se enciendan de a poco en
 * vez de todos al final.
 *
 * `signal` corta la fila si la persona se va de la pantalla: sin eso, salir de
 * la cápsula seguiría pagando renders que nadie va a ver.
 */
export async function prewarmRenders(
  jobs: PrewarmJob[],
  onReady: (key: string, url: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const cola = jobs.slice(0, PREWARM_TOPE);
  let i = 0;

  async function worker() {
    while (i < cola.length) {
      if (signal?.aborted) return;
      const job = cola[i++];
      try {
        const res = await fetch("/api/render-ideal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(job.args),
          signal,
        });
        const j = (await res.json().catch(() => null)) as { url?: string } | null;
        if (j?.url && !signal?.aborted) onReady(job.key, j.url);
      } catch {
        // Silencioso a propósito: esto es una mejora de fondo. Si falla, el tile
        // se queda con su "ver la prenda" de siempre y la persona puede pedirla
        // a mano — nunca un error en pantalla por algo que ella no pidió.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCIA, cola.length) }, worker)
  );
}
