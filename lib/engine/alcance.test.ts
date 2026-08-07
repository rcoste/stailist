import { describe, it, expect } from "vitest";
import { alcanceDeFormalidad, lineaAlcance, mensajeDeAlcance } from "./alcance";
import type { EngineItem } from "./prompt";

// El derecho del motor a decir "no puedo". Roberto: "boda de etiqueta y el
// usuario no tiene traje — debería decir NO, no 'ok, pues puede con unos jeans
// más un suéter'".
//
// El riesgo de este chequeo es el FALSO "no puedo": negarle a alguien un look
// que sí podía armar. Por eso la mitad de estos tests son de lo contrario —
// casos donde NO debe bloquear.

const it_ = (
  id: string,
  categoria: string,
  nombre: string,
  formalidad = "formal"
): EngineItem => ({ id, attrs: { categoria, nombre, formalidad } }) as EngineItem;

const TRAJE = [
  it_("1", "saco", "Blazer marino de lana"),
  it_("2", "bottom", "Pantalón de vestir gris"),
  it_("3", "top", "Camisa oxford blanca"),
  it_("4", "calzado", "Derbys de piel negros"),
];

const CASUAL = [
  it_("a", "top", "Playera blanca", "casual"),
  it_("b", "bottom", "Jeans azules", "casual"),
  it_("c", "calzado", "Tenis blancos", "casual"),
];

describe("cuándo SÍ debe decir que no puede", () => {
  it("el caso de Roberto: boda formal y solo hay jeans y playeras", () => {
    const a = alcanceDeFormalidad(CASUAL, "formal", "hombre");
    expect(a.faltaLoEsencial).toBe(true);
    expect(a.faltan).toContain("un saco o blazer");
    expect(a.faltan).toContain("un pantalón de vestir");
    expect(a.faltan).toContain("zapatos de vestir");
  });

  it("tener saco no basta si no hay con qué acompañarlo", () => {
    const a = alcanceDeFormalidad([...CASUAL, it_("s", "saco", "Blazer marino")], "formal");
    expect(a.faltaLoEsencial).toBe(true);
    expect(a.tiene).toContain("un saco o blazer");
    expect(a.faltan).toContain("un pantalón de vestir");
  });

  it("un pantalón de mezclilla NO cuenta como pantalón de vestir aunque venga marcado formal", () => {
    // El dato de la prenda puede estar mal; el nombre manda para lo que es
    // obvio. Un jean etiquetado "formal" sigue siendo un jean.
    const a = alcanceDeFormalidad(
      [it_("j", "bottom", "Jeans oscuros de mezclilla"), ...TRAJE.filter((i) => i.id !== "2")],
      "formal"
    );
    expect(a.faltan).toContain("un pantalón de vestir");
  });

  it("una sandalia de TACÓN sí es calzado de vestir — el caso real que rompió esto", () => {
    // Bloqueó el clóset de una usuaria con 82 prendas: sus "Tacones nude de
    // tira" vienen del catálogo con subtipo "sandalia" (correcto) y el
    // excluyente los tiraba. El excluyente valía sólo para calzado masculino.
    const tacon = {
      id: "t",
      attrs: {
        categoria: "calzado",
        nombre: "Tacones nude de tira",
        subtipo: "sandalia",
        formalidad: "formal",
      },
    } as unknown as EngineItem;
    const vestido = it_("v", "vestido", "Vestido largo animal print");
    expect(alcanceDeFormalidad([tacon, vestido], "formal").faltaLoEsencial).toBe(false);
  });

  it("los tenis no cierran el código aunque estén marcados de vestir", () => {
    const a = alcanceDeFormalidad(
      [...TRAJE.filter((i) => i.id !== "4"), it_("t", "calzado", "Tenis de piel blancos")],
      "formal"
    );
    expect(a.faltan).toContain("zapatos de vestir");
  });
});

