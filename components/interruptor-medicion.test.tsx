// @vitest-environment jsdom
//
// EL BOTÓN DE "NO QUIERO QUE ME MIDAN" DEL AVISO DE PRIVACIDAD.
//
// Lo que se blinda no es el texto del botón: es que lo que el botón escribe sea
// EXACTAMENTE lo que lib/publicidad.ts lee antes de cargar las etiquetas. Si un
// día alguien renombra la clave de un lado y no del otro, el botón seguiría
// diciendo "listo" y las etiquetas seguirían cargando — el aviso mentiría sin
// que nada truene. Por eso la aserción es contra permitidoEnEsteNavegador(), la
// función real, no contra el localStorage.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterruptorMedicion } from "./interruptor-medicion";
import { OPT_OUT_KEY, permitidoEnEsteNavegador } from "@/lib/publicidad";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "globalPrivacyControl");
});

describe("InterruptorMedicion", () => {
  it("apagar y volver a permitir cambian lo que lib/publicidad respeta, y se recuerda al volver", async () => {
    const u = userEvent.setup();
    render(<InterruptorMedicion />);
    expect(permitidoEnEsteNavegador()).toBe(true);

    await u.click(await screen.findByRole("button", { name: /me midan/i }));
    expect(localStorage.getItem(OPT_OUT_KEY)).toBe("1");
    expect(permitidoEnEsteNavegador()).toBe(false);

    await u.click(await screen.findByRole("button", { name: /volver a permitirlo/i }));
    expect(localStorage.getItem(OPT_OUT_KEY)).toBeNull();
    expect(permitidoEnEsteNavegador()).toBe(true);

    // Otra visita a /privacidad con la medición apagada: arranca apagado.
    cleanup();
    localStorage.setItem(OPT_OUT_KEY, "1");
    render(<InterruptorMedicion />);
    expect(await screen.findByRole("button", { name: /volver a permitirlo/i })).toBeTruthy();
  });

  it("con Global Privacy Control no ofrece botón: ya no se carga nada", async () => {
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true });
    render(<InterruptorMedicion />);

    expect(await screen.findByText(/Global Privacy Control/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(permitidoEnEsteNavegador()).toBe(false);
  });
});
