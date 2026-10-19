// LA SEGUNDA PASADA: el juez encontró algo, la stylist lo corrige (2026-10-18).
//
// Los jueces de la cápsula y de la maleta (capsule-revision.ts, trip-revision.ts)
// eran de sólo anotar: el hueco quedaba escrito y nadie lo llenaba. Roberto:
// "que corrija, no solo anote". Es el mismo patrón del reparador del motor de
// looks: sólo cuesta cuando algo falla, y sólo toca lo que el juez señaló.
//
// La pasada recibe las MISMAS instrucciones de stylist que armaron la lista
// (paleta, cuerpo, clima, vetos) más la lista y los hallazgos, y devuelve
// sólo cambios: qué quitar y qué agregar. No se le pide la lista entera de
// nuevo a propósito: rehacerla es otra cápsula, con otra suerte.

import Anthropic from "@anthropic-ai/sdk";
import { ENGINE_MODEL } from "@/lib/models";
import { medirAnthropic, type QuienMide } from "@/lib/recibos";
import type { CapsuleItem } from "@/lib/capsule";
import type { HallazgoCapsula } from "@/lib/engine/capsule-revision";

export type Reparacion = { quitar: string[]; agregar: CapsuleItem[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * LA CONVERSACIÓN, en tres turnos: su pedido original, la lista como respuesta
 * del modelo, y lo que encontró el revisor.
 *
 * NO en un solo mensaje, y está medido (2026-10-18): con "YA ARMASTE ESTA
 * LISTA… UN REVISOR ENCONTRÓ…" pegado al pedido original, el modelo devolvió
 * `refusal` en 17 de 17 llamadas con el schema real, sin importar qué campos se
 * le quitaran al schema. Lo mismo dicho como conversación pasó en 4 de 5, y la
 * quinta se cortó a media respuesta (por eso hay un reintento). Un mensaje del
 * usuario que le dice al modelo lo que "ya hizo" se parece demasiado a un
 * intento de manipularlo.
 */
export function listaComoRespuesta(items: CapsuleItem[]): string {
  return `Esta es su lista:\n${items.map((it) => `- ${it.nombre} · ${it.category} · ${it.colorFamilia} · ${it.formalidad} · ${it.temporada}`).join("\n")}`;
}

export function pedidoDeReparacion(hallazgos: HallazgoCapsula[]): string {
  return `Revisé tu lista contra lo que contestó y encontré esto:\n${hallazgos.map((h) => `- ${h.detalle}`).join("\n")}\n\nCorrige sólo eso, con las mismas reglas: dime qué piezas quitar (con su nombre exacto) y qué piezas agregar, en su paleta y su estilo. No toques nada que no esté en lo que encontré: lo demás se queda igual.`;
}

/** Aplica los cambios: quita por nombre (sin acentos ni mayúsculas) y agrega al final. Lógica pura. */
export function aplicarReparacion(items: CapsuleItem[], r: Reparacion): CapsuleItem[] {
  const fuera = new Set(r.quitar.map(norm));
  const quedan = items.filter((it) => !fuera.has(norm(it.nombre)));
  const ya = new Set(quedan.map((it) => norm(it.nombre)));
  const nuevas = r.agregar.filter((it) => it?.nombre?.trim() && !ya.has(norm(it.nombre)));
  return [...quedan, ...nuevas.map((it, i) => ({ ...it, prioridad: quedan.length + i + 1 }))];
}

/**
 * Pide los cambios al modelo. `itemSchema` es el schema de UNA prenda del
 * generador que llama (la cápsula y la maleta no piden exactamente los mismos
 * campos). null si la llamada falla: la lista sin reparar es mejor que ninguna.
 */
const CATEGORIAS = new Set(["top", "bottom", "calzado", "abrigo", "saco", "vestido", "accesorio"]);
const FORMALIDADES_OK = new Set(["casual", "formal-casual", "formal"]);

/** El schema mínimo de una prenda (sin listas fijas, sin hueco ni porqué): el del tercer intento. */
export const ITEM_REDUCIDO = {
  type: "object",
  properties: {
    nombre: { type: "string" },
    tipo: { type: "string" },
    category: { type: "string" },
    colorFamilia: { type: "string" },
    formalidad: { type: "string" },
    temporada: { type: "string" },
    visual: { type: "string" },
  },
  required: ["nombre", "tipo", "category", "colorFamilia", "formalidad", "temporada", "visual"],
  additionalProperties: false,
};

/** Valida y completa una pieza agregada: categoría y formalidad válidas, y los campos que el reducido no trae. */
export function completarPieza(x: Partial<CapsuleItem> | null | undefined): CapsuleItem | null {
  if (!x?.nombre?.trim() || !CATEGORIAS.has(String(x.category))) return null;
  return {
    ...(x as CapsuleItem),
    formalidad: (FORMALIDADES_OK.has(String(x.formalidad)) ? x.formalidad : "casual") as CapsuleItem["formalidad"],
    temporada: x.temporada || "todo-el-año",
    hueco: x.hueco ?? null,
    porque: x.porque ?? "",
    prioridad: typeof x.prioridad === "number" ? x.prioridad : 99,
  };
}

export async function pedirReparacion(args: {
  system: string;
  usuario: string;
  items: CapsuleItem[];
  hallazgos: HallazgoCapsula[];
  itemSchema: Record<string, unknown>;
  quien: QuienMide | null;
  tarea: string;
}): Promise<Reparacion | null> {
  const client = new Anthropic();
  // TRES INTENTOS, el tercero con el schema REDUCIDO. Medido el 2026-10-18 con
  // el perfil completo de una persona (silueta incluida): el schema completo de
  // la prenda se rechazó en 8 de 8, con y sin listas fijas; el reducido —sólo
  // lo que hace falta para la prenda y su dibujo— pasó en 3 de 3. Lo que el
  // reducido no trae (hueco, porqué) se queda vacío: mejor la pieza correcta sin
  // su línea que el hueco sin llenar.
  for (let intento = 1; intento <= 3; intento++) {
    const itemSchema = intento < 3 ? args.itemSchema : ITEM_REDUCIDO;
    try {
      const response = await medirAnthropic(args.quien && { ...args.quien, tarea: args.tarea }, ENGINE_MODEL, () =>
        client.messages.create({
          model: ENGINE_MODEL,
          max_tokens: 3000,
          thinking: { type: "disabled" },
          system: args.system,
          messages: [
            { role: "user", content: args.usuario },
            { role: "assistant", content: listaComoRespuesta(args.items) },
            { role: "user", content: pedidoDeReparacion(args.hallazgos) },
          ],
          output_config: {
            format: {
              type: "json_schema",
              schema: {
                type: "object",
                properties: {
                  quitar: { type: "array", items: { type: "string" } },
                  agregar: { type: "array", items: itemSchema },
                },
                required: ["quitar", "agregar"],
                additionalProperties: false,
              },
            },
          },
        })
      );
      const text = response.content.find((b) => b.type === "text")?.text;
      if (!text || response.stop_reason === "max_tokens") continue;
      const p = JSON.parse(text) as Partial<Reparacion>;
      return {
        quitar: Array.isArray(p.quitar) ? p.quitar : [],
        agregar: (Array.isArray(p.agregar) ? p.agregar : []).map(completarPieza).filter((x): x is CapsuleItem => !!x),
      };
    } catch (e) {
      console.error(`[reparar-lista] ${args.tarea} intento ${intento}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return null;
}

/**
 * UN HALLAZGO A LA VEZ (2026-10-18), y cada uno sobre la lista ya corregida.
 * Con los tres hallazgos de una persona en una sola llamada, el modelo se negó
 * en todos los intentos; uno por uno pasaron los tres. De paso, cada corrección
 * ve lo que ya cambió la anterior y no se pisan.
 */
export async function repararPorHallazgo(args: {
  system: string;
  usuario: string;
  items: CapsuleItem[];
  hallazgos: HallazgoCapsula[];
  itemSchema: Record<string, unknown>;
  quien: QuienMide | null;
  tarea: string;
  /** Re-ordena y normaliza la lista después de cada cambio (cada generador tiene el suyo). */
  ordenar: (lista: CapsuleItem[]) => CapsuleItem[];
}): Promise<{ items: CapsuleItem[]; quitadas: string[]; agregadas: string[]; reglas: string[] }> {
  let items = args.items;
  const quitadas: string[] = [];
  const agregadas: string[] = [];
  const reglas: string[] = [];
  const porRegla = new Map<string, HallazgoCapsula[]>();
  for (const h of args.hallazgos) porRegla.set(h.regla, [...(porRegla.get(h.regla) ?? []), h]);
  for (const [regla, grupo] of porRegla) {
    const r = await pedirReparacion({ ...args, items, hallazgos: grupo });
    if (!r || (!r.quitar.length && !r.agregar.length)) continue;
    items = args.ordenar(aplicarReparacion(items, r));
    quitadas.push(...r.quitar);
    agregadas.push(...r.agregar.map((a) => a.nombre));
    reglas.push(regla);
  }
  return { items, quitadas, agregadas, reglas };
}
