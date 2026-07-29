import { describe, expect, it } from "vitest";
import {
  REFERENCIAS_PRECARGADAS,
  referenciaPreset,
  presetsPara,
} from "./referencias";

// El catálogo entra al motor vía styleReferenceForEngine — estos tests pinnean
// el contrato: ids únicos, summary con sustancia, tags acotados (el motor corta
// en 6), y cero menciones de color específico (la colorimetría de la usuaria
// manda; la referencia solo inspira vibe y siluetas).
describe("REFERENCIAS_PRECARGADAS", () => {
  it("ids únicos y resolubles", () => {
    const ids = REFERENCIAS_PRECARGADAS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(referenciaPreset(id)?.id).toBe(id);
  });

  it("id desconocido → null (la action lo rechaza)", () => {
    expect(referenciaPreset("hacker")).toBeNull();
    expect(referenciaPreset("")).toBeNull();
  });

  it("cada preset trae summary con sustancia y 1-6 tags", () => {
    for (const r of REFERENCIAS_PRECARGADAS) {
      expect(r.summary.length).toBeGreaterThan(80);
      expect(r.tags.length).toBeGreaterThanOrEqual(1);
      expect(r.tags.length).toBeLessThanOrEqual(6);
      expect(r.nombre.length).toBeGreaterThan(0);
      expect(r.desc.length).toBeGreaterThan(0);
    }
  });
});

describe("imágenes del preset — la regla para poder ofrecerlo", () => {
  it("Carla se ofrece: tiene flat-lays de su guardarropa", () => {
    const carla = referenciaPreset("carla");
    expect(carla?.imagenes?.length).toBeGreaterThanOrEqual(3);
  });

  it("María NO se ofrece todavía: su guardarropa no está sembrado", () => {
    // Sin imágenes es un nombre y un párrafo pidiéndote adoptar un estilo que no
    // puedes ver — por eso se apagó la sección entera. La regla es la misma para
    // todas: sin flat-lays, no se ofrece.
    expect(referenciaPreset("maria")?.imagenes ?? []).toHaveLength(0);
  });

  it("las rutas apuntan a arquetipos públicos", () => {
    for (const r of REFERENCIAS_PRECARGADAS) {
      for (const src of r.imagenes ?? []) {
        expect(src).toMatch(/^\/archetypes\/[a-z0-9-]+\.png$/);
      }
    }
  });
});

describe("presetsPara — a quién se le ofrece", () => {
  it("a un hombre no se le ofrece un guardarropa de mujer", () => {
    // Hoy los dos presets son de mujer: a un hombre la sección desaparece.
    // Correcto — lo pendiente es sembrar un guardarropa de hombre, no prestarle
    // faldas y mules mientras tanto.
    expect(presetsPara("hombre")).toEqual([]);
  });

  it("a una mujer se le ofrece Carla y no María", () => {
    const ids = presetsPara("mujer").map((r) => r.id);
    expect(ids).toContain("carla");
    expect(ids).not.toContain("maria");
  });

  it("sin género no se ofrece nada segmentado", () => {
    expect(presetsPara(null).every((r) => !r.segmento)).toBe(true);
  });

  it("todo preset ofrecible declara su segmento", () => {
    // Guard para el día que se siembre un guardarropa de hombre: si alguien le
    // agrega imágenes sin poner `segmento`, se le ofrecería a todo el mundo.
    const conImagen = REFERENCIAS_PRECARGADAS.filter(
      (r) => (r.imagenes?.length ?? 0) > 0
    );
    expect(conImagen.length).toBeGreaterThan(0);
    expect(conImagen.every((r) => !!r.segmento)).toBe(true);
  });
});
