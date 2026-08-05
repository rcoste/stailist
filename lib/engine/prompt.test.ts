import { describe, it, expect } from "vitest";
import {
  describeItem,
  REGLA_PRENDAS_REALES,
  SYSTEM_PROMPT,
  type EngineItem,
} from "./prompt";

// Helper: prenda del motor con attrs mínimos + overrides.
const item = (attrs: EngineItem["attrs"]): EngineItem => ({ id: "x", attrs });

describe("describeItem — datos ricos v21", () => {
  it("línea base: nombre · color hex · formalidad · temporada", () => {
    expect(
      describeItem(
        item({
          nombre: "Jeans rectos",
          color: "azul",
          color_hex: "#27437B",
          formalidad: "casual",
          temporada: "todo-el-año",
        })
      )
    ).toBe("Jeans rectos · azul #27437B · casual · todo-el-año");
  });

  it("color_secundario se pega al color ('azul #123456 con blanco')", () => {
    expect(
      describeItem(
        item({
          nombre: "Camisa de rayas",
          color: "azul",
          color_hex: "#123456",
          color_secundario: "blanco",
        })
      )
    ).toBe("Camisa de rayas · azul #123456 con blanco");
  });

  it("sin color base NO se agrega el secundario suelto", () => {
    expect(
      describeItem(item({ nombre: "Bufanda", color_secundario: "rojo" }))
    ).toBe("Bufanda");
  });

  it("material entra a los extras", () => {
    expect(
      describeItem(item({ nombre: "Suéter", color: "gris", material: "lana" }))
    ).toBe("Suéter · gris · lana");
  });

  it('patrón con estampado se anuncia como "estampado X"', () => {
    expect(
      describeItem(item({ nombre: "Falda", color: "negro", patron: "floral" }))
    ).toBe("Falda · negro · estampado floral");
  });

  it('patrón "liso" se dice liso a secas (no "estampado liso")', () => {
    expect(
      describeItem(item({ nombre: "Playera", color: "blanco", patron: "liso" }))
    ).toBe("Playera · blanco · liso");
  });

  it('patrón genérico "estampado" no se duplica (no "estampado estampado")', () => {
    expect(
      describeItem(item({ nombre: "Blusa", color: "verde", patron: "estampado" }))
    ).toBe("Blusa · verde · estampado");
  });

  it("sin patrón no aparece nada de estampado (prendas legacy)", () => {
    const line = describeItem(item({ nombre: "Playera", color: "blanco" }));
    expect(line).not.toContain("liso");
    expect(line).not.toContain("estampado");
  });

  it("orden completo: material y patrón van antes de corte/largo/manga", () => {
    expect(
      describeItem(
        item({
          nombre: "Camisa",
          color: "azul",
          color_hex: "#27437B",
          color_secundario: "blanco",
          formalidad: "formal",
          temporada: "calor",
          material: "lino",
          patron: "rayas",
          corte: "recto",
          largo: "regular",
          manga: "larga",
        })
      )
    ).toBe(
      "Camisa · azul #27437B con blanco · formal · calor · lino · estampado rayas · corte recto · largo regular · manga larga"
    );
  });

  it("cae al tipo cuando no hay nombre", () => {
    expect(describeItem(item({ tipo: "camisa", color: "azul" }))).toBe(
      "camisa · azul"
    );
  });
});

import { orderClosetForEngine } from "./prompt";

