// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";

// Lo que se blinda no es el markup: es qué decisión viaja. El botón abre el
// carrete en modo UNA foto, y al terminar se va a un look anclado en UNA de las
// prendas que entraron (la de arriba de una foto de cuerpo entero), no a "ver
// mi clóset".

const push = vi.fn((_href: string) => {});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const elegir = vi.fn(() => {});
type Props = {
  unaFoto?: boolean;
  alTerminar?: { label: string; onClick: (g: { id: string; categoria: string }[]) => void };
};
let ultimasProps: Props = {};
vi.mock("@/components/import-carrete-flow", () => ({
  ImportCarreteFlow: forwardRef(function Falso(props: Props, ref) {
    ultimasProps = props;
    useImperativeHandle(ref, () => ({ start: () => {}, elegir }));
    return null;
  }),
}));

import { TuRopaClient } from "./tu-ropa-client";

afterEach(() => {
  cleanup();
  push.mockClear();
  elegir.mockClear();
});

describe("ahora, con tu ropa", () => {
  it("el botón abre el carrete directo, con una sola foto", () => {
    render(<TuRopaClient userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /elegir una foto/ }));
    expect(elegir).toHaveBeenCalledTimes(1);
    expect(ultimasProps.unaFoto).toBe(true);
  });

  it("al terminar arma un look con la prenda de arriba, no con el outfit entero", () => {
    render(<TuRopaClient userId="u1" />);
    expect(ultimasProps.alTerminar?.label).toBe("armar un look con esto");
    ultimasProps.alTerminar?.onClick([
      { id: "tenis", categoria: "calzado" },
      { id: "jeans", categoria: "bottom" },
      { id: "playera", categoria: "top" },
    ]);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/hoy\?generar=\d+&prenda=playera$/);
  });

  it("'ahora no' lleva a la app sin pedir nada", () => {
    render(<TuRopaClient userId="u1" />);
    expect(screen.getByRole("link", { name: "ahora no" }).getAttribute("href")).toBe("/hoy");
  });
});
