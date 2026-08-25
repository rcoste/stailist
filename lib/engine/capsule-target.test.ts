import { describe, it, expect } from "vitest";
import { bloqueVida, lineaAcentosCapsula, partirTrajes, limpiarEmpaquetados } from "./capsule-target";
import { ASSESSMENT_QUESTIONS, type AssessmentQuestion, type CapsuleItem } from "@/lib/capsule";

// Lo que se blinda: QUÉ frase le llega al motor por cada respuesta del quiz.
// El bloque "vida" es la mitad del contexto de la cápsula ideal, y el texto de
// la pregunta viaja dentro — así que reescribir una pregunta para que se
// entienda mejor puede, sin querer, quitarle señal al prompt.

const q = (over: Partial<AssessmentQuestion> = {}): AssessmentQuestion => ({
  id: "actividades",
  label: "pregunta de pantalla",
  multi: true,
  options: [
    { value: "gym", label: "Gym o deporte" },
    { value: "noche", label: "Salir de noche" },
  ],
  ...over,
});

describe("bloqueVida — qué le llega al motor del quiz de vida", () => {
  it("usa promptLabel en vez del label cuando la pregunta lo trae", () => {
    const linea = bloqueVida(
      [q({ promptLabel: "la frase que le rinde al motor" })],
      { actividades: "gym" }
    );
    expect(linea).toBe("- la frase que le rinde al motor → Gym o deporte");
  });

  it("sin promptLabel usa el label de la pantalla (comportamiento de siempre)", () => {
    expect(bloqueVida([q()], { actividades: "gym" })).toBe(
      "- pregunta de pantalla → Gym o deporte"
    );
  });

  it("una pregunta sin contestar no ocupa línea", () => {
    expect(bloqueVida([q()], {})).toBe("");
  });

  it("multi junta todas las respuestas elegidas", () => {
    expect(bloqueVida([q()], { actividades: "gym,noche" })).toBe(
      "- pregunta de pantalla → Gym o deporte, Salir de noche"
    );
  });

  // La regresión concreta del 2026-08-13: la pregunta de actividades se
  // reescribió porque "¿qué pide ropa especial?" confundía a la gente, pero esa
  // frase era justo la que le decía al motor que esas actividades SUMAN piezas.
  // Si alguien borra el promptLabel, el motor deja de oír la instrucción.
  it("la pregunta de actividades le sigue pidiendo ropa al motor", () => {
    const real = ASSESSMENT_QUESTIONS.find((x) => x.id === "actividades")!;
    expect(real.label).not.toMatch(/ropa especial/);
    expect(bloqueVida([real], { actividades: "gym" })).toMatch(/ropa especial/);
  });
});

describe("lineaAcentosCapsula — dónde vive el color en la cápsula", () => {
  it("sin apetito elegido no dice nada: la cápsula de los 24 con semilla no cambia", () => {
    expect(lineaAcentosCapsula(null)).toBe("");
  });
  it("discreto empuja los acentos a piezas chicas y acota las grandes a UNA", () => {
    const l = lineaAcentosCapsula("discreto");
    expect(l).toContain("piezas chicas");
    expect(l).toMatch(/UNA pieza grande/);
  });
  it("protagonista sí pide piezas grandes de color, sin soltar la regla de 3", () => {
    const l = lineaAcentosCapsula("protagonista");
    expect(l).toMatch(/GRANDES/);
    expect(l).toContain("regla de 3");
  });
  it("medio reparte entre chicas y medianas", () => {
    expect(lineaAcentosCapsula("medio")).toMatch(/chicas y UNA o DOS medianas/);
  });
});

