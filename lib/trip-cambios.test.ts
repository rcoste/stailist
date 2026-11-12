import { describe, expect, it } from "vitest";
import { anterioresDelLugar, rechazadasNetas, type CambioViaje } from "@/lib/trip-cambios";

// Los casos salen de una noche real (2026-11-12): una persona probó 8 pares de
// zapatos para el mismo lugar en 5 minutos, yendo y viniendo, y dijo "ya no me
// deja elegir la misma prenda anterior".

// Del más VIEJO al más nuevo (como pasaron); las funciones los reciben al revés.
const noche = (...pasos: [string, string, string?][]): CambioViaje[] =>
  pasos.map(([from, to, trip = "viaje-1"]) => ({ ideal: "Botas tipo sneaker negras", from, to, trip_id: trip })).reverse();

describe("anterioresDelLugar", () => {
  it("devuelve las que ya estuvieron en el lugar, la más reciente primero", () => {
    const c = noche(["Botas negras", "Tenis Ballet"], ["Tenis Ballet", "Chukka gamuza"], ["Chukka gamuza", "Tenis bota café"]);
    expect(anterioresDelLugar(c, { ideal: "Botas tipo sneaker negras", index: 4 })).toEqual([
      "Tenis bota café",
      "Chukka gamuza",
      "Tenis Ballet",
      "Botas negras",
    ]);
  });

  it("incluye la propuesta original de la app (el primer `from`)", () => {
    const c = noche(["Tenis Golden Goose", "Tenis casuales beige"]);
    expect(anterioresDelLugar(c, { ideal: "Botas tipo sneaker negras", index: 0 })).toContain("Tenis Golden Goose");
  });

  it("no mezcla otro lugar: ni otra pieza ideal ni otro índice", () => {
    const c: CambioViaje[] = [
      { ideal: "Polo negro", from: "Polo de punto", to: "Suéter beige", trip_id: "v" },
      { ideal: "Botas tipo sneaker negras", from: "Botas negras", to: "Chukka", trip_id: "v", index: 7 },
    ];
    expect(anterioresDelLugar(c, { ideal: "Botas tipo sneaker negras", index: 2 })).toEqual([]);
  });

  it("los eventos viejos sin índice casan por la pieza ideal", () => {
    const c: CambioViaje[] = [{ ideal: "Botas tipo sneaker negras", from: "Botas negras", to: "Chukka", trip_id: "v" }];
    expect(anterioresDelLugar(c, { ideal: "Botas tipo sneaker negras", index: 2 })).toEqual(["Chukka", "Botas negras"]);
  });

  it("sin cambios en ese lugar no hay nada que ofrecer", () => {
    expect(anterioresDelLugar([], { ideal: "x", index: 0 })).toEqual([]);
  });
});

describe("rechazadasNetas", () => {
  it("probar zapatos no es rechazarlos: sólo cuenta la propuesta de la app", () => {
    const c = noche(
      ["Botas negras", "Tenis Ballet"],
      ["Tenis Ballet", "Chukka gamuza"],
      ["Chukka gamuza", "Tenis bota café"],
      ["Tenis bota café", "Mocasines verdes"]
    );
    expect(rechazadasNetas(c)).toEqual(["Botas negras"]);
  });

  it("si volvió a elegir la propuesta, ya no es rechazada", () => {
    const c = noche(["Tenis Golden Goose", "Tenis estrella"], ["Tenis estrella", "Tenis Golden Goose"]);
    expect(rechazadasNetas(c)).toEqual([]);
  });

  it("el último movimiento manda: la volvió a quitar después de recuperarla", () => {
    const c = noche(
      ["Tenis Golden Goose", "Tenis estrella"],
      ["Tenis estrella", "Tenis Golden Goose"],
      ["Tenis Golden Goose", "Tenis beige"]
    );
    expect(rechazadasNetas(c)).toEqual(["Tenis Golden Goose"]);
  });

  it("elegirla en OTRO viaje también la rehabilita", () => {
    const c = noche(["Polo negro", "Suéter beige", "viaje-1"], ["Playera gris", "Polo negro", "viaje-2"]);
    // El polo se rehabilita; la playera gris era la propuesta del viaje 2 y sí la quitó.
    expect(rechazadasNetas(c)).toEqual(["Playera gris"]);
  });

  it("cada viaje tiene su propia propuesta original", () => {
    const c = noche(["Botas negras", "Chukka", "viaje-1"], ["Tenis piel", "Mocasín", "viaje-2"]);
    expect(rechazadasNetas(c).sort()).toEqual(["Botas negras", "Tenis piel"]);
  });

  it("eventos sin viaje (anteriores a julio) cuentan como antes", () => {
    const c: CambioViaje[] = [{ from: "Camisa rayas", to: "Camisa blanca" }];
    expect(rechazadasNetas(c)).toEqual(["Camisa rayas"]);
  });

  it("un ancla de hoy gana sobre un rechazo viejo", () => {
    const c = noche(["Botas negras", "Chukka"]);
    expect(rechazadasNetas(c, new Set(["botas negras"]))).toEqual([]);
  });

  it("respeta el tope, las más recientes primero", () => {
    const c = Array.from({ length: 12 }, (_, i) => ({ ideal: `pieza-${i}`, from: `prenda-${i}`, to: `otra-${i}`, trip_id: "v" })).reverse();
    expect(rechazadasNetas(c, new Set(), 3)).toEqual(["prenda-11", "prenda-10", "prenda-9"]);
  });
});
