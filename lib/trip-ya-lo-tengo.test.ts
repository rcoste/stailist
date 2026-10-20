import { describe, it, expect } from "vitest";
import { posiblesDelCloset } from "@/lib/trip-ya-lo-tengo";
import type { CapsuleItem, ClosetItemLite } from "@/lib/capsule";

// LO QUE BLINDA: "ya lo tengo" pregunta por las prendas suyas que podrían ser
// esa antes de crear una nueva. Los dos casos reales del 2026-10-20.

const pieza = (nombre: string, category: string, colorFamilia: string): CapsuleItem =>
  ({ nombre, tipo: "x", category, colorFamilia, formalidad: "casual", temporada: "todo-el-año", prioridad: 1, porque: "" }) as CapsuleItem;
const mia = (nombre: string, category: string, color: string, corte: string | null = null): ClosetItemLite =>
  ({ id: nombre, nombre, category, color, formalidad: "casual", corte }) as ClosetItemLite;

const closet = [
  mia("Pantalón sastre recto", "bottom", "negro", "recto"),
  mia("Pantalones de vestir negros", "bottom", "negro", "holgado"),
  mia("Pantalón de vestir gris carbón", "bottom", "gris"),
  mia("Jeans azul oscuro", "bottom", "azul"),
  mia("Suéter de punto verde", "abrigo", "verde bosque"),
];

describe("posiblesDelCloset", () => {
  it("wide leg negro: primero su pantalón negro de corte holgado", () => {
    const r = posiblesDelCloset(pieza("Pantalón wide leg negro", "bottom", "negro"), closet, new Set());
    expect(r[0].nombre).toBe("Pantalones de vestir negros");
    expect(r.map((c) => c.nombre)).not.toContain("Jeans azul oscuro");
  });
  it("gris recto: su gris carbón", () => {
    const r = posiblesDelCloset(pieza("Pantalón de vestir gris recto", "bottom", "gris"), closet, new Set());
    expect(r.map((c) => c.nombre)).toEqual(["Pantalón de vestir gris carbón"]);
  });
  it("lo que ya está en la maleta no se ofrece", () => {
    const r = posiblesDelCloset(pieza("Pantalón wide leg negro", "bottom", "negro"), closet, new Set(["Pantalones de vestir negros"]));
    expect(r.map((c) => c.nombre)).toEqual(["Pantalón sastre recto"]);
  });
  it("un suéter guardado como abrigo sí entra para un suéter verde", () => {
    const r = posiblesDelCloset(pieza("Suéter de punto esmeralda", "top", "esmeralda"), closet, new Set());
    expect(r.map((c) => c.nombre)).toEqual(["Suéter de punto verde"]);
  });
  it("sin nada de su color, no pregunta (se crea)", () => {
    expect(posiblesDelCloset(pieza("Suéter de punto vino", "top", "vino"), closet, new Set())).toEqual([]);
  });
});
