import { describe, it, expect } from "vitest";
import { bloqueVida, lineaAcentosCapsula, partirTrajes, limpiarEmpaquetados, enlazarTrajes, REGLA_SASTRERIA } from "./capsule-target";
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

// LA REGLA DE SASTRERÍA (2026-09-09). El caso: vida con "eventos seguido" y
// techo "formal", y la cápsula puso UN traje… negro, "de gala". Roberto tiene
// traje marino y gris carbón en ese clóset y su reacción fue "no me puso ni un
// traje". La práctica profesional es marino primero, gris carbón segundo; el
// negro es etiqueta y luto, y la gala la hace el smoking. Se fija por texto
// porque el prompt es un template literal (mismo patrón que lineaAcentosCapsula).
describe("REGLA_SASTRERIA — qué traje va primero", () => {
  it("el primer traje es marino y el segundo gris carbón", () => {
    expect(REGLA_SASTRERIA).toMatch(/UN traje[^.]*AZUL MARINO/);
    expect(REGLA_SASTRERIA).toMatch(/DOS[^.]*GRIS CARBÓN/);
  });

  it("el negro es etiqueta y luto, no sustituye al marino, y la gala es smoking", () => {
    expect(REGLA_SASTRERIA).toMatch(/NEGRO es de etiqueta y luto/);
    expect(REGLA_SASTRERIA).toMatch(/NO sustituye al marino/);
    expect(REGLA_SASTRERIA).toMatch(/SMOKING/);
  });

  it("un blazer suelto no reemplaza al traje, y el traje son dos piezas del mismo color", () => {
    expect(REGLA_SASTRERIA).toMatch(/blazer suelto[^.]*NO reemplaza al traje/);
    expect(REGLA_SASTRERIA).toMatch(/saco \+ su pantalón/);
  });

  it("es de hombre y lo dice: no inventa una regla para mujer", () => {
    expect(REGLA_SASTRERIA).toMatch(/^== SASTRERÍA \(hombre\) ==/);
  });
});

// EL TRAJE COMO UNIDAD (2026-09-09). Roberto: "una regla que teníamos era que,
// para los trajes, venían las dos cosas… no sea como que este saco separado y
// este pantalón separado". Los nombres son los REALES de las cápsulas en
// producción: el pantalón se llama "de vestir" en tres de las cinco y "de
// traje" en una, con `hueco` distinto en cada una — por eso el enlace no puede
// depender del nombre exacto.
const pieza = (p: Partial<Parameters<typeof enlazarTrajes>[0][number]>) => ({
  nombre: "x", tipo: "x", category: "top" as const, colorFamilia: "negro",
  formalidad: "casual" as const, temporada: "todo-el-año", prioridad: 1, porque: "x",
  ...p,
});

