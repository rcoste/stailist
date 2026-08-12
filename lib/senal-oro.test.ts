import { describe, it, expect } from "vitest";
import { contarSenalOroPorCercania, VENTANA_SENAL_ORO_MS } from "@/lib/senal-oro";

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
