import { describe, it, expect } from "vitest";
import { fusionarCruce } from "@/lib/trip-recalcular";
import type { CapsuleItem, ClosetItemLite, MatchEntry } from "@/lib/capsule";

// LO QUE BLINDA: recalcular la maleta trae lo nuevo del clóset sin revolver lo
// que ya estaba resuelto, y limpia SÓLO las decisiones de las piezas que
// cambiaron de prenda. El caso real (2026-10-20): subió tres suéteres para su
// maleta y tuvo que rehacerla entera, perdiendo todo lo que había decidido.

const pieza = (nombre: string, category = "top", colorFamilia = "negro"): CapsuleItem =>
  ({ nombre, tipo: "x", category, colorFamilia, formalidad: "casual", temporada: "todo-el-año", prioridad: 1, porque: "" }) as CapsuleItem;
const mia = (nombre: string, category = "top", color = "negro"): ClosetItemLite =>
  ({ id: nombre, nombre, category, color, formalidad: "casual" }) as ClosetItemLite;
const e = (status: MatchEntry["status"], by: string | null = null): MatchEntry => ({ status, by, difiere: null });

const items = [pieza("Abrigo largo negro", "abrigo"), pieza("Suéter de punto esmeralda", "top", "esmeralda"), pieza("Jeans azul oscuro", "bottom", "azul")];
const closet = [mia("Abrigo largo negro", "abrigo"), mia("Suéter de punto verde", "abrigo", "verde"), mia("Jeans azul", "bottom", "azul")];

describe("fusionarCruce", () => {
  it("lo resuelto se queda aunque la IA hoy diga otra cosa; lo que faltaba toma lo nuevo", () => {
    const r = fusionarCruce({
      items,
      antes: [e("tienes", "Abrigo largo negro"), e("falta"), e("tienes", "Jeans azul")],
      nuevo: [e("parecido", "Abrigo largo negro"), e("parecido", "Suéter de punto verde"), e("tienes", "Jeans azul")],
      closet,
      overrides: { "0": "accept", "sub:2": "Jeans azul" } as never,
      empacado: { "0": true, "2": true },
    });
    expect(r.entries[0]).toMatchObject({ status: "tienes", by: "Abrigo largo negro" });
    expect(r.entries[1]).toMatchObject({ status: "parecido", by: "Suéter de punto verde" });
    expect(r.cambiaron).toEqual([1]);
    expect(r.empacado).toEqual({ "0": true, "2": true });
    expect((r.overrides as Record<string, unknown>)["sub:2"]).toBe("Jeans azul");
  });

  it("lo que desmintió ('no es la misma') se vuelve a cruzar y su decisión vieja se limpia", () => {
    const r = fusionarCruce({
      items,
      antes: [e("tienes", "Abrigo largo negro"), e("parecido", "Suéter gris"), e("tienes", "Jeans azul")],
      nuevo: [e("tienes", "Abrigo largo negro"), e("parecido", "Suéter de punto verde"), e("tienes", "Jeans azul")],
      closet,
      overrides: { "1": "reject", "cand:1": "Suéter gris", "candNo:1": true } as never,
      empacado: { "1": true },
    });
    expect(r.entries[1].by).toBe("Suéter de punto verde");
    const ov = r.overrides as Record<string, unknown>;
    expect(ov["1"]).toBeUndefined();
    expect(ov["cand:1"]).toBeUndefined();
    expect(r.empacado["1"]).toBeUndefined();
  });

  // Su maleta de Mineápolis (2026-10-21): había elegido sus "Tenis blancos" para
  // los "Sneakers de piel blancos" (rechazó el parecido con otros tenis). Al
  // recalcular, la IA propuso justo esos "Tenis blancos" y se le reabrió el duelo.
  it("si la prenda nueva es la que ya eligió a mano, no le vuelve a preguntar", () => {
    const tenis = [pieza("Sneakers de piel blancos", "calzado", "blanco")];
    const suyos = [mia("Tenis blancos urbanos", "calzado", "blanco"), mia("Tenis blancos", "calzado", "blanco")];
    const r = fusionarCruce({
      items: tenis,
      antes: [e("parecido", "Tenis blancos urbanos")],
      nuevo: [e("parecido", "Tenis blancos")],
      closet: suyos,
      overrides: { "0": "reject", "sub:0": "Tenis blancos" } as never,
      empacado: { "0": true },
    });
    expect(r.entries[0]).toMatchObject({ status: "parecido", by: "Tenis blancos" });
    expect(r.cambiaron).toEqual([]);
    expect((r.overrides as Record<string, unknown>)["0"]).toBe("accept");
    expect(r.empacado["0"]).toBe(true);
  });

  // Su maleta (2026-10-21): rechazó sus "Zapato derby de piel chocolate" para
  // los "Zapatos derby chocolate" ("ninguna de las dos me va") y el recálculo se
  // los devolvió como "tienes".
  it("lo que rechazó para una pieza no vuelve al recalcular", () => {
    const derby = [pieza("Zapatos derby chocolate", "calzado", "chocolate")];
    const suyos = [mia("Zapato derby de piel chocolate", "calzado", "chocolate")];
    const r = fusionarCruce({
      items: derby,
      antes: [e("parecido", "Zapato derby de piel chocolate")],
      nuevo: [e("tienes", "Zapato derby de piel chocolate")],
      closet: suyos,
      overrides: { "0": "reject", "candRech:0": ["Zapato derby de piel chocolate"], "candNo:0": true } as never,
      empacado: {},
    });
    expect(r.entries[0]).toMatchObject({ status: "parecido", by: "Zapato derby de piel chocolate" });
    expect(r.cambiaron).toEqual([]);
    expect((r.overrides as Record<string, unknown>)["0"]).toBe("reject");
    expect((r.overrides as Record<string, unknown>)["candNo:0"]).toBe(true);
  });

  it("si borró la prenda que cubría una pieza, esa pieza se recalcula", () => {
    const r = fusionarCruce({
      items,
      antes: [e("tienes", "Abrigo que ya borró"), e("falta"), e("tienes", "Jeans azul")],
      nuevo: [e("tienes", "Abrigo largo negro"), e("falta"), e("tienes", "Jeans azul")],
      closet,
      overrides: null,
      empacado: null,
    });
    expect(r.entries[0].by).toBe("Abrigo largo negro");
    expect(r.cambiaron).toEqual([0]);
  });

  it("lo que sacó del viaje sigue fuera", () => {
    const r = fusionarCruce({
      items,
      antes: [e("tienes", "Abrigo largo negro"), e("falta"), e("tienes", "Jeans azul")],
      nuevo: [e("tienes", "Abrigo largo negro"), e("parecido", "Suéter de punto verde"), e("tienes", "Jeans azul")],
      closet,
      overrides: { "fuera:1": "no lo necesito" } as never,
      empacado: null,
    });
    expect((r.overrides as Record<string, unknown>)["fuera:1"]).toBe("no lo necesito");
  });
});

describe("fusionarCruce — sólo mejora", () => {
  it("un 'parecido' sin decidir no se pierde porque hoy la IA diga 'falta'", () => {
    const bolso = [pieza("Bolso pequeño de hombro negro", "accesorio")];
    const r = fusionarCruce({
      items: bolso,
      antes: [e("parecido", "Bolso de mano estructurado")],
      nuevo: [e("falta")],
      closet: [mia("Bolso de mano estructurado", "accesorio")],
      overrides: null,
      empacado: null,
    });
    expect(r.entries[0]).toMatchObject({ status: "parecido", by: "Bolso de mano estructurado" });
    expect(r.cambiaron).toEqual([]);
  });
});
