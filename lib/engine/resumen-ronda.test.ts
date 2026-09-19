import { describe, expect, it } from "vitest";
import { resumirRonda, resumirPorVariante } from "./resumen-ronda";
import { normalizarCritica, DEFECTOS_VALIDOS } from "./juez-stylist";
import { hechoDelAbrigo } from "./juez-stylist";
import { ABRIGA_DE_VERDAD, resuelveElFrio } from "./reglas-ejecucion";
import type { CriticaStylist, Gravedad } from "./juez-stylist";

// Lo que se blinda: que el orden de los temas sirva para DECIDIR qué arreglar.
// Un resumen ordenado por frecuencia a secas pondría diez "detalles" arriba de
// un fallo que tira looks, y quien lo lea arreglaría lo barato en vez de lo
// caro. Ese orden es todo el valor del archivo.

const h = (defecto: string, gravedad: Gravedad, pieza = "camisa negra") => ({
  pieza,
  problema: `problema de ${defecto}`,
  arreglo: `cambia ${pieza}`,
  gravedad,
  defecto,
});

const critica = (hallazgos: ReturnType<typeof h>[]): CriticaStylist => ({
  resumen: "traje carbón, camisa negra, botín café",
  hallazgos,
  loQueFunciona: "el traje está bien emparejado",
});

describe("el orden de los temas es lo que hace útil el resumen", () => {
  it("lo que ROMPE va arriba aunque salga menos veces", () => {
    const r = resumirRonda([
      critica([h("color", "rompe")]),
      critica([h("plano", "detalle")]),
      critica([h("plano", "detalle")]),
      critica([h("plano", "detalle")]),
    ]);
    // "plano" sale 3 veces y "color" 1, pero color tira looks.
    expect(r.temas[0].defecto).toBe("color");
    expect(r.temas[0].rompen).toBe(1);
    expect(r.temas[1].defecto).toBe("plano");
    expect(r.temas[1].looks).toBe(3);
  });

  it("a igual gravedad, manda en cuántos LOOKS apareció", () => {
    const r = resumirRonda([
      critica([h("clima", "resta")]),
      critica([h("color", "resta")]),
      critica([h("color", "resta")]),
    ]);
    expect(r.temas[0].defecto).toBe("color");
    expect(r.temas[0].looks).toBe(2);
  });

  it("un look con dos hallazgos del mismo tema cuenta UNA vez en `looks`", () => {
    // Si contara hallazgos, un solo look ruidoso podría inventar un tema
    // recurrente que no existe.
    const r = resumirRonda([critica([h("color", "resta"), h("color", "detalle")])]);
    expect(r.temas[0].looks).toBe(1);
    expect(r.temas[0].hallazgos).toBe(2);
  });

  it("los ejemplos salen de los hallazgos MÁS graves, no de los primeros", () => {
    const r = resumirRonda([
      critica([h("color", "detalle", "cinturón")]),
      critica([h("color", "detalle", "calcetín")]),
      critica([h("color", "rompe", "camisa negra")]),
    ]);
    expect(r.temas[0].ejemplos[0].pieza).toBe("camisa negra");
  });
});

describe("los conteos de cabecera", () => {
  it("distingue looks limpios, con hallazgos y con roturas", () => {
    const r = resumirRonda([
      critica([]),
      critica([h("color", "detalle")]),
      critica([h("clima", "rompe")]),
    ]);
    expect(r.looks).toBe(3);
    expect(r.conHallazgos).toBe(2);
    expect(r.conRotos).toBe(1);
  });

  it("una ronda sin hallazgos no inventa temas", () => {
    const r = resumirRonda([critica([]), critica([])]);
    expect(r.temas).toEqual([]);
    expect(r.conHallazgos).toBe(0);
  });
});

describe("por variante: no dice cuál ganó, dice EN QUÉ difieren", () => {
  it("separa los temas de cada lado", () => {
    const r = resumirPorVariante({
      produccion: [critica([h("plano", "detalle")])],
      "sin-coherencia-cromatica": [critica([h("color", "rompe")])],
    });
    expect(r.produccion.temas[0].defecto).toBe("plano");
    expect(r["sin-coherencia-cromatica"].temas[0].defecto).toBe("color");
    expect(r["sin-coherencia-cromatica"].conRotos).toBe(1);
    expect(r.produccion.conRotos).toBe(0);
  });
});

