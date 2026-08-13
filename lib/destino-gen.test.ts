import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FORMULA_MONO,
  FORMULA_LUZ,
  FORMULA_GRANO,
  FORMULA_COMPOSICION,
  FORMULA_LIMPIO,
  promptDestino,
} from "./destino-gen";
import { imagenCatalogo, imagenGenerica, slugDestino } from "./destino-imagen";

// LA FÓRMULA VIVE EN DOS LADOS Y ESTE TEST ES EL PUENTE.
//
// scripts/gen-destinos.mjs (el catálogo estático, corre a mano) y
// lib/destino-gen.ts (la cola larga, corre en producción) generan con la MISMA
// fórmula visual — B&N frío, sujeto dominante, sin gente ni letreros. Están
// duplicadas porque el script .mjs no puede importar TS. Si alguien afina una
// copia y no la otra, las fotos nuevas dejan de parecerse a las curadas y
// nadie truena: solo se ve, card por card, cada vez más Frankenstein.

describe("la fórmula congelada — idéntica en el script y en producción", () => {
  const script = readFileSync(
    join(import.meta.dirname, "..", "scripts", "gen-destinos.mjs"),
    "utf8"
  );

  it("cada pieza de la fórmula aparece VERBATIM en gen-destinos.mjs", () => {
    for (const pieza of [
      FORMULA_MONO,
      FORMULA_LUZ,
      FORMULA_GRANO,
      FORMULA_COMPOSICION,
      FORMULA_LIMPIO,
    ]) {
      expect(script).toContain(pieza);
    }
  });

  it("el armado del prompt también es el del script", () => {
    // La frase de apertura, que es la otra mitad del estilo.
    expect(script).toContain("Fine-art black and white travel photograph of");
    expect(promptDestino("X")).toContain("Fine-art black and white travel photograph of X.");
  });
});

describe("slugDestino — la llave del candado", () => {
  it("normaliza acentos, mayúsculas y lo que trae el geocoder", () => {
    expect(slugDestino("Osaka")).toBe("osaka");
    expect(slugDestino("Kioto, Japón")).toBe("kioto");
    expect(slugDestino("San Cristóbal de las Casas")).toBe("san-cristobal-de-las-casas");
  });

  it("en multidestino, el slug es de la PRIMERA parada", () => {
    // La misma regla que la foto: la primera parada nombra el viaje. Un slug
    // del string completo haría que "Osaka · Tokio" y "Osaka" fueran destinos
    // distintos y pagaran dos generaciones de la misma ciudad.
    expect(slugDestino("Osaka · Tokio")).toBe("osaka");
  });

  it("nunca devuelve vacío, que rompería la llave primaria", () => {
    expect(slugDestino("")).toBe("destino");
    expect(slugDestino("···")).toBe("destino");
  });
});

describe("imagenCatalogo — el null es la señal de generar", () => {
  it("los curados a mano NO se generan", () => {
    expect(imagenCatalogo("Tokio")).toBe("/destinos/tokio.webp");
    expect(imagenCatalogo("Cancún")).toBe("/destinos/playa.webp");
  });

  it("la cola larga devuelve null — Osaka y Kioto, los ejemplos de Roberto", () => {
    expect(imagenCatalogo("Osaka")).toBeNull();
    expect(imagenCatalogo("Kioto")).toBeNull();
  });

  it("la genérica sigue existiendo para mientras se genera (o si falla)", () => {
    expect(imagenGenerica(["playa"])).toBe("/destinos/playa.webp");
    expect(imagenGenerica([])).toBe("/destinos/ciudad.webp");
  });
});
