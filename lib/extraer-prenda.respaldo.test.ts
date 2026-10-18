import { describe, it, expect } from "vitest";
import { debeIntentarRespaldo } from "./extraer-prenda";

// LO QUE BLINDA: cuándo se paga el dibujo de respaldo (texto→imagen) después
// de que la foto no pasó. Medido el 2026-10-17: el respaldo rescató 2 de 8
// prendas rechazadas, y al menos una venía de PROHIBITED_CONTENT (el filtro
// mira la foto; el respaldo no la manda). Sólo los derechos de autor se
// saltan: el texto lleva el mismo personaje y daría el mismo no.

describe("debeIntentarRespaldo", () => {
  it("sí cuando la foto falló por una caída o sin foto", () => {
    expect(debeIntentarRespaldo(null)).toBe(true);
    expect(debeIntentarRespaldo({ filtro: null })).toBe(true);
  });

  it("sí cuando el filtro rechazó la FOTO: el texto solo puede pasar", () => {
    expect(debeIntentarRespaldo({ filtro: "PROHIBITED_CONTENT" })).toBe(true);
    expect(debeIntentarRespaldo({ filtro: "IMAGE_SAFETY" })).toBe(true);
  });

  it("no cuando fueron derechos de autor (Mickey, Minnie): el texto lleva el mismo nombre", () => {
    expect(debeIntentarRespaldo({ filtro: "IMAGE_RECITATION" })).toBe(false);
    expect(debeIntentarRespaldo({ filtro: "RECITATION" })).toBe(false);
  });
});
