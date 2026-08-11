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

  it("SOLO la boda ofrece 'de playa' — es el único plan donde el lugar manda", () => {
    // La boda de destino es frecuente de verdad en México y hasta hoy no tenía
    // dónde caer: se pedía como "formal" y llegaba traje oscuro con suela de
    // cuero a la arena. Pero es de la boda, no un nivel más para todos: una
    // "cena con amigos de playa" no es un código de vestimenta.
    const conPlaya = TIPOS_EVENTO.filter((t) =>
      t.formalidadesQueAplican.includes("playa")
    ).map((t) => t.key);
    expect(conPlaya).toEqual(["boda"]);
  });
});

// "playa" NO es un escalón de la escalera: es el eje del LUGAR. Se ofrece, pero
// nunca se elige sola — quien no la toca recibe el código de boda de siempre.
describe("playa está fuera de la escalera de formalidad", () => {
  it("ningún plan la trae como default: siempre es una elección explícita", () => {
    // Si fuera default de algo, "subir un escalón de noche" desde playa no
    // tendría a dónde ir, y la boda de salón amanecería en guayabera.
    for (const t of TIPOS_EVENTO) expect(t.formalidad).not.toBe("playa");
    expect(formalidadDeEvento("boda", "noche")).toBe("formal");
    expect(formalidadDeEvento("boda", "dia")).toBe("formal");
  });

  it("lo que el motor recibe de playa contradice al traje, no lo matiza", () => {
    // El error que existe hoy: pedir boda de playa como "formal" y recibir
    // traje oscuro y suela de cuero para la arena. La línea tiene que decir
    // que ahí eso está MAL, no solo sugerir lino.
    const l = FORMALIDADES.find((f) => f.key === "playa")!.paraElMotor;
    expect(l).toContain("guayabera");
    expect(l.toLowerCase()).toContain("arena");
    expect(l).toMatch(/NADA de traje oscuro|fuera el zapato de vestir/);
    // Y sigue siendo una boda: el traje de baño no es un dress code.
    expect(l.toLowerCase()).toContain("blanco entero");
  });

  // El guard nuevo en formalidadDeEvento (`if (i === -1) return t.formalidad`)
  // no lo dispara NINGÚN dato real hoy: el único tipo con subeDeNoche (cena de
  // amigos) tiene formalidad "casual", que SÍ vive en la escalera. O sea que la
  // regresión que este guard previene —indexOf(-1) degradando en silencio a
  // "casual"— está a cero cobertura con los datos actuales. Se prueba
  // empujando un tipo sintético fuera de la escalera con subeDeNoche:true.
  it("si algún día un plan con 'playa' sube de noche, el guard no lo degrada a casual", () => {
    const sintetico = {
      key: "__test-playa-de-noche__",
      label: "test",
      formalidad: "playa" as const,
      paraElMotor: "test",
      preguntaDetalle: "test",
      formalidadesQueAplican: ["playa" as const],
      subeDeNoche: true,
    };
    TIPOS_EVENTO.push(sintetico);
    try {
      // Sin el guard, ESCALERA.indexOf("playa") da -1 y
      // ESCALERA[Math.min(-1 + 1, 3)] = ESCALERA[0] = "casual" — justo el bug
      // que el comentario del código describe.
      expect(formalidadDeEvento(sintetico.key, "noche")).toBe("playa");
    } finally {
      TIPOS_EVENTO.pop();
    }
  });

  // "playa" vive en dos catálogos distintos (Formalidad y TipoEvento no
  // comparten namespace) y es fácil confundirlos: playa NO es algo que se
  // pueda pedir como plan/evento, solo como ajuste de formalidad DENTRO de
  // "boda".
  it("'playa' es una formalidad, no un tipo de evento — pedirla como evento no encuentra nada", () => {
    expect(tipoEventoPorClave("playa")).toBeNull();
    expect(formalidadDeEvento("playa", "dia")).toBeNull();
  });
});
