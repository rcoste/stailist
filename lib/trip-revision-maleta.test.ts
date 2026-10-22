import { describe, it, expect } from "vitest";
import { firmaDeMaleta, leerRevision, revisionGuardada } from "@/lib/trip-revision-maleta";

// LO QUE BLINDA: la revisión que se guarda y se enseña nunca señala una prenda
// que no lleva, no se desborda, y sabe cuándo quedó vieja (la firma).

const lleva = new Set(["Camisa de franela gris", "Cuello tortuga negro", "Jeans negros"]);

describe("leerRevision", () => {
  it("valida y recorta lo que devuelve el modelo", () => {
    const r = leerRevision(
      {
        veredicto: "  Te alcanza bien para 8 días.  ",
        looks: 11.6,
        bien: ["Buenas capas", "", "Zapatos cerrados", "Paleta oscura", "otra"],
        sobra: [
          { prenda: "Cuello tortuga negro", porque: "Llevas dos" },
          { prenda: "Cuello de tortuga negro", porque: "parafraseado: no se puede señalar" },
        ],
        falta: [{ que: "algo para la cena formal", porque: "tienes una noche" }, { que: "", porque: "vacío" }],
      },
      lleva,
      "f1",
      new Date("2026-10-21T00:00:00Z")
    )!;
    expect(r.veredicto).toBe("Te alcanza bien para 8 días.");
    expect(r.looks).toBe(12);
    expect(r.bien).toEqual(["Buenas capas", "Zapatos cerrados", "Paleta oscura"]);
    expect(r.sobra).toEqual([{ prenda: "Cuello tortuga negro", porque: "Llevas dos" }]);
    expect(r.falta).toHaveLength(1);
    expect(r.firma).toBe("f1");
  });

  it("sin veredicto no hay revisión", () => {
    expect(leerRevision({ looks: 3 }, lleva, "f")).toBeNull();
  });
});

describe("firmaDeMaleta", () => {
  it("no depende del orden ni de repetidos", () => {
    expect(firmaDeMaleta(["b", "a", "b"])).toBe(firmaDeMaleta(["a", "b"]));
  });
});

describe("revisionGuardada", () => {
  it("lee lo guardado o null", () => {
    expect(revisionGuardada(null)).toBeNull();
    expect(revisionGuardada({ veredicto: "ok", firma: "x" })).not.toBeNull();
  });
});
