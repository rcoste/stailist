// @vitest-environment jsdom
//
// EL GUIÑO A LA OTRA ESTACIÓN SE VE EN EL PERFIL (2026-10-21). Roberto es
// invierno con guiño de otoño ("Invierno profundo") y no lo encontraba: el
// bloque enseñaba el nombre y los colores de invierno, nada de otoño. Lo que se
// blinda es que los colores que toma de la otra estación —los mismos que usan
// los motores— se nombren.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ColorimetriaSection } from "@/components/colorimetria-section";

afterEach(cleanup);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/onboarding/colorimetria/actions", () => ({
  updateColorimetria: vi.fn(async (_s: string, _f: string | null) => ({ ok: true })),
}));

describe("ColorimetriaSection", () => {
  it("con guiño de otoño, nombra los colores que toma de otoño", () => {
    render(<ColorimetriaSection season="invierno" flow="otono" />);
    expect(screen.getByText("Invierno profundo")).toBeTruthy();
    expect(screen.getByText(/también te van colores de otoño: vino, chocolate/)).toBeTruthy();
  });

  it("sin guiño, no inventa una segunda estación", () => {
    render(<ColorimetriaSection season="invierno" flow={null} />);
    expect(screen.queryByText(/también te van colores de/)).toBeNull();
  });
});