describe("orderClosetForEngine — anti sesgo posicional", () => {
  const it2 = (id: string, categoria: string): EngineItem => ({
    id,
    attrs: { nombre: id, categoria } as EngineItem["attrs"],
  });
  const closet = [
    it2("t1", "top"), it2("b1", "bottom"), it2("t2", "top"),
    it2("c1", "calzado"), it2("b2", "bottom"), it2("t3", "top"),
  ];

  it("conserva todas las prendas (mismo multiset)", () => {
    const out = orderClosetForEngine(closet, () => 0.5);
    expect(out.map((i) => i.id).sort()).toEqual(["b1", "b2", "c1", "t1", "t2", "t3"]);
  });

  it("agrupa por categoría (grupos contiguos)", () => {
    const out = orderClosetForEngine(closet, () => 0.5);
    const cats = out.map((i) => (i.attrs as { categoria?: string }).categoria);
    // Cada categoría aparece en un solo tramo contiguo.
    const seen = new Set<string>();
    let prev: string | undefined;
    for (const c of cats) {
      if (c !== prev && seen.has(c!)) throw new Error(`categoría partida: ${c}`);
      if (c !== prev) seen.add(c!);
      prev = c;
    }
    expect(seen.size).toBe(3);
  });

  it("baraja dentro del grupo según rand (determinista con seed)", () => {
    // rand=0 → Fisher-Yates siempre intercambia con el índice 0 (rota el grupo).
    const a = orderClosetForEngine(closet, () => 0).map((i) => i.id);
    const b = orderClosetForEngine(closet, () => 0.999).map((i) => i.id);
    expect(a).not.toEqual(b); // dos seeds distintas → órdenes distintos
  });
});

import {
  contextBlock,
  ESCALERA_DE_PRIORIDADES,
  pisoDeFormalidad,
  type EngineContext,
} from "./prompt";
import { CRITIC_SYSTEM_TEXT } from "./critic";
import { closetBlock } from "./prompt";
import { RECETAS_HOMBRE } from "./recetario";
import { EMPTY_TASTE_SIGNAL } from "./taste-signal";

// Contexto mínimo: todo apagado, para probar cada línea nueva por separado.
const baseCtx: EngineContext = {
  gender: null,
  objective: null,
  plan: null,
  lifestyle: null,
  tasteTags: [],
  archetype: null,
  season: null,
  flow: null,
  items: [],
  weather: null,
  recentCombos: [],
  vetoes: [],
  timeOfDay: null,
  silueta: null,
  tasteSignal: EMPTY_TASTE_SIGNAL,
};

describe("contextBlock — género en el generador (v23)", () => {
  it("mujer: pide concordancia femenina y ojo de moda femenina", () => {
    const lines = contextBlock({ ...baseCtx, gender: "mujer" });
    expect(lines[0]).toContain("EN FEMENINO");
    expect(lines[0]).toContain("moda femenina");
  });

  it("hombre: pide concordancia masculina y criterio masculino", () => {
    const lines = contextBlock({ ...baseCtx, gender: "hombre" });
    expect(lines[0]).toContain("EN MASCULINO");
    expect(lines[0]).toContain("moda masculina");
  });

  it("sin género: pide frases neutras (no cae al masculino)", () => {
    const lines = contextBlock({ ...baseCtx, gender: null });
    expect(lines[0]).toContain("Género no definido");
    expect(lines[0]).toContain("frases neutras");
  });
});

describe("contextBlock — señales de estilo (v24)", () => {
  it("los tags se anuncian en orden de fuerza", () => {
    const lines = contextBlock({ ...baseCtx, tasteTags: ["pulido", "edgy"] });
    expect(lines).toContain("Tags de gusto (en orden de fuerza): pulido, edgy.");
  });

  it("sus palabras entran citadas y mandan sobre los tags", () => {
    const lines = contextBlock({ ...baseCtx, styleWords: "  básicos neutros  " });
    const line = lines.find((l) => l.includes("EN SUS PALABRAS"));
    expect(line).toContain('"básicos neutros"'); // trim aplicado
    expect(line).toContain("sus palabras mandan");
  });

  it("styleWords vacío o en blanco no agrega línea", () => {
    for (const words of [null, undefined, "", "   "]) {
      const lines = contextBlock({ ...baseCtx, styleWords: words });
      expect(lines.some((l) => l.includes("EN SUS PALABRAS"))).toBe(false);
    }
  });
});

import { ageStylingLine } from "@/lib/edad";

