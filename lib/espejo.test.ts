import { describe, it, expect } from "vitest";
import { contextoEspejo } from "@/lib/espejo";
import { REGISTROS } from "@/lib/registro";

const base = {
  gender: "mujer" as const,
  season: "invierno",
  flow: null,
  weather: null,
  paraguas: false,
  vetos: [],
  momento: null,
  registro: null,
};

describe("contextoEspejo — lo que la amiga sabe antes de opinar", () => {
  it("sin clima, PROHÍBE hablar del clima", () => {
    // Sin esta línea el modelo se inventa el día ("hoy hace fresco") sobre una
    // persona de la que no sabe ni la ciudad. Y el permiso de ubicación se
    // niega a menudo, así que no es el caso raro: es la mitad de las veces.
    const c = contextoEspejo(base);
    expect(c).toMatch(/NO hables del clima/);
    expect(c).not.toMatch(/°C/);
  });

  it("con clima, da temperatura y condición", () => {
    const c = contextoEspejo({
      ...base,
      weather: { temp_c: 8.4, condition: "nublado" },
    });
    expect(c).toContain("8°C");
    expect(c).toContain("nublado");
    expect(c).not.toMatch(/NO hables del clima/);
  });

  it("la lluvia se dice aparte de la condición", () => {
    expect(
      contextoEspejo({ ...base, weather: { temp_c: 19, condition: "lluvia" }, paraguas: true })
    ).toContain("Va a llover");
  });

  it("dice qué la favorece Y qué la apaga", () => {
    // Las dos mitades hacen falta: sólo con la lista de favoritos, todo lo que
    // no esté en ella se lee como rechazo — el mismo error que costó medir en
    // el motor, donde los grises de Roberto salieron 0-1 veces en 31 looks.
    const c = contextoEspejo({ ...base, season: "invierno" });
    expect(c).toMatch(/le favorecen:/);
    expect(c).toMatch(/La apagan:/);
  });

  it("sin colorimetría en el perfil, no inventa una paleta", () => {
    const c = contextoEspejo({ ...base, season: null });
    expect(c).not.toMatch(/colorimetría/i);
  });

  it("los vetos viajan, para no sugerirle lo que no se pone", () => {
    expect(contextoEspejo({ ...base, vetos: ["shorts", "tacones"] })).toContain(
      "no se pone: shorts, tacones"
    );
  });
});

describe("contextoEspejo — la vara (v4)", () => {
  it("SIN registro, PROHÍBE adivinar la ocasión", () => {
    // Es el estado de donde venimos, y no era neutral: sin decir nada el modelo
    // rellenaba solo. En las lecturas reales tituló "Lino y domingo" y "Café en
    // el jardín" sin que nadie le dijera qué día era ni dónde estaba.
    const c = contextoEspejo(base);
    expect(c).toMatch(/NO SÉ a dónde va/);
    expect(c).toMatch(/no lo adivines/);
  });

  it("cada registro manda su vara, y son distintas entre sí", () => {
    const textos = REGISTROS.map((r) => contextoEspejo({ ...base, registro: r.key }));
    for (const t of textos) expect(t).not.toMatch(/NO SÉ a dónde va/);
    // Si dos registros mandaran el mismo texto, la chip sería decorativa.
    expect(new Set(textos).size).toBe(REGISTROS.length);
  });

  it("la vara va ANTES que la colorimetría y que el clima", () => {
    // El orden es el argumento: el registro decide si el look SIRVE; el color y
    // el clima afinan uno que ya sirve. Si el modelo lee primero la paleta,
    // contesta de color a alguien que va mal vestida para una boda.
    const c = contextoEspejo({
      ...base,
      registro: "especial",
      weather: { temp_c: 20, condition: "despejado" },
    });
    expect(c.indexOf("A dónde va")).toBeLessThan(c.indexOf("Su colorimetría"));
    expect(c.indexOf("A dónde va")).toBeLessThan(c.indexOf("El clima de hoy"));
  });

  it("'gym o un mandado' NO le pide arreglarse", () => {
    const c = contextoEspejo({ ...base, registro: "rapido" });
    expect(c).toContain("NO HAY VARA");
  });
});
