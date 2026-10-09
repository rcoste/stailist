// @vitest-environment jsdom
//
// La decisión que se blinda: un segundo toque NO manda otro formulario. Cada
// envío a /empezar abre un borrador nuevo; con una conexión lenta, tocar de
// nuevo creaba cuentas vacías (12 en 20 segundos, 2026-10-09).

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormEmpezar } from "./form-empezar";

afterEach(cleanup);

describe("FormEmpezar", () => {
  it("al primer toque avisa y se apaga; el segundo envío se cancela", () => {
    render(<FormEmpezar>Armar mi primer look</FormEmpezar>);
    const boton = screen.getByRole("button", { name: /Armar mi primer look/ });
    const form = boton.closest("form") as HTMLFormElement;
    expect(form.getAttribute("action")).toBe("/empezar");
    expect(form.getAttribute("method")).toBe("post");

    // jsdom no navega: el submit se dispara a mano, como lo haría el toque.
    const primero = fireEvent.submit(form);
    expect(primero).toBe(true);
    expect(screen.getByRole("button", { name: "Abriendo…" })).toHaveProperty("disabled", true);

    const segundo = fireEvent.submit(form);
    expect(segundo).toBe(false);
  });
});