describe("contextBlock — edad como señal suave (feedback Nuri)", () => {
  it("con ageStyling la línea entra tal cual al contexto", () => {
    const linea = ageStylingLine("13-17");
    const lines = contextBlock({ ...baseCtx, ageStyling: linea });
    expect(lines).toContain(linea);
  });

  it("55+ también entra (el otro extremo con señal)", () => {
    const linea = ageStylingLine("55+");
    const lines = contextBlock({ ...baseCtx, ageStyling: linea });
    expect(lines).toContain(linea);
  });

  it("sin ageStyling (null/undefined/rangos medios) no agrega línea", () => {
    for (const v of [null, undefined, ageStylingLine("25-34")]) {
      const lines = contextBlock({ ...baseCtx, ageStyling: v });
      expect(lines.some((l) => l.includes("SUAVE"))).toBe(false);
    }
  });
});

import { tasteSignalLines } from "./prompt";

describe("tasteSignalLines — compartida por 4 motores (v24)", () => {
  it("señal vacía → sin líneas (no estorba el prompt)", () => {
    expect(tasteSignalLines(EMPTY_TASTE_SIGNAL)).toEqual([]);
  });

  it("worn/liked/disliked producen sus marcadores", () => {
    const lines = tasteSignalLines({
      worn: [{ title: "Look A", items: ["camisa", "jeans"], occasion: "oficina", reason: null }],
      liked: [{ title: null, items: ["polo"], occasion: null, reason: null }],
      disliked: [{ title: "Look B", items: ["saco"], occasion: null, reason: "muy formal" }],
      skipped: [],
    }).join("\n");
    expect(lines).toContain("SE LO PUSO");
    expect(lines).toContain("👍");
    expect(lines).toContain("RECHAZÓ");
    expect(lines).toContain("muy formal");
  });
});

// v27 · Ropa de baño y de entrenar fuera de los looks de calle. El catálogo no
// marca contexto en ninguna prenda (todas "casual"), y bikini/traje de baño están
// como categoría "vestido" — o sea, el motor los podía servir como look COMPLETO.
// La única defensa es esta regla, así que se blinda con test.
describe("SYSTEM_PROMPT — ropa de baño y de entrenar (v27)", () => {
  it("prohíbe traje de baño / bikini / short de baño en looks de calle", () => {
    expect(SYSTEM_PROMPT).toContain("Ropa de baño y de entrenar NO es ropa de calle");
    expect(SYSTEM_PROMPT).toContain("bikini");
    expect(SYSTEM_PROMPT).toContain("short de baño");
    // Nombra el hueco del catálogo: vienen categorizados como "vestido".
    expect(SYSTEM_PROMPT).toContain('"vestido"');
  });

  it("al top deportivo tipo bra le pide una capa, no lo prohíbe", () => {
    expect(SYSTEM_PROMPT).toContain("bra");
    expect(SYSTEM_PROMPT).toContain("ÚNICO top");
    expect(SYSTEM_PROMPT).toMatch(/capa encima/);
  });
});

describe("REGLA_PRENDAS_REALES — no inventar prendas que no existen", () => {
  it("prohíbe explícitamente los tejidos de punto en lino", () => {
    // El motor le propuso a Roberto una "Playera de lino esmeralda" (tipo
    // "playera-lino"). El lino no se teje en punto: esa prenda no se vende.
    const r = REGLA_PRENDAS_REALES.toLowerCase();
    expect(r).toContain("lino no se teje en punto");
    expect(r).toContain("no playeras");
    expect(r).toContain("suéteres de lino");
  });

  it("nombra el test que debe aplicar el modelo: que se pueda comprar tal cual", () => {
    expect(REGLA_PRENDAS_REALES.toLowerCase()).toContain("comprar tal cual");
  });

  it("cubre las prendas cuyo nombre ya implica su tela", () => {
    expect(REGLA_PRENDAS_REALES.toLowerCase()).toContain("jeans son de mezclilla");
  });
});

