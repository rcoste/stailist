import { describe, expect, it } from "vitest";
import {
  medirCoherencia,
  rompeCoherencia,
  type PrendaCromatica,
} from "./coherencia-cromatica";

// Lo que se blinda NO es que marque el look feo — eso es lo fácil. Es que NO
// marque los dos looks buenos que cada señal por separado rechazaría. Una regla
// de color que dispara de más manda al juez a "reparar" lo que estaba bien, y
// así nació el mito de "marino con negro nunca" que este repo ya tuvo que
// revertir una vez (prompt v5 → v6).

const p = (nombre: string, hex: string): PrendaCromatica => ({ nombre, hex });

describe("el look que originó la regla", () => {
  // "Carbón bajo cero" (2026-08-17), hex reales de la base de producción.
  const carbonBajoCero = [
    p("camisa negra", "#1A1A1A"),
    p("saco de traje gris carbón", "#3A3C42"),
    p("pantalón de vestir gris carbón", "#3A3C42"),
    p("suéter marino", "#1F2A44"),
    p("botines café", "#6B4A33"),
  ];

  it("dispara las TRES señales", () => {
    const m = medirCoherencia(carbonBajoCero)!;
    expect(m.senales).toHaveLength(3);
    expect(m.familias).toBe(4);
    expect(m.bandas).toEqual(["profundo"]);
    expect(m.solitariaTemplada?.nombre).toBe("botines café");
    expect(m.solitariaTemplada?.temperatura).toBe("cálida");
  });

  it("y por lo tanto rompe la coherencia", () => {
    expect(rompeCoherencia(medirCoherencia(carbonBajoCero))).toBe(true);
  });

  it("cambiar SOLO la camisa a blanca no basta", () => {
    // AQUÍ LA REGLA CONTRADIJO AL STYLIST, y se quedó la regla.
    //
    // El diagnóstico a ojo fue "la camisa negra es la pieza que rompe todo;
    // cámbiala y se cae el 80% del problema". La medición dice que arregla el
    // CONTRASTE —aparece una segunda banda— pero deja intactas las otras dos
    // señales: siguen siendo cuatro familias y el botín sigue siendo la única
    // pieza cálida. Y eso es justo de lo que se quejó Roberto ("al usar tantos
    // colores es cuando se rompe"), no del contraste.
    //
    // Al releerlo con calma la regla tiene razón: con un traje carbón el zapato
    // clásico es negro; el botín café pide un contexto más cálido. Se deja el
    // test encima de la opinión a propósito.
    const conCamisaBlanca = carbonBajoCero.map((x) =>
      x.nombre === "camisa negra" ? p("camisa blanca", "#F2F0EB") : x
    );
    const m = medirCoherencia(conCamisaBlanca)!;
    expect(m.bandas.length).toBeGreaterThan(1); // el contraste sí se arregla
    expect(m.senales).toHaveLength(2);
    expect(rompeCoherencia(m)).toBe(true);
  });

  it("cambiar los botines a negro SÍ lo arregla", () => {
    // La pieza que de verdad decide. Con el botín negro desaparece la cálida
    // solitaria y bajan las familias a tres: queda sólo la señal de banda
    // única, que por sí sola es vestir tonal y es legítimo.
    const conBotinNegro = carbonBajoCero.map((x) =>
      x.nombre === "botines café" ? p("botines negros", "#171717") : x
    );
    const m = medirCoherencia(conBotinNegro)!;
    expect(m.familias).toBe(3);
    expect(m.solitariaTemplada).toBeNull();
    expect(rompeCoherencia(m)).toBe(false);
  });
});