describe("normalizarCritica: el candado del vocabulario", () => {
  it("tira hallazgos con un defecto inventado", () => {
    // Un defecto fuera del vocabulario rompería el conteo EN SILENCIO: saldría
    // un tema que nadie sabe de dónde salió.
    const c = normalizarCritica({
      resumen: "x",
      loQueFunciona: "y",
      hallazgos: [
        h("color", "rompe"),
        { ...h("color", "rompe"), defecto: "vibra-rara" },
      ],
    });
    expect(c.hallazgos).toHaveLength(1);
    expect(c.hallazgos[0].defecto).toBe("color");
  });

  it("tira hallazgos sin arreglo: la mitad que ninguna rúbrica da", () => {
    const c = normalizarCritica({
      hallazgos: [{ ...h("color", "rompe"), arreglo: "" }],
    });
    expect(c.hallazgos).toEqual([]);
  });

  it("tira 'plano': no es un hallazgo aunque el modelo insista (js8)", () => {
    // El prompt se lo prohíbe desde js5 y el examen de los 460 looks votados
    // muestra que lo ignoraba: 3 veces en los 👎 de Roberto contra 36 en sus
    // 👍. Un segundo instrumento que no comparte nada con éste (el retador de
    // Jev) le midió la separación más baja de las siete preguntas.
    const c = normalizarCritica({ hallazgos: [h("plano", "rompe")] });
    expect(c.hallazgos).toEqual([]);
  });

  it("tirar 'plano' no se lleva los demás hallazgos del look", () => {
    const c = normalizarCritica({
      hallazgos: [h("plano", "resta"), h("color", "rompe")],
    });
    expect(c.hallazgos.map((x) => x.defecto)).toEqual(["color"]);
  });

  it("'plano' sigue en el vocabulario: es con el que Roberto vota", () => {
    // El filtro es sobre lo que dice el JUEZ, no sobre lo que puede marcar él.
    expect(DEFECTOS_VALIDOS).toContain("plano");
  });

  it("ordena por gravedad aunque el modelo los devuelva revueltos", () => {
    const c = normalizarCritica({
      // "plano" era el ejemplo de "detalle" aquí hasta js8, que lo filtra.
      // El test es sobre el ORDEN, así que el ejemplo se cambia por uno que
      // sobreviva — si usara uno filtrado mediría dos cosas a la vez.
      hallazgos: [h("capas", "detalle"), h("color", "rompe"), h("clima", "resta")],
    });
    expect(c.hallazgos.map((x) => x.gravedad)).toEqual(["rompe", "resta", "detalle"]);
  });

  it("el vocabulario es el mismo que usa Roberto al votar", () => {
    // Si estas dos listas se separan, los hallazgos del juez y las marcas
    // humanas dejan de poder contarse juntos.
    expect(DEFECTOS_VALIDOS).toContain("color");
    expect(DEFECTOS_VALIDOS).toContain("proporcion");
    expect(DEFECTOS_VALIDOS.length).toBeGreaterThanOrEqual(7);
  });
});

describe("la vara del abrigo que cierra la discusión del frío (js9)", () => {
  it("reconoce las capas que SÍ resuelven el frío", () => {
    for (const n of ["Abrigo de lana camel", "Parka verde", "Puffer negro", "Gabardina beige", "Trench", "Chamarra acolchada azul"])
      expect(resuelveElFrio(n.toLowerCase()), n).toBe(true);
  });

  it("NO absuelve las que el prompt condena a 8° como única capa", () => {
    // Éste es el bug que se habría metido reusando ABRIGA_DE_VERDAD, que sí
    // las incluye: un bomber a 8° dejaría de marcarse.
    for (const n of ["Blazer marino", "Chaqueta ligera", "Bomber negro", "Cazadora de piel", "Softshell gris"])
      expect(resuelveElFrio(n.toLowerCase()), n).toBe(false);
  });

  it("un CHALECO acolchado NO resuelve el frío: va sin mangas", () => {
    // El catálogo tiene "chaleco acolchado marino" y "chaleco acolchado mujer",
    // los dos sin mangas. `acolchad` los cazaba y el juez recibía "el frío está
    // resuelto" para alguien con los brazos al aire a 8°.
    for (const n of ["Chaleco acolchado marino", "Chaleco acolchado mujer", "Gilet negro"])
      expect(resuelveElFrio(n.toLowerCase()), n).toBe(false);
  });

  it("es estrictamente más estrecha que la vara ancha, no otra cosa", () => {
    // Si algún día divergen por otro lado, esto lo caza: todo lo que resuelve
    // el frío tiene que seguir contando como "algo más que sastre".
    for (const n of ["abrigo de lana", "parka", "puffer", "gabardina", "trench", "anorak", "acolchada"]) {
      expect(resuelveElFrio(n)).toBe(true);
      expect(ABRIGA_DE_VERDAD.test(n), n).toBe(true);
    }
  });
});

describe("el hecho del abrigo que llega al juez (js9)", () => {
  const p = (...ns: string[]) => ns.map((nombre) => ({ nombre }));

  it("sin abrigo no manda nada: una línea vacía se filtra del mensaje", () => {
    expect(hechoDelAbrigo(p("Camisa blanca", "Jeans negros", "Tenis grises"))).toBe("");
  });

  it("con abrigo manda el hecho, lo NOMBRA y prohíbe marcar clima", () => {
    // Nombrar la prenda es el punto: una regla general ya estaba en el prompt
    // desde js5 y el juez la ignoraba. Un dato sobre el look que tiene enfrente
    // es más difícil de ignorar que una instrucción abstracta.
    const linea = hechoDelAbrigo(p("Camiseta gris", "Abrigo de lana camel", "Botines"));
    expect(linea).toContain("Abrigo de lana camel");
    expect(linea).toContain("[clima]");
    expect(linea).toContain("RESUELTO");
  });

  it("SÓLO SUPRIME, NUNCA INVITA", () => {
    // El primer intento cerraba sugiriendo marcar [capas] en su lugar: quitaba
    // un motivo y regalaba otro, y las falsas alarmas subieron de 27% a 38%.
    const linea = hechoDelAbrigo(p("Parka verde", "Jeans"));
    expect(linea).not.toContain("[capas]");
    expect(linea.toLowerCase()).not.toContain("sí es hallazgo");
  });

  it("un blazer, un bomber o un chaleco NO cierran la discusión del frío", () => {
    expect(hechoDelAbrigo(p("Blazer marino", "Pantalón de vestir"))).toBe("");
    expect(hechoDelAbrigo(p("Bomber negro", "Jeans"))).toBe("");
    expect(hechoDelAbrigo(p("Chaleco acolchado marino", "Camisa"))).toBe("");
  });

  it("una prenda sin nombre no truena: la base guarda JSON, no promesas", () => {
    expect(hechoDelAbrigo([{ nombre: undefined as unknown as string }])).toBe("");
  });
});
