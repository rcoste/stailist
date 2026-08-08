import { describe, it, expect } from "vitest";
import { contextoEspejo } from "@/lib/espejo";

const base = {
  gender: "mujer" as const,
  season: "invierno",
  flow: null,
  weather: null,
  paraguas: false,
  vetos: [],
  momento: null,
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