describe("contextBlock — preferencia de corte (v29)", () => {
  it("holgada: manda elegir el corte amplio pero conserva la regla de una sola zona con volumen", () => {
    const line = contextBlock({ ...baseCtx, fitPref: "holgada" }).find((l) =>
      l.includes("Cómo le gusta que le quede")
    );
    expect(line).toContain("HOLGADA");
    // Sin este freno, "prefiere holgado" se lee como permiso para inflar todo
    // el look y sale un disfraz, que es justo lo que las recetas vetan.
    expect(line).toContain("solo UNA zona lleva volumen");
  });

  it("recta: pide corte recto y aclara que recto no es entallado", () => {
    const line = contextBlock({ ...baseCtx, fitPref: "recta" }).find((l) =>
      l.includes("Cómo le gusta que le quede")
    );
    expect(line).toContain("RECTA");
    expect(line).toContain("no es entallado");
  });

  it("mixta: NO se traduce a un corte — deja mandar a la receta", () => {
    // Cuando los dos pares se contradicen, la persona no tiene preferencia
    // fuerte. Convertir esa moneda al aire en "recta" u "holgada" haría que el
    // motor actuara con confianza sobre un dato falso.
    const line = contextBlock({ ...baseCtx, fitPref: "mixta" }).find((l) =>
      l.includes("Cómo le gusta que le quede")
    );
    expect(line).toContain("NO tiene preferencia fuerte");
    expect(line).not.toContain("elige la de corte amplio");
    expect(line).not.toContain("elige el corte recto");
  });

  it("sin dato no agrega línea (perfiles anteriores a los pares)", () => {
    for (const fitPref of [null, undefined] as const) {
      const lines = contextBlock({ ...baseCtx, fitPref });
      expect(lines.some((l) => l.includes("Cómo le gusta que le quede"))).toBe(false);
    }
  });

  it("el gusto de corte y el cuerpo son líneas distintas y conviven", () => {
    // La trampa a evitar: que alguien confunda body_build (qué cuerpo tienes)
    // con fit_pref (cómo te gusta que quede). Son preguntas distintas y el
    // prompt debe llevar las dos sin que una pise a la otra.
    const lines = contextBlock({
      ...baseCtx,
      fitPref: "holgada",
      silueta: "complexión media, carga arriba",
    });
    expect(lines.some((l) => l.includes("Su cuerpo (orientación de styling"))).toBe(true);
    expect(lines.some((l) => l.includes("Cómo le gusta que le quede"))).toBe(true);
  });
});

describe("escalera de prioridades (v30)", () => {
  // El bug que la motiva NO fue una regla ausente, fue una regla sin rango:
  // "su colorimetría manda sobre la paleta del estilo" y "sus palabras mandan
  // sobre los tags" estaban escritas, pero eran pares sueltos. Donde dos
  // señales chocaban sin par declarado —la receta contra la ocasión— el modelo
  // decidía solo, y decidía distinto cada vez.
  it("declara las ocho señales en orden", () => {
    const orden = [
      "REGLAS DURAS",
      "CLIMA Y OCASIÓN",
      "COLORIMETRÍA",
      "SUS PALABRAS",
      "RECETA DEL ESTILO",
      "CÓMO LE GUSTA QUE LE QUEDE",
      "LO QUE HA VOTADO",
      "SU CUERPO",
    ];
    let anterior = -1;
    for (const señal of orden) {
      const pos = ESCALERA_DE_PRIORIDADES.indexOf(señal);
      expect(pos, `falta "${señal}" en la escalera`).toBeGreaterThan(-1);
      expect(pos, `"${señal}" está fuera de orden`).toBeGreaterThan(anterior);
      anterior = pos;
    }
  });

  it("aclara que no es permiso para ignorar lo de abajo", () => {
    // Sin esta línea la escalera se lee como "cumple 1 y olvídate del resto", y
    // el motor dejaría de intentar que todo quepa junto — que es lo que pasa
    // casi siempre.
    expect(ESCALERA_DE_PRIORIDADES).toContain("NO es permiso para ignorar");
    expect(ESCALERA_DE_PRIORIDADES).toContain("solo decide cuando de verdad se contradicen");
  });

  it("va en el prompt del generador Y en el del juez", () => {
    // Si solo la tuviera el generador, el juez repararía con otro orden de
    // prioridades y desharía decisiones correctas: cambiaría el top elegido por
    // colorimetría porque a él le pesó más la receta.
    expect(SYSTEM_PROMPT).toContain(ESCALERA_DE_PRIORIDADES);
    expect(CRITIC_SYSTEM_TEXT).toContain(ESCALERA_DE_PRIORIDADES);
  });
});

