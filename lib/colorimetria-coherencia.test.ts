import { describe, expect, it } from "vitest";
import { SEASONS, seasonPalette, type Season } from "./colorimetria";

// EL CANDADO CONTRA "EL MISMO COLOR TE FAVORECE Y TE APAGA A LA VEZ".
//
// El caso real (2026-08-18): un invierno con guiño de otoño recibía "Oliva"
// #6B7A4C entre sus prestados y "Oliva apagado" #6B7A4C en su evita. El mismo
// hex en los dos lados. El motor leía "te funciona", el juez castigaba "te
// apaga la cara", y ninguno de los dos se equivocaba — el dato se contradecía.
//
// Nadie lo cazó porque no había nada que lo cazara: las dos listas se escriben
// en bloques distintos del archivo, a cientos de líneas de distancia, y agregar
// un color a una estación sin revisar la evita de sus vecinas no rompe nada.
// Le tocaba a 6 de 24 perfiles reales.
//
// Este test recorre TODAS las combinaciones de base y guiño, no sólo las que
// hoy tienen usuarias: la que no existe hoy es la que se descubre en producción.

const CLAVES = Object.keys(SEASONS) as Season[];
const hex = (c: { hex: string }) => c.hex.trim().toUpperCase();

describe("ninguna estación se contradice a sí misma", () => {
  // Esto NO es una frontera: un color en los colores Y en la evita de la MISMA
  // estación es un error de captura, y `seasonPalette` lo neutraliza en
  // silencio para no devolver una paleta contradictoria. Si este test truena,
  // el arreglo va en el DATO, no en la resolución.
  for (const clave of CLAVES) {
    it(`${clave}`, () => {
      const s = SEASONS[clave];
      const propios = new Set(s.colores.map(hex));
      const choque = s.evita.filter((e) => propios.has(hex(e))).map((e) => e.nombre);
      expect(
        choque,
        `${clave} lista ${choque.join(", ")} entre sus colores Y en su evita. ` +
          `Eso no es una frontera: es un error de dato en lib/colorimetria.`
      ).toEqual([]);
    });
  }
});

describe("la paleta resuelta nunca se contradice, en NINGUNA combinación", () => {
  for (const base of CLAVES) {
    for (const flow of [null, ...CLAVES]) {
      if (flow === base) continue;
      it(`${base} + guiño ${flow ?? "(sin)"}`, () => {
        const p = seasonPalette(base, flow);
        const buenos = new Set([...p.mejores, ...p.prestados].map(hex));
        const dobles = p.evita.filter((e) => buenos.has(hex(e))).map((e) => e.nombre);
        expect(
          dobles,
          `${dobles.join(", ")} sale como color favorable Y en la evita a la vez.`
        ).toEqual([]);
      });
    }
  }
});

describe("los tres conflictos conocidos quedan sin marcar, no en un bando", () => {
  // Lo que se blinda es que NO se resuelvan eligiendo ganador. Un color con
  // evidencia contradictoria cae en el tercer grupo de la colorimetría de este
  // producto: ni favorece ni juega en contra, y NO está vetado.
  const casos: { base: Season; flow: Season; hexColor: string; nombre: string }[] = [
    { base: "invierno", flow: "otono", hexColor: "#6B7A4C", nombre: "oliva" },
    { base: "primavera", flow: "invierno", hexColor: "#1A1A1A", nombre: "negro" },
    { base: "verano", flow: "invierno", hexColor: "#1A1A1A", nombre: "negro" },
  ];

  for (const c of casos) {
    it(`${c.nombre} en ${c.base} + ${c.flow}: fuera de las dos listas`, () => {
      const p = seasonPalette(c.base, c.flow);
      const h = c.hexColor.toUpperCase();
      expect(p.prestados.map(hex), "sigue anunciado como favorable").not.toContain(h);
      expect(p.evita.map(hex), "sigue penalizado").not.toContain(h);
    });
  }
});

describe("la resolución no se lleva por delante lo que no está en conflicto", () => {
  it("invierno + otoño conserva los prestados que SÍ cruzan limpios", () => {
    // Sólo el oliva estaba en conflicto: vino y chocolate se quedan.
    const p = seasonPalette("invierno", "otono");
    const nombres = p.prestados.map((c) => c.nombre);
    expect(nombres).toContain("Vino");
    expect(nombres).toContain("Chocolate");
  });

  it("invierno + otoño conserva su evita legítima", () => {
    // Camel y mostaza NO estaban en conflicto (ya iban con transfiere:false),
    // así que siguen penalizados como siempre.
    const nombres = seasonPalette("invierno", "otono").evita.map((c) => c.nombre);
    expect(nombres).toContain("Camel");
    expect(nombres).toContain("Mostaza");
  });

  it("sin guiño, la evita de la base queda intacta", () => {
    const conGuino = seasonPalette("invierno", "otono").evita.length;
    const sinGuino = seasonPalette("invierno", null).evita.length;
    expect(sinGuino).toBe(4);
    expect(sinGuino).toBeGreaterThan(conGuino);
  });

  it("los mejores de la base no se tocan cuando no hay conflicto", () => {
    const p = seasonPalette("invierno", "otono");
    expect(p.mejores.map((c) => c.nombre)).toContain("Negro");
  });
});

describe("bordes del dato", () => {
  it("el hex se compara sin importar mayúsculas ni espacios", () => {
    // Si mañana alguien escribe "#6b7a4c" o " #6B7A4C ", la resolución tiene
    // que seguir viéndolo como el mismo color.
    const p = seasonPalette("invierno", "otono");
    const todos = [...p.mejores, ...p.prestados, ...p.evita].map((c) => c.hex);
    expect(todos.every((h) => h === h.trim())).toBe(true);
  });

  it("una estación inválida no revienta: devuelve vacío", () => {
    const p = seasonPalette("no-existe" as Season, null);
    expect(p.mejores).toEqual([]);
    expect(p.evita).toEqual([]);
  });
});