describe("enlazarTrajes — el saco y su pantalón son UNA cosa", () => {
  it("el caso de hugomora: saco de traje + pantalón DE VESTIR del mismo color quedan enlazados", () => {
    const r = enlazarTrajes([
      pieza({ nombre: "Saco de traje azul marino", tipo: "saco-traje", category: "saco", colorFamilia: "marino" }),
      pieza({ nombre: "Pantalón de vestir azul marino", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "marino" }),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].conjunto).toBe("traje-marino");
    expect(r[1].conjunto).toBe("traje-marino");
  });

  it("saco de traje SIN pantalón: se crea la mitad que falta, con el lazo", () => {
    const r = enlazarTrajes([
      pieza({ nombre: "Saco de traje gris carbón", tipo: "saco-de-traje", category: "saco", colorFamilia: "gris carbón", prioridad: 7 }),
    ]);
    expect(r).toHaveLength(2);
    expect(r[1].nombre).toBe("Pantalón de traje gris carbón");
    expect(r[1].category).toBe("bottom");
    expect(r[1].conjunto).toBe(r[0].conjunto);
    // MEDIO punto arriba del saco, no el mismo: el re-ranking (1..n por
    // prioridad, estable) los deja contiguos en la lista. Con la misma
    // prioridad el orden dependería de dónde cayó cada uno, y medido en la
    // cápsula de r_ortega el saco salía en la posición 5 y su pantalón en la 11.
    expect(r[1].prioridad).toBe(7.5);
  });

  it("el caso de r_ortega: DOS trajes no se llevan el mismo pantalón", () => {
    const r = enlazarTrajes([
      pieza({ nombre: "Saco de traje gris carbón de lana", tipo: "saco-de-traje", category: "saco", colorFamilia: "gris carbón" }),
      pieza({ nombre: "Saco de traje marino de lana", tipo: "saco-de-traje", category: "saco", colorFamilia: "marino" }),
      pieza({ nombre: "Pantalón de vestir gris carbón", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "gris carbón" }),
      pieza({ nombre: "Pantalón de vestir marino", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "marino" }),
      pieza({ nombre: "Pantalón de vestir negro", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "negro" }),
    ]);
    expect(r).toHaveLength(5); // no se creó ninguno de más
    const porNombre = Object.fromEntries(r.map((x) => [x.nombre, x.conjunto ?? null]));
    expect(porNombre["Saco de traje gris carbón de lana"]).toBe("traje-gris-carbon");
    expect(porNombre["Pantalón de vestir gris carbón"]).toBe("traje-gris-carbon");
    expect(porNombre["Saco de traje marino de lana"]).toBe("traje-marino");
    expect(porNombre["Pantalón de vestir marino"]).toBe("traje-marino");
    // El tercer pantalón no es de nadie: se queda suelto.
    expect(porNombre["Pantalón de vestir negro"]).toBeNull();
  });

  it("un BLAZER no ata a nadie: es la pieza que se lleva con jeans", () => {
    const r = enlazarTrajes([
      pieza({ nombre: "Blazer de lana azul marino", tipo: "blazer", category: "saco", colorFamilia: "marino" }),
      pieza({ nombre: "Pantalón de vestir marino", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "marino" }),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].conjunto).toBeUndefined();
    expect(r[1].conjunto).toBeUndefined();
  });

  it("el saco desestructurado tampoco: es un saco suelto, no medio traje", () => {
    const r = enlazarTrajes([
      pieza({ nombre: "Saco de algodón azul marino sin forro", tipo: "saco-desestructurado", category: "saco", colorFamilia: "marino" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].conjunto).toBeUndefined();
  });

  it("partirTrajes + enlazarTrajes: el traje entero sale como par YA enlazado", () => {
    const r = enlazarTrajes(partirTrajes([
      pieza({ nombre: "Traje de lana azul marino", tipo: "traje", category: "saco", colorFamilia: "marino" }),
    ]));
    expect(r).toHaveLength(2);
    expect(r[0].conjunto).toBe("traje-marino");
    expect(r[1].conjunto).toBe("traje-marino");
    expect(r[1].nombre).toBe("Pantalón de traje marino");
  });

  it("no re-enlaza lo ya enlazado (correr dos veces no duplica)", () => {
    const una = enlazarTrajes([
      pieza({ nombre: "Saco de traje marino", tipo: "saco-de-traje", category: "saco", colorFamilia: "marino" }),
    ]);
    expect(enlazarTrajes(una)).toHaveLength(2);
  });
});

describe("el traje queda JUNTO en la lista, no disperso", () => {
  it("tras el re-ranking por prioridad, el pantalón va justo después del saco", () => {
    // El re-ranking real del generador: ordenar por prioridad y renumerar 1..n.
    const rerank = (items: ReturnType<typeof enlazarTrajes>) =>
      items.slice().sort((a, b) => a.prioridad - b.prioridad).map((it, i) => ({ ...it, prioridad: i + 1 }));
    // Las posiciones REALES de la cápsula de r_ortega: saco marino en 5, su
    // pantalón en 11, saco gris carbón en 13, su pantalón en 3.
    const lista = rerank(enlazarTrajes([
      pieza({ nombre: "Camisa blanca", prioridad: 1 }),
      pieza({ nombre: "Pantalón de vestir gris carbón", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "gris carbón", prioridad: 3 }),
      pieza({ nombre: "Saco de traje marino de lana", tipo: "saco-de-traje", category: "saco", colorFamilia: "marino", prioridad: 5 }),
      pieza({ nombre: "Pantalón de vestir marino", tipo: "pantalon-vestir", category: "bottom", colorFamilia: "marino", prioridad: 11 }),
      pieza({ nombre: "Saco de traje gris carbón de lana", tipo: "saco-de-traje", category: "saco", colorFamilia: "gris carbón", prioridad: 13 }),
    ]));
    const pos = (n: string) => lista.findIndex((x) => x.nombre === n);
    expect(pos("Pantalón de vestir marino")).toBe(pos("Saco de traje marino de lana") + 1);
    expect(pos("Pantalón de vestir gris carbón")).toBe(pos("Saco de traje gris carbón de lana") + 1);
  });
});
