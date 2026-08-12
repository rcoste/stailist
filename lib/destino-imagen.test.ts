import { describe, it, expect } from "vitest";
import { imagenDestino } from "@/lib/destino-imagen";

// Lo que este test blinda: que la card NUNCA se quede sin imagen y que NUNCA
// enseñe el destino equivocado. Un error aquí no truena nada — solo pone la
// Torre Eiffel sobre un viaje a Monterrey, todos los días, hasta que alguien
// lo vea.

describe("imagenDestino", () => {
  it("reconoce el destino escrito de varias formas", () => {
    expect(imagenDestino("Nueva York")).toBe("/destinos/nueva-york.webp");
    expect(imagenDestino("new york")).toBe("/destinos/nueva-york.webp");
    expect(imagenDestino("NYC")).toBe("/destinos/nueva-york.webp");
    // Acentos: el geocoder y la persona no siempre coinciden.
    expect(imagenDestino("París")).toBe("/destinos/paris.webp");
    expect(imagenDestino("paris")).toBe("/destinos/paris.webp");
  });

  it("manda los destinos de playa a la playa genérica", () => {
    // Cancún, Tulum y Vallarta son la MISMA foto — no llevan imagen propia.
    expect(imagenDestino("Cancún")).toBe("/destinos/playa.webp");
    expect(imagenDestino("Tulum")).toBe("/destinos/playa.webp");
    expect(imagenDestino("Puerto Vallarta")).toBe("/destinos/playa.webp");
  });

  it("en multidestino gana la primera parada", () => {
    expect(imagenDestino("París · Roma · Barcelona")).toBe("/destinos/paris.webp");
  });

  it("sin match por nombre, usa las ocasiones que la persona marcó", () => {
    expect(imagenDestino("Chiapas", ["playa"])).toBe("/destinos/playa.webp");
    expect(imagenDestino("Chiapas", ["ciudad", "noche"])).toBe("/destinos/ciudad.webp");
  });

  it("siempre devuelve algo — la card nunca se queda sin foto", () => {
    expect(imagenDestino("")).toBe("/destinos/ciudad.webp");
    expect(imagenDestino("Un pueblo que nadie conoce")).toBe("/destinos/ciudad.webp");
  });

  it("no casa un alias dentro de otro nombre", () => {
    expect(imagenDestino("Romania")).toBe("/destinos/ciudad.webp");
    expect(imagenDestino("Cancunito")).toBe("/destinos/ciudad.webp");
    // El geocoder corta en la coma, así que "Roma, Italia" llega como "Roma".
    expect(imagenDestino("Roma, Italia")).toBe("/destinos/roma.webp");
  });

  it("Roma Norte es una colonia de CDMX, no Italia", () => {
    // El caso que motivó los alias `exactos`. La versión anterior casaba por
    // palabra completa y "roma norte" contiene la palabra "roma" — así que
    // enseñaba el Coliseo sobre un viaje a la colonia. Es un error que no
    // truena nada: se ve todos los días hasta que alguien lo nota.
    expect(imagenDestino("Roma Norte")).toBe("/destinos/ciudad.webp");
    expect(imagenDestino("Roma Sur")).toBe("/destinos/ciudad.webp");
    // Y con ocasiones marcadas, respeta lo que la persona dijo del viaje.
    expect(imagenDestino("Roma Norte", ["playa"])).toBe("/destinos/playa.webp");
  });
});
