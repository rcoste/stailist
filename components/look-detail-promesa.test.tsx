// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LookDetail } from "@/components/look-detail";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _f, sizes: _s, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));
// El corazón persiste con una server action; aquí solo estorba.
vi.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => null,
}));

afterEach(cleanup);

// LA FILA DEL VOTO, SOLA (2026-09-16). Aquí vivió "te digo cómo te queda", la
// puerta al fit check. Se fue porque se leía desconectada: recién generado el
// look todavía no te lo has puesto, rimaba con la pestaña "así te queda" (que
// es el render), y el fit check ni siquiera marca ESTE look — arma uno nuevo
// con la foto. La puerta sigue en Inicio. Si alguien la regresa aquí, que sea
// a propósito y conectada al look.

const base = {
  nombre: "Sastre Suelto de Noche",
  prendas: [{ id: "1", nombre: "camisa blanca", swatch: "#fff", imagen: null }],
  justificacion: "porque el gris carbón nunca falla cerca de tu cara",
  outfitId: "outfit-1",
  initialFavorited: false,
  voto: null,
  onVote: () => {},
};

describe("LookDetail — la fila de acciones", () => {
  it("no ofrece el fit check ni 'otro look': sólo el voto", () => {
    render(<LookDetail {...base} />);
    expect(screen.queryByText(/te digo cómo te queda/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /otro look/i })).toBeNull();
    expect(screen.getByRole("button", { name: /no me gusta este look/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^me gusta este look/i })).toBeTruthy();
  });
});

describe("LookDetail — el encabezado", () => {
  it("el nombre del look no se pinta: sólo queda para lectores de pantalla", () => {
    // "Saco y Mocasín de Domingo" en dos renglones de 27px no aportaba nada y
    // le quitaba alto a la foto (Roberto, 2026-09-16).
    render(<LookDetail {...base} />);
    const h1 = screen.getByRole("heading");
    expect(h1.textContent).toBe(base.nombre);
    expect(h1.className).toContain("sr-only");
  });

  it("con fecha, la fecha SÍ se ve (es información, el apodo no)", () => {
    render(<LookDetail {...base} seccionLabel="el jueves 13" />);
    expect(screen.getByText("el jueves 13")).toBeTruthy();
  });
});