describe("piso de formalidad (v31)", () => {
  // El barrido de 129 looks midió que "evento de noche" fallaba el 32% —uno de
  // cada tres— y con el clóset COMPLETO todavía el 22%: salían suéter con
  // chinos y botines para una cena teniendo saco a la mano. En "diario" el
  // fallo era 0%. El motor no estaba roto en general: la ocasión no estaba
  // traducida a nada exigible.
  const ctx = (o: Partial<EngineContext>): EngineContext => ({ ...baseCtx, ...o });

  it("evento: exige una pieza que eleve y prohíbe lo deportivo", () => {
    const p = pisoDeFormalidad(ctx({ objective: "evento" }));
    expect(p).toContain("saco o blazer");
    expect(p).toContain("FUERA");
    expect(p).toMatch(/tenis deportivos/);
  });

  it("noche cuenta como evento aunque la ocasión sea otra", () => {
    expect(pisoDeFormalidad(ctx({ objective: "diario", timeOfDay: "noche" }))).toContain(
      "PISO DE FORMALIDAD"
    );
  });

  it("si el wizard ya preguntó la formalidad, manda ella", () => {
    // Su bloque es más específico (casual/semiformal/formal/gala); dos pisos a
    // la vez se contradicen y el modelo escoge.
    expect(pisoDeFormalidad(ctx({ objective: "evento", formality: "gala" }))).toBe("");
  });

  it("oficina prohíbe short y deportivo, sin exigir saco", () => {
    const p = pisoDeFormalidad(ctx({ objective: "oficina" }));
    expect(p).toContain("bermuda");
    expect(p).not.toContain("saco o blazer");
  });

  it("diario y aeropuerto no tienen piso", () => {
    // Ahí lo cómodo ES lo correcto — el barrido lo confirmó con 0% de fallo.
    for (const objective of ["diario", "viaje", "refrescar"]) {
      expect(pisoDeFormalidad(ctx({ objective })), objective).toBe("");
    }
  });

  it("no exige prendas que el clóset no tenga", () => {
    // Un piso absoluto contra un clóset pobre da lo peor de los dos mundos: el
    // motor no puede cumplirlo y al intentarlo saca algo peor que lo que habría
    // armado con lo que hay. (En el barrido el clóset hostil fallaba 47%.)
    const p = pisoDeFormalidad(ctx({ objective: "evento" }));
    expect(p).toContain("Si el clóset NO da para eso");
    expect(p).toContain("Jamás inventes prendas");
  });
});

describe("closetBlock — la marca de estilo (v32)", () => {
  const preppy = RECETAS_HOMBRE.find((r) => r.familia === "preppy")!;
  const items = [
    { id: "a", attrs: { nombre: "Polo marino" } },
    { id: "b", attrs: { nombre: "Chinos beige" } },
    { id: "c", attrs: { nombre: "Hoodie gris" } },
  ];

  it("marca las prendas del vocabulario de su familia y deja el resto sin marcar", () => {
    // El motor tenía polo y chino a mano y armó camiseta + pantalón negro +
    // tenis skate para alguien preppy: no le faltaban ingredientes, no los
    // reconoció. La marca le entrega hecho ese emparejamiento.
    const l = closetBlock(items, [preppy]).join("\n");
    expect(l).toMatch(/a: Polo marino.*tipo de prenda de: Preppy/);
    expect(l).toMatch(/b: Chinos beige.*tipo de prenda de: Preppy/);
    expect(l).toMatch(/c: Hoodie gris$/m);
  });

  it("sin recetas el clóset sale idéntico a como salía antes", () => {
    // Mujer no tiene recetas destiladas todavía: su prompt no debe cambiar ni
    // ganar una explicación de marcas que nunca aparecen.
    const l = closetBlock(items).join("\n");
    expect(l).not.toContain("tipo de prenda de:");
    expect(l).not.toContain("marcadas");
  });

  it("la marca informa, no ordena: deja entrar prendas sin marcar", () => {
    // Redactarla como filtro le quitaría al motor el clima, la ocasión y la
    // colorimetría, que mandan sobre la receta en la escalera de prioridades.
    const l = closetBlock(items, [preppy]).join("\n");
    expect(l).toContain("puede entrar perfectamente si el look la pide");
  });

  it("avisa que la marca es por tipo, no aprobación de esa prenda", () => {
    // Se vio mirando el prompt armado: unos tenis skate negros salen marcados
    // para el preppy, cuya receta los veta por nombre. Sin este aviso la marca
    // le daría al motor una autoridad que el emparejamiento no tiene.
    const l = closetBlock(items, [preppy]).join("\n");
    expect(l).toContain("por TIPO de prenda, no por color");
    expect(l).toContain("la receta manda sobre la marca");
  });

  it("no marca lo que no es ropa de calle", () => {
    const l = closetBlock(
      [{ id: "x", attrs: { nombre: "Traje de baño marino" } }],
      [preppy]
    ).join("\n");
    expect(l).not.toContain("tipo de prenda de:");
  });
});