describe("cuándo NO debe bloquear — el falso 'no puedo' es peor", () => {
  it("con traje completo pasa sin ruido", () => {
    expect(alcanceDeFormalidad(TRAJE, "formal")).toMatchObject({
      faltaLoEsencial: false,
      faltan: [],
    });
  });

  it("un vestido formal + calzado cierra el código por sí solo", () => {
    // Exigir saco Y pantalón le negaría el código a media población por su
    // forma de vestirlo.
    const a = alcanceDeFormalidad(
      [it_("v", "vestido", "Vestido largo negro"), it_("z", "calzado", "Zapatillas de tacón")],
      "formal"
    );
    expect(a.faltaLoEsencial).toBe(false);
  });

  it("para una MUJER, blusa + pantalón de vestir + tacón cierra sin saco", () => {
    // El saco es indispensable en el formal masculino ("traje y corbata" sin
    // saco no existe) y no en el femenino. Exigirlo a todas es el mismo sesgo
    // que tiró los tacones de tira.
    const sinSaco = [
      it_("t", "top", "Blusa de seda blanca"),
      it_("p", "bottom", "Pantalón de vestir negro"),
      it_("z", "calzado", "Zapatillas de tacón"),
    ];
    expect(alcanceDeFormalidad(sinSaco, "formal", "mujer").faltaLoEsencial).toBe(false);
    // Sin género declarado se usa el criterio permisivo: en la duda, pasar.
    expect(alcanceDeFormalidad(sinSaco, "formal", null).faltaLoEsencial).toBe(false);
    // Para un hombre, en cambio, ahí sí falta el saco.
    expect(alcanceDeFormalidad(sinSaco, "formal", "hombre").faltaLoEsencial).toBe(true);
  });

  it("casual y semiformal NUNCA bloquean: casi cualquier clóset da", () => {
    for (const f of ["casual", "semiformal"] as const) {
      expect(alcanceDeFormalidad(CASUAL, f).faltaLoEsencial).toBe(false);
    }
  });

  it("sin formalidad declarada no se pronuncia", () => {
    expect(alcanceDeFormalidad(CASUAL, null).faltaLoEsencial).toBe(false);
  });

  it("la camisa sola NO tira el veredicto — sería un colador", () => {
    const sinCamisa = TRAJE.filter((i) => i.id !== "3");
    const a = alcanceDeFormalidad(sinCamisa, "formal");
    expect(a.faltaLoEsencial).toBe(false);
    expect(a.faltan).toContain("una camisa de vestir");
  });
});

describe("gala: el esmoquin avisa, no bloquea", () => {
  it("con traje pero sin esmoquin, avisa sin negarse", () => {
    // El prompt ya dice que un traje oscuro impecable es la respuesta correcta
    // cuando no hay esmoquin: bloquear aquí contradiría al propio motor.
    const a = alcanceDeFormalidad(TRAJE, "gala");
    expect(a.faltaLoEsencial).toBe(false);
    expect(a.faltan).toEqual(["un esmoquin"]);
  });

  it("sin NADA de sastrería, gala sí bloquea", () => {
    expect(alcanceDeFormalidad(CASUAL, "gala").faltaLoEsencial).toBe(true);
  });
});

describe("cómo se dice", () => {
  it("el mensaje nombra lo que falta y no se disculpa", () => {
    const m = mensajeDeAlcance(alcanceDeFormalidad(CASUAL, "formal"), "una boda formal");
    expect(m).toContain("una boda formal");
    expect(m).toContain("saco");
    expect(m.toLowerCase()).not.toContain("lo siento");
    expect(m.toLowerCase()).not.toContain("disculpa");
  });

  it("la línea del prompt solo aparece cuando falta algo NO esencial", () => {
    expect(lineaAlcance(alcanceDeFormalidad(TRAJE, "formal"))).toBe("");
    expect(lineaAlcance(alcanceDeFormalidad(CASUAL, "formal"))).toBe("");
    const justo = alcanceDeFormalidad(TRAJE.filter((i) => i.id !== "3"), "formal");
    expect(lineaAlcance(justo)).toContain("camisa de vestir");
  });
});
