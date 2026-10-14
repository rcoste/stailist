import { describe, it, expect } from "vitest";
import { contarSenalOroPorCercania, parecidoConSugerido, parecidoEnPalabras, VENTANA_SENAL_ORO_MS } from "@/lib/senal-oro";

// Lo que este test blinda: la definición de la señal de oro (decisión de
// producto 2026-08-11) — fit check ≤24h DESPUÉS de un look generado, del MISMO
// usuario, contando cada fit check una sola vez.

const t0 = Date.parse("2026-08-10T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("contarSenalOroPorCercania", () => {
  it("fit check dentro de las 24h después del look cuenta", () => {
    const n = contarSenalOroPorCercania(
      [{ userId: "tatiana", createdAt: iso(t0) }],
      [{ userId: "tatiana", createdAt: iso(t0 + 6 * 3600_000) }]
    );
    expect(n).toBe(1);
  });

  it("fuera de la ventana o ANTES del look no cuenta", () => {
    const looks = [{ userId: "tatiana", createdAt: iso(t0) }];
    // 25h después: ya no es "se puso lo que le sugerí hoy".
    expect(
      contarSenalOroPorCercania(looks, [
        { userId: "tatiana", createdAt: iso(t0 + VENTANA_SENAL_ORO_MS + 3600_000) },
      ])
    ).toBe(0);
    // Una hora ANTES: no puedes ponerte lo que aún no te sugiero.
    expect(
      contarSenalOroPorCercania(looks, [
        { userId: "tatiana", createdAt: iso(t0 - 3600_000) },
      ])
    ).toBe(0);
  });

  it("no cruza usuarios: el look de una no valida el fit check de otro", () => {
    const n = contarSenalOroPorCercania(
      [{ userId: "tatiana", createdAt: iso(t0) }],
      [{ userId: "tono", createdAt: iso(t0 + 3600_000) }]
    );
    expect(n).toBe(0);
  });

  it("cada fit check cuenta UNA vez aunque tenga varios looks cerca", () => {
    const n = contarSenalOroPorCercania(
      [
        { userId: "tatiana", createdAt: iso(t0) },
        { userId: "tatiana", createdAt: iso(t0 + 3600_000) },
      ],
      [{ userId: "tatiana", createdAt: iso(t0 + 4 * 3600_000) }]
    );
    expect(n).toBe(1);
  });

  it("el borde exacto de 24h todavía cuenta", () => {
    const n = contarSenalOroPorCercania(
      [{ userId: "tatiana", createdAt: iso(t0) }],
      [{ userId: "tatiana", createdAt: iso(t0 + VENTANA_SENAL_ORO_MS) }]
    );
    expect(n).toBe(1);
  });
});

describe("parecidoConSugerido — ¿el espejo es el look sugerido?", () => {
  const look = (id: string, items: string[], createdAt: string, titulo = id) => ({ id, titulo, itemIds: items, createdAt });

  it("el caso que lo destapó: una camiseta en común no es ponerse el look", () => {
    const p = parecidoConSugerido({ itemIds: ["tenis", "jeans", "tirantes"], createdAt: "2026-10-14T17:01:00Z" }, [
      look("Negro fácil", ["mules", "vestido"], "2026-10-14T16:50:00Z"),
      look("Falda midi", ["mules", "falda", "tirantes"], "2026-10-14T16:52:00Z"),
    ]);
    expect(p).toEqual({ tipo: "comparte", titulo: "Falda midi", enComun: 1, total: 3, minutosAntes: 9, esElLook: false });
    expect(parecidoEnPalabras(p)).toContain("su ropa, no el look");
  });

  it("dos de tres prendas del look sí cuentan como ponérselo", () => {
    const p = parecidoConSugerido({ itemIds: ["falda", "tirantes", "tenis"], createdAt: "2026-10-15T15:00:00Z" }, [
      look("Falda midi", ["mules", "falda", "tirantes"], "2026-10-14T16:52:00Z"),
    ]);
    expect(p.tipo === "comparte" && p.esElLook).toBe(true);
  });

  it("un look de dos prendas pide las dos", () => {
    const p = parecidoConSugerido({ itemIds: ["vestido"], createdAt: "2026-10-14T17:00:00Z" }, [
      look("Negro", ["mules", "vestido"], "2026-10-14T16:00:00Z"),
    ]);
    expect(p.tipo === "comparte" && p.esElLook).toBe(false);
  });

  it("un look de después del espejo o de hace más de 24 h no cuenta", () => {
    const p = parecidoConSugerido({ itemIds: ["a"], createdAt: "2026-10-14T12:00:00Z" }, [
      look("Después", ["a"], "2026-10-14T12:05:00Z"),
      look("Viejo", ["a"], "2026-10-13T11:00:00Z"),
    ]);
    expect(p).toEqual({ tipo: "sin-look" });
  });

  it("sin prendas confirmadas no adivina: dice cuál fue el último look", () => {
    const p = parecidoConSugerido({ itemIds: [], createdAt: "2026-10-14T12:00:00Z" }, [look("X", ["a"], "2026-10-14T10:00:00Z")]);
    expect(p).toEqual({ tipo: "sin-prendas", titulo: "X", minutosAntes: 120 });
  });
});
