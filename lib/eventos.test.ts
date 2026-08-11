import { describe, it, expect } from "vitest";
import {
  TIPOS_EVENTO,
  formalidadDeEvento,
  lineaTipoEvento,
  tipoEventoPorClave,
} from "./eventos";
import { FORMALIDADES } from "./formalidad";

// El catálogo de eventos nace de que "evento" + nivel de formalidad no alcanza:
// una boda y una graduación son las dos "formal" y no se resuelven igual.

describe("el catálogo", () => {
  it("cada tipo declara una formalidad que existe en la tabla", () => {
    const claves = new Set(FORMALIDADES.map((f) => f.key));
    for (const t of TIPOS_EVENTO) expect(claves).toContain(t.formalidad);
  });

  it("cada tipo dice al motor lo que la formalidad NO captura", () => {
    // Si el paraElMotor solo repitiera el nivel de formalidad, el catálogo no
    // aportaría nada: ese dato ya viaja por su propio campo.
    for (const t of TIPOS_EVENTO) {
      expect(t.paraElMotor.length).toBeGreaterThan(40);
      expect(t.label).not.toBe("");
    }
  });

  it("las claves no se repiten", () => {
    const claves = TIPOS_EVENTO.map((t) => t.key);
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe("formalidadDeEvento — el momento importa", () => {
  it("una cena con amigos sube un escalón de noche", () => {
    expect(formalidadDeEvento("cena-amigos", "dia")).toBe("casual");
    expect(formalidadDeEvento("cena-amigos", "noche")).toBe("semiformal");
  });

  it("una comida familiar NO sube: de noche sigue siendo casual", () => {
    // Solo suben los que lo declaran. Sin esto, cualquier plan de noche se
    // arreglaría de más y la comida en casa de los papás pediría saco.
    expect(formalidadDeEvento("comida-familiar", "noche")).toBe("casual");
  });

  it("la BODA de noche NO sube a gala — en México eso es traje oscuro, no esmoquin", () => {
    // Lo cazó la primera corrida del eval: con boda subiendo, el juez exigía
    // esmoquin con moño y charol en los dos looks. El black tie se especifica
    // en la invitación y se elige a mano; por default sería pedir un esmoquin
    // que casi nadie tiene.
    expect(formalidadDeEvento("boda", "noche")).toBe("formal");
    expect(formalidadDeEvento("fiesta", "noche")).toBe("semiformal");
  });

  it("solo la cena con amigos sube — y nunca más de un escalón", () => {
    const suben = TIPOS_EVENTO.filter((t) => t.subeDeNoche).map((t) => t.key);
    expect(suben).toEqual(["cena-amigos"]);
    expect(tipoEventoPorClave("cena-amigos")!.formalidad).toBe("casual");
  });

  it("sin tipo elegido no inventa formalidad", () => {
    expect(formalidadDeEvento(null, "noche")).toBeNull();
    expect(formalidadDeEvento("no-existe", "dia")).toBeNull();
  });
});

describe("lo que llega al motor", () => {
  it("la boda trae su regla propia: nada de blanco entero", () => {
    expect(lineaTipoEvento("boda")).toContain("blanco");
  });

  it("el funeral pide NEGRO y descarta el marino explícitamente", () => {
    // Roberto, calibrando un look de funeral: "era un traje azul marino. Para
    // funeral debe ser negro; sería menos peor una camisa blanca, pantalón
    // negro y un suéter gris oscuro — se ve mejor, pero no azul". En México el
    // luto es negro y el marino se lee como oficina.
    const l = lineaTipoEvento("funeral");
    expect(l).toContain("NEGRO");
    expect(l).toContain("AZUL MARINO NO");
    // Y la salida cuando el clóset no da un traje negro: piezas sueltas
    // oscuras antes que un traje del color equivocado.
    expect(l).toContain("piezas sueltas oscuras");
  });

  it("el funeral pone el no-destacar por encima del estilo y la colorimetría", () => {
    // Es el único caso donde una preferencia personal cede: si el juez de
    // estilo o el de color pesaran aquí, empujarían justo a lo contrario.
    const l = lineaTipoEvento("funeral");
    expect(l).toContain("MANDA");
    expect(l.toLowerCase()).toContain("colorimetría");
  });

  it("sin tipo, no manda línea (no inventa un evento)", () => {
    expect(lineaTipoEvento(null)).toBe("");
  });
});

// Los campos del paso "detalle" del wizard (personalización por plan). El
// invariante que blindan: el default —y su subida de noche— SIEMPRE es una de
// las opciones ofrecidas, o el wizard mostraría pre-seleccionado algo que no
// está en la lista.
describe("formalidades que aplican por plan", () => {
  it.each(TIPOS_EVENTO.map((t) => [t.label, t] as const))(
    "%s: su default (y el de noche) está entre las opciones que ofrece",
    (_label, t) => {
      expect(t.formalidadesQueAplican.length).toBeGreaterThanOrEqual(2);
      expect(t.formalidadesQueAplican).toContain(t.formalidad);
      expect(t.formalidadesQueAplican).toContain(
        formalidadDeEvento(t.key, "noche")
      );
      // Y el copy personalizado existe — la queja era "se siente copy-paste".
      expect(t.preguntaDetalle.length).toBeGreaterThan(20);
    }
  );

  it("la cena con amigos NO ofrece esmoquin (el absurdo que delató la máquina)", () => {
    const cena = TIPOS_EVENTO.find((t) => t.key === "cena-amigos")!;
    expect(cena.formalidadesQueAplican).not.toContain("gala");
  });
});
