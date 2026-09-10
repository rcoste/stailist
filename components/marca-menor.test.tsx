// @vitest-environment jsdom
//
// LA MARCA DE MENOR (components/marca-menor.tsx).
//
// Lo que se blinda: que lo que escribe sea EXACTAMENTE lo que lib/publicidad.ts
// lee antes de cargar etiquetas. Si alguien renombra la cookie de un lado y no
// del otro, una cuenta de 13-17 volvería a cargar Google y TikTok en otro
// navegador sin que nada truene. Por eso la aserción es contra
// permitidoEnEsteNavegador(), la función real.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MarcaMenor } from "./marca-menor";
import { permitidoEnEsteNavegador } from "@/lib/publicidad";

afterEach(() => {
  cleanup();
  document.cookie = "st_menor=; Max-Age=0; path=/";
});

describe("MarcaMenor", () => {
  it("al montarse, este navegador deja de estar permitido para las etiquetas", () => {
    expect(permitidoEnEsteNavegador()).toBe(true);
    render(<MarcaMenor />);
    expect(permitidoEnEsteNavegador()).toBe(false);
  });
});
