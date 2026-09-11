import { describe, expect, it, vi } from "vitest";
import { borrarCuentasVencidas } from "./borrar-cuentas-vencidas";

describe("borrarCuentasVencidas", () => {
  it("borra archivos y luego filas de cada cuenta vencida", async () => {
    const orden: string[] = [];
    const r = await borrarCuentasVencidas({
      vencidas: async () => ["a", "b"],
      borrarArchivosDe: async (uid) => void orden.push(`archivos:${uid}`),
      borrarFilasDe: async (uid) => void orden.push(`filas:${uid}`),
    });
    expect(orden).toEqual(["archivos:a", "filas:a", "archivos:b", "filas:b"]);
    expect(r.borradas).toEqual(["a", "b"]);
    expect(r.fallidas).toEqual([]);
  });

  it("si los archivos fallan NO se borran las filas (las fotos quedarían huérfanas): se reintenta mañana", async () => {
    const borrarFilasDe = vi.fn(async (_uid: string) => {});
    const r = await borrarCuentasVencidas({
      vencidas: async () => ["a"],
      borrarArchivosDe: async () => {
        throw new Error("storage no respondió");
      },
      borrarFilasDe,
    });
    expect(borrarFilasDe).not.toHaveBeenCalled();
    expect(r.borradas).toEqual([]);
    expect(r.fallidas).toEqual([{ uid: "a", paso: "archivos", error: "storage no respondió" }]);
  });

  it("una cuenta que falla no frena a las demás", async () => {
    const r = await borrarCuentasVencidas({
      vencidas: async () => ["a", "b"],
      borrarArchivosDe: async () => {},
      borrarFilasDe: async (uid) => {
        if (uid === "a") throw new Error("transacción");
      },
    });
    expect(r.borradas).toEqual(["b"]);
    expect(r.fallidas).toEqual([{ uid: "a", paso: "filas", error: "transacción" }]);
  });
});
