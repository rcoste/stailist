// @vitest-environment jsdom
//
// La decisión que se blinda: volver a la pestaña OTRO día avisa una vez; el
// mismo día no avisa nunca. Volver a una pestaña abierta no recarga la página,
// y sin este aviso 3 regresos reales de octubre no se contaron.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { VisitaAlVolver } from "./visita-al-volver";

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));

function volverALaPestana() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  // Mediodía del 9 de octubre en la Ciudad de México (18:00 UTC).
  vi.setSystemTime(new Date("2026-10-09T18:00:00Z"));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("VisitaAlVolver", () => {
  it("el mismo día no avisa, aunque vuelva a la pestaña varias veces", () => {
    render(<VisitaAlVolver />);
    volverALaPestana();
    volverALaPestana();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al volver otro día avisa una sola vez", () => {
    render(<VisitaAlVolver />);
    vi.setSystemTime(new Date("2026-10-11T14:00:00Z"));
    volverALaPestana();
    volverALaPestana();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/visita");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("el día es el de la Ciudad de México: las 7 pm del mismo día no es otro día", () => {
    render(<VisitaAlVolver />);
    // 01:00 UTC del 10 = 7 pm del 9 en CDMX.
    vi.setSystemTime(new Date("2026-10-10T01:00:00Z"));
    volverALaPestana();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
