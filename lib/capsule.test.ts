import { describe, it, expect } from "vitest";
import {
  ASSESSMENT_QUESTIONS,
  assessmentQuestions,
  capsuleRows,
  closetSignature,
  visibleQuestions,
  lifestyleSummary,
  type CapsuleItem,
  type CapsuleMatch,
  type CapsuleTarget,
  type ClosetItemLite,
} from "./capsule";

const lite = (over: Partial<ClosetItemLite> = {}): ClosetItemLite => ({
  id: "i1",
  nombre: "Suéter marino",
  category: "top",
  color: "marino",
  formalidad: "formal-casual",
  ...over,
});

describe("closetSignature — invalida el match al corregir atributos ricos (v25)", () => {
  it("corregir el color cambia la firma (antes se quedaba vieja en silencio)", () => {
    const a = closetSignature([lite({ color: "marino" })]);
    const b = closetSignature([lite({ color: "negro" })]);
    expect(a).not.toBe(b);
  });

  it("corregir material, patrón, temporada o corte cambia la firma", () => {
    const base = closetSignature([lite()]);
    expect(closetSignature([lite({ material: "lana" })])).not.toBe(base);
    expect(closetSignature([lite({ patron: "rayas" })])).not.toBe(base);
    expect(closetSignature([lite({ temporada: "frio" })])).not.toBe(base);
    expect(closetSignature([lite({ corte: "holgado" })])).not.toBe(base);
    expect(closetSignature([lite({ color_hex: "#1a2b3c" })])).not.toBe(base);
  });

  it("es estable: mismos atributos → misma firma", () => {
    expect(closetSignature([lite()])).toBe(closetSignature([lite()]));
  });

  it("no depende del orden de las prendas (se ordena)", () => {
    const x = lite({ id: "a", nombre: "A" });
    const y = lite({ id: "b", nombre: "B" });
    expect(closetSignature([x, y])).toBe(closetSignature([y, x]));
  });

  it("campos ricos ausentes (prenda vieja) no rompen: firma consistente", () => {
    const sinRicos = { id: "i1", category: "top", formalidad: "casual" };
    expect(closetSignature([sinRicos])).toBe(closetSignature([sinRicos]));
  });
});

describe("assessmentQuestions — quiz con género", () => {
  const findOpt = (qs: ReturnType<typeof assessmentQuestions>, qid: string, value: string) =>
    qs.find((q) => q.id === qid)?.options.find((o) => o.value === value);

  it("sin género devuelve la versión neutra tal cual", () => {
    expect(assessmentQuestions(null)).toBe(ASSESSMENT_QUESTIONS);
    expect(findOpt(ASSESSMENT_QUESTIONS, "fit", "nose")?.label).toBe("Aún no lo sé");
  });

  it("mujer: concordancia femenina y ejemplos de su clóset", () => {
    const qs = assessmentQuestions("mujer");
    expect(findOpt(qs, "fit", "nose")?.label).toBe("No estoy segura");
    expect(findOpt(qs, "formalidad_techo", "smart")?.hint).toContain("blusa");
  });

  it("hombre: concordancia masculina y ejemplos de su clóset", () => {
    const qs = assessmentQuestions("hombre");
    expect(findOpt(qs, "fit", "nose")?.label).toBe("No estoy seguro");
    expect(findOpt(qs, "formalidad_techo", "smart")?.hint).toContain("camisa");
  });

  it("ids y values idénticos en las tres versiones (las respuestas guardadas no cambian)", () => {
    const shape = (qs: ReturnType<typeof assessmentQuestions>) =>
      qs.map((q) => `${q.id}:${q.options.map((o) => o.value).join(",")}`).join("|");
    expect(shape(assessmentQuestions("mujer"))).toBe(shape(ASSESSMENT_QUESTIONS));
    expect(shape(assessmentQuestions("hombre"))).toBe(shape(ASSESSMENT_QUESTIONS));
  });

  it("no muta la versión neutra (devuelve copias)", () => {
    assessmentQuestions("mujer");
    expect(findOpt(ASSESSMENT_QUESTIONS, "fit", "nose")?.label).toBe("Aún no lo sé");
  });
});

describe("lifestyleSummary — el fit 'nose' no entra al resumen", () => {
  it("descarta 'nose' (no produce 'prefiere la ropa aún no lo sé')", () => {
    const s = lifestyleSummary({ fit: "nose", eventos: "seguido" });
    expect(s).not.toContain("prefiere la ropa");
    expect(s).toContain("eventos");
  });

  it("un fit real sí entra", () => {
    expect(lifestyleSummary({ fit: "entallado" })).toContain("prefiere la ropa ajustado");
  });
});


// El estado "parecido que ya rechazaste" ES un hueco real. Se rompió una vez
// (quedaba en "decide" con menos puertas que un hueco normal) — queda blindado.
const ideal = (over: Partial<CapsuleItem> = {}): CapsuleItem => ({
  nombre: "Camisa de vestir azul rey",
  tipo: "camisa-vestir",
  category: "top",
  colorFamilia: "azul",
  formalidad: "formal-casual",
  temporada: "todo-el-año",
  prioridad: 1,
  porque: "tu acento en las cenas",
  ...over,
});
const target = (items: CapsuleItem[]): CapsuleTarget =>
  ({ items } as CapsuleTarget);