describe("los looks buenos que NO se pueden marcar", () => {
  it("vestir tonal: todo carbón, negro y gris se queda", () => {
    // Una sola banda de valor: la señal 2 dispara sola, y sola no basta.
    // Rechazar esto sería rechazar un recurso avanzado que se ve muy bien.
    const tonal = [
      p("suéter negro", "#1A1A1A"),
      p("pantalón carbón", "#3A3C42"),
      p("abrigo gris oscuro", "#4A4C52"),
      p("botines negros", "#171717"),
    ];
    const m = medirCoherencia(tonal)!;
    expect(m.bandas).toEqual(["profundo"]);
    expect(m.senales).toHaveLength(1);
    expect(rompeCoherencia(m)).toBe(false);
  });

  it("el clásico traje marino con zapato café se queda", () => {
    // La señal 3 dispara sola (el café es la única pieza cálida) y sola no
    // basta. La camisa blanca abre una segunda banda y las familias son 3.
    const clasico = [
      p("saco marino", "#1F2A44"),
      p("pantalón marino", "#1F2A44"),
      p("camisa blanca", "#F2F0EB"),
      p("zapatos café", "#6B4A33"),
    ];
    const m = medirCoherencia(clasico)!;
    expect(m.solitariaTemplada?.nombre).toBe("zapatos café");
    expect(m.senales).toHaveLength(1);
    expect(rompeCoherencia(m)).toBe(false);
  });

  it("un look de muchas familias pero con contraste se queda", () => {
    // Señal 1 sola: cuatro familias, pero repartidas en dos bandas y sin
    // solitaria de temperatura. Eso es un look con variedad, no un accidente.
    const conContraste = [
      p("camisa blanca", "#F2F0EB"),
      p("suéter marino", "#1F2A44"),
      p("chino beige", "#C8B99C"),
      p("saco gris claro", "#B8B8BC"),
      p("mocasín café", "#6B4A33"),
    ];
    const m = medirCoherencia(conContraste)!;
    expect(m.familias).toBeGreaterThanOrEqual(4);
    expect(rompeCoherencia(m)).toBe(false);
  });
});

describe("cuándo se calla", () => {
  it("sin hex no juzga", () => {
    expect(
      medirCoherencia([
        { nombre: "camisa", hex: null },
        { nombre: "pantalón", hex: undefined },
        { nombre: "zapato" },
      ])
    ).toBeNull();
  });

  it("con menos de tres prendas medibles no juzga", () => {
    expect(
      medirCoherencia([p("camisa negra", "#1A1A1A"), p("pantalón carbón", "#3A3C42")])
    ).toBeNull();
  });

  it("las prendas sin hex no estorban a las que sí lo tienen", () => {
    const m = medirCoherencia([
      p("camisa negra", "#1A1A1A"),
      p("saco carbón", "#3A3C42"),
      p("suéter marino", "#1F2A44"),
      p("botines café", "#6B4A33"),
      { nombre: "cinturón sin analizar", hex: null },
    ])!;
    expect(m.familias).toBe(4);
    expect(rompeCoherencia(m)).toBe(true);
  });
});

describe("familias: dos oscuros de matiz lejano NO son el mismo color", () => {
  it("café y burdeos cuentan como dos familias", () => {
    // La lección que ya costó un falso negativo en cueros-que-no-se-hablan:
    // en RGB estos dos "se parecen"; en OKLCH sus matices están lejos.
    const m = medirCoherencia([
      p("cinturón café", "#5C4433"),
      p("mocasines burdeos", "#5C2A2E"),
      p("pantalón carbón", "#3A3C42"),
    ])!;
    expect(m.familias).toBe(3);
  });

  it("dos piezas del mismo traje cuentan como una familia", () => {
    const m = medirCoherencia([
      p("saco carbón", "#3A3C42"),
      p("pantalón carbón", "#3A3C42"),
      p("camisa blanca", "#F2F0EB"),
    ])!;
    expect(m.familias).toBe(2);
  });
});

describe("nudes y metales no son una decisión de color", () => {
  // El falso positivo que cazó la medición contra los looks reales, y que
  // apareció SOLO en clósets de mujer: la regla nació sobre un look de hombre.
  it("el tacón nude no cuenta como la pieza cálida solitaria", () => {
    const esmeralda = [
      p("Pantalones anchos azul marino", "#19192E"),
      p("Blusa de crepé esmeralda", "#3E5641"),
      p("Tacón nude", "#D9BFA8"),
      p("Arracadas doradas medianas", "#C9BFB2"),
    ];
    const m = medirCoherencia(esmeralda)!;
    expect(m.solitariaTemplada).toBeNull();
    expect(rompeCoherencia(m)).toBe(false);
  });

  it("pero un camel del mismo color SÍ cuenta: es un color elegido", () => {
    // El nude se exime por lo que ES, no por su hex — si no, se colaría
    // cualquier beige y la señal de temperatura se quedaría sin dientes.
    const m = medirCoherencia([
      p("Pantalones anchos azul marino", "#19192E"),
      p("Blusa de crepé esmeralda", "#3E5641"),
      p("Botín camel", "#D9BFA8"),
    ])!;
    expect(m.solitariaTemplada?.nombre).toBe("Botín camel");
  });
});
