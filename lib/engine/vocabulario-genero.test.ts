import { describe, expect, it } from "vitest";
import { tipoDePrenda } from "./vocabulario";
import { revisarEjecucion } from "./reglas-ejecucion";
import type { EngineItem } from "./prompt";

// EL CANDADO CONTRA "LA REGLA CAZA EL ERROR EN UN CLÓSET DE HOMBRE Y NO EN UNO
// DE MUJER".
//
// Lo que se midió el 2026-08-18, sobre 842 prendas reales de la base:
//
//     hombre   306/306 = 100.0%
//     mujer    437/536 =  81.5%   ← una de cada cinco, invisible
//
// El vocabulario nació masculino —camisa, polo, chino, mocasín— y nunca se le
// agregó el guardarropa femenino. Faltaban ENTEROS: blusa, top, body, corsé,
// tacón, flats, bailarinas, mules, arracadas.
//
// POR QUÉ IMPORTA Y NO ES COSMÉTICO: `zona-duplicada` y varias reglas más
// preguntan por ZONA (`tipoDePrenda(...)?.zona`). Cuando devuelve null, la
// prenda no existe para esas reglas. Resultado medido: dos pares de tacones en
// un look pasaban sin marcarse, y dos blusas también — el MISMO error que en un
// clóset de hombre se caza a la primera.
//
// Es la quinta vez que este proyecto tropieza con un default masculino en las
// reglas de vestir. Las cuatro anteriores se cazaron leyendo código; ésta se
// cazó midiendo contra clósets reales, que es la única forma que ha funcionado.

const p = (nombre: string): EngineItem =>
  ({ id: nombre, attrs: { nombre, color_hex: "#222222" } }) as never;

/** Nombres REALES de la base, tal cual los escribió la visión al leer la foto. */
const REALES_MUJER = [
  "Blusa blanca",
  "Blusa de seda negra",
  "Blusa negra de seda con cuello camisero",
  "Top negro de tirantes",
  "Top halter negro fluido",
  "Top strapless blanco",
  "Crop top blanco",
  "Top corto de lino azul",
  "Bodysuit negro",
  "Body negro con brillos",
  "Corsé de encaje con lentejuelas",
  "Tacón nude",
  "Tacón negro de vestir",
  "Tacones nude de tira",
  "Zapatillas de tacón marrón",
  "Flats nude",
  "Bailarinas trenzadas negras",
  "Ballerinas negras",
  "Mary Janes negras",
  "Mules de tacón negras",
  "Arracadas doradas medianas",
  "Brazalete plateado ancho",
  "Gargantilla marrón",
  "Clutch ovalado dorado",
];

describe("el vocabulario reconoce el guardarropa femenino", () => {
  for (const nombre of REALES_MUJER) {
    it(`"${nombre}"`, () => {
      expect(
        tipoDePrenda(nombre),
        `El vocabulario no reconoce "${nombre}", que existe en la base. Toda ` +
          `regla que pregunte por zona es ciega a esta prenda.`
      ).not.toBeNull();
    });
  }
});

describe("cada prenda cae en la zona correcta", () => {
  const esperado: [string, string][] = [
    ["Blusa de seda negra", "torso"],
    ["Top halter negro fluido", "torso"],
    ["Crop top blanco", "torso"],
    ["Bodysuit negro", "torso"],
    ["Tacón nude", "pie"],
    ["Zapatillas de tacón marrón", "pie"],
    ["Flats nude", "pie"],
    ["Mary Janes negras", "pie"],
    ["Mules de tacón negras", "pie"],
    ["Arracadas doradas medianas", "accesorio"],
    ["Clutch ovalado dorado", "accesorio"],
    // El sujetador deportivo NO es ropa de calle, igual que el short de baño:
    // contarlo como torso haría creer que hay con qué armar un look.
    ["Top deportivo negro de soporte medio", "no-calle"],
  ];
  for (const [nombre, zona] of esperado) {
    it(`"${nombre}" → ${zona}`, () => {
      expect(tipoDePrenda(nombre)?.zona).toBe(zona);
    });
  }
});

describe("el orden no le robó nada a las reglas que ya existían", () => {
  // Las trampas del español que el orden del archivo ya resolvía. Si alguna se
  // rompe, una regla nueva se metió en medio.
  const intactos: [string, string][] = [
    ["Zapatilla deportiva blanca", "pie"], // no la reclama "tacón"
    ["Náutico café", "pie"],
    ["Camisa oxford blanca", "torso"], // no la reclama el zapato oxford
    ["Oxford negro de charol", "pie"],
    ["Polo de punto marino", "torso"],
    ["Vestido camisero verde", "torso"], // no la reclama "camisa"
    ["Saco de traje gris", "capa"], // no la reclama "traje"
  ];
  for (const [nombre, zona] of intactos) {
    it(`"${nombre}" sigue siendo ${zona}`, () => {
      expect(tipoDePrenda(nombre)?.zona).toBe(zona);
    });
  }

  it('"Topsider" no se lee como un top', () => {
    // `\btop\b` no casa dentro de "topsider" — pero si alguien quita la
    // frontera, este test lo caza antes de que un náutico se vuelva una blusa.
    expect(tipoDePrenda("Topsider café")?.zona).toBe("pie");
  });
});

describe("el MISMO error se caza en los dos guardarropas", () => {
  // Esto es lo que de verdad se blinda: no que el diccionario tenga entradas,
  // sino que las reglas muerdan igual.
  const casos: [string, EngineItem[]][] = [
    [
      "dos calzados · hombre",
      [p("Camisa blanca"), p("Pantalón de vestir gris"), p("Mocasín negro"), p("Zapato formal café")],
    ],
    [
      "dos calzados · mujer",
      [p("Blusa blanca"), p("Pantalón de vestir gris"), p("Tacón negro de vestir"), p("Tacón nude")],
    ],
    [
      "dos de torso · hombre",
      [p("Suéter gris"), p("Suéter negro"), p("Pantalón de vestir gris"), p("Mocasín negro")],
    ],
    [
      "dos de torso · mujer",
      [p("Blusa blanca"), p("Blusa de seda negra"), p("Pantalón de vestir gris"), p("Tacón negro de vestir")],
    ],
  ];
  for (const [etiqueta, look] of casos) {
    it(etiqueta, () => {
      const reglas = revisarEjecucion(look).map((x) => x.regla);
      expect(reglas, `"${etiqueta}" no dispara zona-duplicada`).toContain(
        "zona-duplicada"
      );
    });
  }
});
