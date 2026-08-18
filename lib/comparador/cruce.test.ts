import { describe, it, expect } from "vitest";
import { cruzarCorrida } from "./cruce";
import type { CorridaMotorCargada } from "./motor-servidor";

// Lo que estos tests blindan NO es el reparto en cuatro cajas —eso es un if—
// sino las tres decisiones que se tomaron al construirlo y que cambian el
// número que Roberto va a leer: qué cuenta como "marcó", qué se salta, y sobre
// qué denominador se mide el avance.

const look = (nombre: string, hallazgos: unknown[] = []) => ({ nombre, hallazgos });

function corrida(over: {
  marcasLook?: Record<string, Record<string, string>>;
  defectosLook?: Record<string, Record<string, string[]>>;
  comentariosLook?: Record<string, Record<string, string>>;
  veredictosJuez?: Record<string, Record<string, { v?: "acuerdo" | "exagero"; nota?: string }>>;
  hallazgosPorLook?: Record<number, { defecto: string; gravedad: string }[]>;
  voto?: string | null;
  repiteDe?: string | null;
  nLooks?: number;
}): CorridaMotorCargada {
  const n = over.nLooks ?? 2;
  const looks = Array.from({ length: n }, (_, i) => ({
    nombre: `look ${i}`,
    item_ids: [`i${i}`],
  }));
  const criticas = Array.from({ length: n }, (_, i) => ({
    hallazgos: (over.hallazgosPorLook?.[i] ?? []).map((h) => ({
      ...h,
      pieza: "el conjunto",
      problema: "problema",
      arreglo: "arreglo",
    })),
  }));
  return {
    id: "c1",
    tamano: "vistazo",
    variantes: [
      { clave: "produccion", etiqueta: "Producción" },
      { clave: "reto", etiqueta: "Reto" },
    ],
    promptVersion: "v53",
    poolVersion: "v8",
    regla: null,
    estado: "abierta",
    nota: null,
    closetUserId: "u1",
    closetGender: "hombre",
    ordenPorPar: {},
    prendas: {},
    pares: [
      {
        id: "p1",
        n: 1,
        brief: {},
        repiteDe: over.repiteDe ?? null,
        voto: over.voto === undefined ? "empate" : over.voto,
        defectos: null,
        marcasLook: over.marcasLook ?? null,
        defectosLook: over.defectosLook ?? null,
        comentariosLook: over.comentariosLook ?? null,
        prefsLook: null,
        veredictosJuez: over.veredictosJuez ?? null,
        nota: null,
        lados: [{ variante: "produccion", looks, criticas }],
      },
    ],
  } as unknown as CorridaMotorCargada;
}

describe("cruzarCorrida — ¿el juez ve lo que ve la persona?", () => {
  it("reparte los looks en las cuatro cajas", () => {
    const c = corrida({
      nLooks: 4,
      marcasLook: { produccion: { "0": "abajo", "1": "arriba", "2": "arriba", "3": "arriba" } },
      hallazgosPorLook: {
        0: [{ defecto: "clima", gravedad: "rompe" }],
        1: [{ defecto: "plano", gravedad: "resta" }],
      },
      defectosLook: { produccion: { "2": ["color"] } },
    });
    const r = cruzarCorrida(c);
    expect(r.conteo).toEqual({ coinciden: 1, soloJuez: 1, soloHumano: 1, limpios: 1 });
  });

  // UN 👍 CON ETIQUETA CUENTA COMO MARCA. Pasó dos de cinco veces en la primera
  // ronda real: aprobar el look y anotarle un pero. Si sólo contara el 👎, esos
  // casos caerían en "sólo el juez lo vio" y el juez parecería más estricto de
  // lo que es.
  it("una etiqueta con 👍 cuenta como que la persona marcó", () => {
    const c = corrida({
      nLooks: 1,
      marcasLook: { produccion: { "0": "arriba" } },
      defectosLook: { produccion: { "0": ["color"] } },
      hallazgosPorLook: { 0: [{ defecto: "color", gravedad: "resta" }] },
    });
    const r = cruzarCorrida(c);
    expect(r.conteo.coinciden).toBe(1);
    expect(r.looks[0].mismaEtiqueta).toBe(true);
  });

  it("marca cuando los dos vieron el look pero lo llamaron distinto", () => {
    const c = corrida({
      nLooks: 1,
      defectosLook: { produccion: { "0": ["color"] } },
      hallazgosPorLook: { 0: [{ defecto: "ocasion", gravedad: "resta" }] },
    });
    expect(cruzarCorrida(c).looks[0].mismaEtiqueta).toBe(false);
  });

  // LOS ESPEJOS REPITEN LOS LOOKS DE SU ORIGINAL: contarlos duplicaría cada
  // coincidencia y falsearía el marcador del juez.
  it("se salta los espejos", () => {
    const c = corrida({ repiteDe: "p0", hallazgosPorLook: { 0: [{ defecto: "clima", gravedad: "rompe" }] } });
    expect(cruzarCorrida(c).looks).toHaveLength(0);
  });

  // Sin voto no hay cruce: leer los hallazgos con el voto abierto es justo lo
  // que el ciego evita.
  it("se salta los pares sin votar", () => {
    expect(cruzarCorrida(corrida({ voto: null })).looks).toHaveLength(0);
  });

  // EL DENOMINADOR SON LOS LOOKS QUE EL JUEZ MARCÓ, no todos: calificar un look
  // que nadie marcó no dice nada del juez, y meterlo en el conteo haría que el
  // avance no llegue nunca a completarse.
  it("el avance se mide sólo sobre lo que el juez marcó", () => {
    const c = corrida({
      nLooks: 3,
      hallazgosPorLook: { 0: [{ defecto: "clima", gravedad: "rompe" }], 1: [{ defecto: "plano", gravedad: "resta" }] },
      veredictosJuez: { produccion: { "0": { v: "acuerdo" } } },
    });
    const r = cruzarCorrida(c);
    expect(r.calificados).toBe(1);
    expect(r.porCalificar).toBe(1);
    expect(r.acuerdo).toBe(1);
    expect(r.exagero).toBe(0);
  });

  it("una nota sin veredicto no cuenta como calificado", () => {
    const c = corrida({
      nLooks: 1,
      hallazgosPorLook: { 0: [{ defecto: "clima", gravedad: "rompe" }] },
      veredictosJuez: { produccion: { "0": { nota: "lo pienso" } } },
    });
    const r = cruzarCorrida(c);
    expect(r.calificados).toBe(0);
    expect(r.looks[0].veredicto?.nota).toBe("lo pienso");
  });
});