describe("partirTrajes — un traje son DOS piezas", () => {
  const it_ = (over: Partial<CapsuleItem>): CapsuleItem =>
    ({
      nombre: "x", tipo: "x", hueco: "x", category: "saco", colorFamilia: "marino",
      formalidad: "formal", temporada: "todo-el-año", prioridad: 1, porque: "p",
      ...over,
    }) as CapsuleItem;

  it("el caso real: 'Traje de lana azul marino' sale como saco + pantalón", () => {
    const r = partirTrajes([it_({ nombre: "Traje de lana azul marino", tipo: "traje" })]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ category: "saco", tipo: "saco-de-traje" });
    expect(r[1]).toMatchObject({ category: "bottom", tipo: "pantalon-de-traje" });
    expect(r[1].nombre).toContain("marino");
    // El pantalón hereda lo que comparte con el saco…
    expect(r[1].formalidad).toBe("formal");
    expect(r[1].colorFamilia).toBe("marino");
    // …pero no repite su porqué palabra por palabra.
    expect(r[1].porque).not.toBe(r[0].porque);
  });

  it("el TRAJE DE BAÑO no se parte (no es sastrería, y además es bottom)", () => {
    const bano = it_({ nombre: "Traje de baño negro liso", tipo: "traje-de-bano", category: "bottom" });
    expect(partirTrajes([bano])).toEqual([bano]);
  });

  it("un blazer suelto se queda como está: no todo saco es traje", () => {
    const blazer = it_({ nombre: "Saco de lana gris carbón", tipo: "blazer", colorFamilia: "gris" });
    expect(partirTrajes([blazer])).toEqual([blazer]);
  });

  it("no toca las demás piezas ni las reordena", () => {
    const a = it_({ nombre: "Camisa blanca", tipo: "camisa", category: "top" });
    const b = it_({ nombre: "Jeans", tipo: "jeans", category: "bottom" });
    expect(partirTrajes([a, b])).toEqual([a, b]);
  });
});

describe("partirTrajes — los casos que cazó el dry run del backfill", () => {
  const it2 = (over: Partial<CapsuleItem>): CapsuleItem =>
    ({
      nombre: "x", tipo: "x", hueco: "x", category: "saco", colorFamilia: "negro",
      formalidad: "formal", temporada: "todo-el-año", prioridad: 1, porque: "p",
      ...over,
    }) as CapsuleItem;

  it("si el pantalón del traje YA está en la lista, no se duplica", () => {
    const r = partirTrajes([
      it2({ nombre: "Traje negro de lana", tipo: "traje", colorFamilia: "negro" }),
      it2({ nombre: "Pantalón de traje negro de lana", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "negro" }),
    ]);
    expect(r).toHaveLength(2);
    expect(r.filter((x) => x.category === "bottom")).toHaveLength(1);
  });

  it("limpia el '(saco)' del nombre: la pieza ya se llama saco", () => {
    const r = partirTrajes([it2({ nombre: "Traje negro de lana (saco)", tipo: "traje" })]);
    expect(r[0].nombre).toBe("Saco de traje negro de lana");
  });
});

describe("limpiarEmpaquetados — una pieza es UNA prenda de UN color", () => {
  const it3 = (over: Partial<CapsuleItem>): CapsuleItem =>
    ({
      nombre: "x", tipo: "calcetin", hueco: "x", category: "accesorio", colorFamilia: "esmeralda",
      formalidad: "casual", temporada: "todo-el-año", prioridad: 1, porque: "p",
      ...over,
    }) as CapsuleItem;

  it("el caso real de Roberto: dos pares de dos colores en un item", () => {
    const r = limpiarEmpaquetados([
      it3({ nombre: "Calcetines de algodón esmeralda y vino (par de pares)" }),
    ]);
    expect(r[0].nombre).toBe("Calcetines de algodón esmeralda");
    expect(r[0].nombre).not.toMatch(/vino|par de pares/);
  });

  it("no toca los nombres normales, ni los que llevan 'y' legítima", () => {
    const normal = it3({ nombre: "Bufanda de lana rubí", colorFamilia: "rubi" });
    expect(limpiarEmpaquetados([normal])).toEqual([normal]);
    const conY = it3({ nombre: "Reloj de acero con caja dorada y correa negra", colorFamilia: "negro" });
    expect(limpiarEmpaquetados([conY])[0].nombre).toBe(conY.nombre);
  });
});

describe("limpiarEmpaquetados — el falso positivo que cazó el dry run", () => {
  it("'manga larga y cuello alto' NO se toca: la 'y' une características, no prendas", () => {
    const top = {
      nombre: "Top de punto esmeralda de manga larga y cuello alto",
      tipo: "top-punto", hueco: "x", category: "top", colorFamilia: "esmeralda",
      formalidad: "casual", temporada: "frio", prioridad: 1, porque: "p",
    } as CapsuleItem;
    expect(limpiarEmpaquetados([top])).toEqual([top]);
  });
});