describe("describeItem — la categoría (v33)", () => {
  it("dice qué ES la prenda, no solo cómo se llama", () => {
    // El caso que lo motivó: un ítem llamado "Traje marino de lana" que en la
    // base es categoría `saco`. Sin la categoría, el motor lo leyó como traje
    // completo y armó el look SIN pantalón — rompiendo su propia regla de "un
    // bottom siempre". Roberto lo cazó en el render, donde el generador de
    // imágenes había inventado un pantalón gris.
    const linea = describeItem({
      id: "x",
      attrs: { nombre: "Traje marino de lana", categoria: "saco", color_hex: "#1F2A44" },
    });
    expect(linea).toContain("[saco]");
  });

  it("sin categoría, la línea sale como antes", () => {
    // 2 de cada 3 prendas de la base no la declaran; se resuelve desde el
    // arquetipo al leer, pero si de plano no hay, no se inventa nada.
    const linea = describeItem({ id: "x", attrs: { nombre: "Camiseta negra" } });
    expect(linea).not.toContain("[");
    expect(linea).toContain("Camiseta negra");
  });
});

describe("los neutros no compiten con la paleta", () => {
  // Roberto lo cachó antes que la medición: "está dándole demasiado peso a la
  // paleta — son la guinda y la esmeralda porque soy invierno, y a las otras no
  // les da importancia; ahí es donde nos está matando la rotación, porque rota
  // pero priorizando".
  //
  // Y el dato le dio la razón: sus grises, azules suaves y denim claro salieron
  // 0-1 veces en 31 looks (el 20% del clóset se llevó el 2% del uso), mientras
  // el vino —4% de las prendas— se llevó el 12%. La causa: las paletas de
  // estación solo listan colores CON carácter (ninguna incluye un gris medio) y
  // el modelo leía esa ausencia como rechazo.
  const ctx = {
    gender: "hombre",
    objective: "diario",
    plan: null,
    lifestyle: null,
    tasteTags: [],
    archetype: null,
    season: "invierno",
    flow: null,
    items: [],
    weather: null,
    recentCombos: [],
    vetoes: [],
    timeOfDay: "dia",
    silueta: null,
    tasteSignal: EMPTY_TASTE_SIGNAL,
  } as unknown as EngineContext;

  it("dice que el gris y el azul suave son FONDO, no competidores", () => {
    const b = contextBlock(ctx).join("\n");
    expect(b).toContain("Los NEUTROS no entran en esa balanza");
    expect(b).toContain("no un color que compita");
  });

  it("aclara que faltar de la lista NO es motivo para descartar", () => {
    // Es la frase que arregla el error de lógica: una paleta sin grises no
    // significa que los grises queden mal.
    const b = contextBlock(ctx).join("\n");
    expect(b).toContain("NO es motivo para descartarlo");
  });

  it("no se pierde la lista de EVITA — esa sí es una preferencia real", () => {
    const b = contextBlock(ctx).join("\n");
    expect(b).toContain("EVITA cerca de la cara");
  });

  it("sin colorimetría no dice nada de neutros", () => {
    const b = contextBlock({ ...ctx, season: null } as EngineContext).join("\n");
    expect(b).not.toContain("Los NEUTROS");
  });
});
