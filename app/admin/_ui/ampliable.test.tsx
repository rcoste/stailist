// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Ampliable } from "./ampliable";

// Lo que se blinda: una miniatura del admin CON imagen se pica y abre el visor
// con esa imagen y su nombre; SIN imagen no es botón (no hay nada que ver).
afterEach(cleanup);

describe("Ampliable", () => {
  it("al picarla abre el visor con la imagen y el nombre, y se cierra", () => {
    render(
      <Ampliable imagen="https://ejemplo.test/saco.jpg" nombre="Saco azul marino" sub="subida con foto">
        <span>miniatura</span>
      </Ampliable>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver en grande: Saco azul marino" }));
    const visor = screen.getByRole("dialog", { name: "Saco azul marino" });
    expect(visor.querySelector("img")?.getAttribute("src")).toContain("saco.jpg");
    expect(screen.getByText("subida con foto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sin imagen se pinta tal cual y no se puede picar", () => {
    render(
      <Ampliable imagen={null} nombre="Prenda sin imagen">
        <span>cuadro de color</span>
      </Ampliable>
    );
    expect(screen.getByText("cuadro de color")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