describe("capsuleRows — el parecido rechazado cuenta como hueco", () => {
  const t = target([ideal()]);
  const match: CapsuleMatch = {
    signature: "s",
    entries: [{ status: "parecido", by: "Camisa azul rey de manga corta", difiere: "manga corta vs larga" }],
  };

  it("sin decidir: sigue pendiente y NO cuenta como cubierta", () => {
    const [r] = capsuleRows(t, match);
    expect(r.base).toBe("parecido");
    expect(r.decision).toBeNull();
    expect(r.covered).toBe(false);
  });

  it("aceptado: cuenta como cubierto por TU prenda", () => {
    const [r] = capsuleRows(t, match, { "0": "accept" });
    expect(r.covered).toBe(true);
    expect(r.by).toBe("Camisa azul rey de manga corta");
  });

  it("rechazado: NO cuenta como cubierta (es hueco real)", () => {
    const [r] = capsuleRows(t, match, { "0": "reject" });
    expect(r.decision).toBe("reject");
    expect(r.covered).toBe(false);
    expect(r.effective).toBe("falta");
  });

  it("difiere viaja hasta la fila (es lo que explica la comparación)", () => {
    const [r] = capsuleRows(t, match);
    expect(r.difiere).toBe("manga corta vs larga");
  });

  it("un match viejo sin difiere no rompe (queda en null)", () => {
    const viejo: CapsuleMatch = {
      signature: "s",
      entries: [{ status: "parecido", by: "Camisa azul rey de manga corta" }],
    };
    expect(capsuleRows(t, viejo)[0].difiere).toBeNull();
  });
});

// "tienes" desmentido: el match acredita cobertura falsa (te dice que ya tienes
// algo que no) y hasta ahora no había forma de corregirlo — el "N de M" solo se
// podía corregir hacia abajo. Es lo que hace confiable al número.
describe("capsuleRows — desmentir un 'tienes' del match", () => {
  const t = target([ideal({ nombre: "Henley de algodón gris" })]);
  const match: CapsuleMatch = {
    signature: "s",
    entries: [{ status: "tienes", by: "Camiseta térmica" }],
  };

  it("sin decisión cuenta como cubierta (comportamiento de siempre)", () => {
    const [r] = capsuleRows(t, match);
    expect(r.covered).toBe(true);
    expect(r.effective).toBe("tienes");
  });

  it("desmentido: deja de contar y pasa a hueco real", () => {
    const [r] = capsuleRows(t, match, { "0": "reject" });
    expect(r.covered).toBe(false);
    expect(r.effective).toBe("falta");
    // base intacto: la UI sabe que vino de un "tienes" (nota + deshacer).
    expect(r.base).toBe("tienes");
  });

  it("deshacer (accept) lo devuelve a cubierta", () => {
    const [r] = capsuleRows(t, match, { "0": "accept" });
    expect(r.covered).toBe(true);
    expect(r.effective).toBe("tienes");
  });

  it("un 'falta' no se ve afectado por un override colgado", () => {
    const tf = target([ideal()]);
    const mf: CapsuleMatch = { signature: "s", entries: [{ status: "falta", by: null }] };
    const [r] = capsuleRows(tf, mf, { "0": "reject" });
    expect(r.effective).toBe("falta");
    expect(r.decision).toBeNull();
  });
});


// Pregunta condicional del clima de viaje: la cápsula sale genérica si solo mira
// el clima de tu ciudad (no puedes empacar lo que no tienes), pero cobrarle el
// paso a quien no viaja sería fricción pura. Esta es la lógica que lo decide.
describe("visibleQuestions — el clima de viaje solo aparece si viajas", () => {
  const qs = ASSESSMENT_QUESTIONS;
  const viaje = () => qs.find((q) => q.id === "viaje_clima")!;
  const ids = (a: Record<string, string>) => visibleQuestions(qs, a).map((q) => q.id);

  it("la pregunta existe y es condicional a 'viajo' de actividades", () => {
    expect(viaje().showIf).toEqual({ question: "actividades", value: "viajo" });
    expect(viaje().multi).toBe(true);
  });

  it("sin responder actividades: no se muestra", () => {
    expect(ids({})).not.toContain("viaje_clima");
  });

  it("con actividades pero SIN viajo: no se muestra", () => {
    expect(ids({ actividades: "gym,noche" })).not.toContain("viaje_clima");
  });

  it("con 'viajo' entre varias: se muestra", () => {
    expect(ids({ actividades: "gym,viajo,noche" })).toContain("viaje_clima");
  });

  it("no confunde un valor que CONTIENE la palabra (match exacto por coma)", () => {
    expect(ids({ actividades: "viajobarato" })).not.toContain("viaje_clima");
  });

  it("las no-condicionales nunca se filtran", () => {
    const base = ids({});
    for (const q of qs) if (!q.showIf) expect(base).toContain(q.id);
  });
});

describe("lifestyleSummary — el clima de viaje llega al motor", () => {
  it("nombra a dónde viaja", () => {
    const s = lifestyleSummary({ actividades: "viajo", viaje_clima: "frio,calor" }) ?? "";
    expect(s).toContain("viaja a:");
    expect(s.toLowerCase()).toContain("frío de verdad");
  });

  it('"nada distinto a mi clima" no agrega ruido al prompt', () => {
    const s = lifestyleSummary({ actividades: "viajo", viaje_clima: "similar" }) ?? "";
    expect(s).not.toContain("viaja a:");
  });
});
