import { describe, expect, it } from "vitest";
import { llaveSegura } from "./biblioteca-compartida";

// El nombre del archivo lo arma el servidor, pero esta validación es la que
// impide que una llave rara termine escribiendo fuera de su carpeta o con otra
// extensión: es la última línea antes de la llave de servicio.
describe("llaveSegura", () => {
  it("acepta las llaves que el servidor calcula", () => {
    expect(llaveSegura("pantalon-vestir__azul-marino__hombre")).toBe(true);
    expect(llaveSegura("ciudad-de-guatemala")).toBe(true);
    expect(llaveSegura("destino")).toBe(true);
  });

  it("rechaza lo que cambiaría de carpeta, de extensión o de archivo", () => {
    for (const mala of ["../prendas/x", "a/b", "foto.html", "", "__sin-tipo__u", "Con Mayúsculas", "a b", "x".repeat(200)]) {
      expect(llaveSegura(mala), mala).toBe(false);
    }
  });
});
