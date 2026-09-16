import { describe, expect, it } from "vitest";
import { barriosDe, ciudadDeCoordenadas, ciudadDelViaje, conCiudad, elegirBarrio, elegirEscena, escenaParaPrompt, REGLAS_ESCENA } from "./tryon-escena";

// Lo que se blinda es la DECISIÓN de dónde se toma la foto, con planes
// reales de producción (tabla outfits, 2026-09-16), no el texto del prompt.
describe("elegirEscena", () => {
  it("el plan escrito manda aunque la ocasión diga 'diario'", () => {
    expect(elegirEscena({ plan: "Comida en restaurante con la familia de mi esposa", ocasion: "diario", semilla: "a" })).toBe("restaurante");
    expect(elegirEscena({ plan: "Ir al cine", ocasion: "diario", semilla: "a" })).toBe("calle-comercial");
    expect(elegirEscena({ plan: "Ir al supermercado", semilla: "a" })).toBe("calle-comercial");
    expect(elegirEscena({ plan: "Mi cumpleaños", semilla: "a" })).toBe("restaurante");
  });

  it("una cita médica NO va a un restaurante (ni a una sala de espera)", () => {
    expect(elegirEscena({ plan: "Cita medica", semilla: "a" })).toBe("calle-ciudad");
    expect(elegirEscena({ plan: "cita con mi novia", semilla: "a" })).toBe("restaurante");
  });

  it("una reunión familiar no cae en la oficina", () => {
    expect(elegirEscena({ plan: "reunión familiar en casa de mi tía", semilla: "a" })).toBe("restaurante");
  });

  it("sin plan, usa la ocasión del look", () => {
    expect(elegirEscena({ ocasion: "oficina", semilla: "a" })).toBe("oficina");
    expect(elegirEscena({ ocasion: "evento", semilla: "a" })).toBe("evento");
    expect(elegirEscena({ ocasion: "playa", semilla: "a" })).toBe("playa");
  });

  it("el look del día rota entre escenas cotidianas, estable por look", () => {
    const una = elegirEscena({ ocasion: "diario", semilla: "look-1" });
    expect(elegirEscena({ ocasion: "diario", semilla: "look-1" })).toBe(una);
    const vistas = new Set(Array.from({ length: 40 }, (_, i) => elegirEscena({ ocasion: "diario", semilla: `look-${i}` })));
    expect(vistas.size).toBeGreaterThan(2);
    for (const v of vistas) expect(["calle-ciudad", "cafe", "calle-residencial", "plaza-minimal", "parque", "calle-comercial"]).toContain(v);
  });
});

describe("escenaParaPrompt", () => {
  it("las reglas de luz van SIEMPRE, también en una cena", () => {
    const p = escenaParaPrompt({ plan: "cena de aniversario", semilla: "x" });
    expect(p).toContain(REGLAS_ESCENA);
    expect(p).toMatch(/BRIGHTLY/);
    expect(p).not.toMatch(/plain flat light-grey wall/i);
  });

  it("un viaje de una sola parada se ubica en esa ciudad", () => {
    expect(escenaParaPrompt({ ocasion: "ciudad", ciudad: "París", semilla: "x" })).toContain("in París");
  });

  it("con lluvia, bajo techo", () => {
    expect(escenaParaPrompt({ clima: { condition: "Lluvia ligera" }, semilla: "x" })).toMatch(/rainy day/);
    expect(escenaParaPrompt({ clima: { condition: "despejado" }, semilla: "x" })).not.toMatch(/rainy/);
  });
});

describe("ciudadDelViaje", () => {
  it("una parada → su ciudad, sin estado ni país", () => {
    expect(ciudadDelViaje([{ lugar: "Madrid, Comunidad Autónoma de Madrid, España" }], "Madrid")).toBe("Madrid");
  });
  it("varias paradas → no se inventa en cuál cae el look", () => {
    expect(ciudadDelViaje([{ lugar: "Madrid" }, { lugar: "Roma" }], "Madrid · Roma")).toBeNull();
  });
  it("viaje viejo sin paradas → la columna lugar", () => {
    expect(ciudadDelViaje(null, "Las Vegas")).toBe("Las Vegas");
  });
});

describe("barrios de la Ciudad de México", () => {
  it("reconoce la ciudad con sus alias", () => {
    for (const c of ["Ciudad de México", "CDMX", "Mexico City"]) expect(barriosDe(c).length).toBe(7);
    expect(barriosDe("Guadalajara")).toEqual([]);
  });

  it("nadie va a la oficina a San Ángel ni a Coyoacán", () => {
    for (let i = 0; i < 30; i++) {
      const b = elegirBarrio({ ciudad: "CDMX", semilla: `l${i}` }, "oficina");
      expect(["polanco", "santa-fe"]).toContain(b?.id);
    }
  });

  it("con barrio, el prompt lo describe y prohíbe el cliché", () => {
    const p = escenaParaPrompt({ ciudad: "CDMX", barrio: "roma", semilla: "x" });
    expect(p).toContain("Colonia Roma");
    expect(p).toMatch(/no yellow, sepia/);
  });
});

describe("la ciudad del día a día", () => {
  it("solo marca la CDMX, sin colonia ni coordenadas", () => {
    expect(ciudadDeCoordenadas(19.4326, -99.1332)).toBe("Ciudad de México"); // Centro
    expect(ciudadDeCoordenadas(19.3594, -99.2766)).toBe("Ciudad de México"); // Santa Fe
    expect(ciudadDeCoordenadas(25.4232, -101.0053)).toBeNull(); // Saltillo → escenas genéricas
    expect(ciudadDeCoordenadas(undefined, undefined)).toBeNull();
  });
  it("el clima guardado lleva la ciudad solo si se detectó", () => {
    expect(conCiudad({ temp_c: 20 }, "Ciudad de México")).toEqual({ temp_c: 20, ciudad: "Ciudad de México" });
    expect(conCiudad({ temp_c: 20 }, null)).toEqual({ temp_c: 20 });
    expect(conCiudad(null, "Ciudad de México")).toBeNull();
  });
  it("un look de CDMX sin plan cae en un barrio", () => {
    expect(escenaParaPrompt({ ciudad: "Ciudad de México", semilla: "x" })).toMatch(/Mexico City/);
  });
});
