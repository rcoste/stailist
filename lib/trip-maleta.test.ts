import { describe, expect, it } from "vitest";
import { empacablesDelViaje, sustitutoDe } from "@/lib/trip-maleta";
import type { CapsuleItem, CapsuleMatch, CapsuleOverrides, CapsuleTarget, MatchStatus } from "@/lib/capsule";

// Lo que este test blinda: los looks del viaje se arman con TODO lo que hay en
// la maleta, incluidas las prendas que la persona eligió a mano para un hueco
// que faltaba. Sin esto salieron 15 looks con las mismas cuatro prendas
// (reporte real, 2026-10-13).

const item = (nombre: string): CapsuleItem => ({
  nombre,
  tipo: nombre,
  category: "top" as CapsuleItem["category"],
  colorFamilia: "neutro",
  formalidad: "casual" as CapsuleItem["formalidad"],
  temporada: "todo-el-año",
  prioridad: 1,
  porque: "porque sí",
});

const target = (n: number): CapsuleTarget => ({
  version: 2,
  items: Array.from({ length: n }, (_, i) => item(`ideal-${i}`)),
});

const match = (entries: [MatchStatus, string | null][]): CapsuleMatch => ({
  signature: "sig",
  entries: entries.map(([status, by]) => ({ status, by })),
});

const nombres = (t: CapsuleTarget, m: CapsuleMatch, o: CapsuleOverrides | null) =>
  empacablesDelViaje(t, m, o).map((p) => p.nombre);

describe("empacablesDelViaje", () => {
  it("suma el sustituto que la persona eligió para un hueco que faltaba", () => {
    const m = match([
      ["tienes", "Jeans azul claro"],
      ["falta", null],
    ]);
    const o = { "sub:1": "Chinos beige" } as unknown as CapsuleOverrides;
    expect(nombres(target(2), m, o)).toEqual(["Jeans azul claro", "Chinos beige"]);
  });

  it("el sustituto gana sobre lo que encontró la app en ese hueco", () => {
    const m = match([["parecido", "Suéter gris"]]);
    const o = { "0": "reject", "sub:0": "Suéter crema" } as unknown as CapsuleOverrides;
    expect(nombres(target(1), m, o)).toEqual(["Suéter crema"]);
  });

  it("no cuenta una candidata que la app propuso y no se aceptó", () => {
    const m = match([["falta", null]]);
    const o = { "cand:0": "Camisa lino" } as unknown as CapsuleOverrides;
    expect(nombres(target(1), m, o)).toEqual([]);
  });

  it("cuenta 'parecido' sin decidir y descarta el 'parecido' rechazado", () => {
    const m = match([
      ["parecido", "Tenis blancos"],
      ["parecido", "Botín café"],
    ]);
    const o = { "1": "reject" } as unknown as CapsuleOverrides;
    expect(nombres(target(2), m, o)).toEqual(["Tenis blancos"]);
  });

  it("la misma prenda cubriendo dos huecos se empaca una vez", () => {
    const m = match([
      ["falta", null],
      ["falta", null],
    ]);
    const o = { "sub:0": "Chinos beige", "sub:1": "Chinos beige" } as unknown as CapsuleOverrides;
    expect(nombres(target(2), m, o)).toEqual(["Chinos beige"]);
  });

  it("sustitutoDe ignora valores vacíos o que no son texto", () => {
    expect(sustitutoDe({ "sub:0": "  " } as unknown as CapsuleOverrides, 0)).toBeNull();
    expect(sustitutoDe({ "sub:0": true } as unknown as CapsuleOverrides, 0)).toBeNull();
    expect(sustitutoDe(null, 0)).toBeNull();
  });
});
