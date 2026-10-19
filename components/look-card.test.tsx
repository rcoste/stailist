// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LookCard, type LookCardData } from "@/components/look-card";

// next/image exige configuración del loader que en jsdom no existe.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

afterEach(cleanup);

// Lo que este test blinda es la decisión de producto del 2026-10-19: un look
// con una pieza que TE FALTA se puede probar (verte con ella antes de
// comprarla), pero no se guarda en favoritos (el historial es de lo que tienes).
// Si quien llama no da cómo crear la fila (el viaje, hoy), no hay try-on.

const look: LookCardData = {
  ocasion: "ciudad",
  titulo: "Vino de noche",
  porque: "porque sí",
  tip: null,
  prendas: [
    { nombre: "Pantalón de vestir negro", image: null, id: "a" },
    { nombre: "Cuello alto de lana merino vino", image: null, falta: true },
  ],
};

const props = {
  look,
  voto: null,
  favorito: false,
  onVote: () => {},
  onDownReason: () => {},
  onFavorite: () => {},
  returnTo: "/closet/capsula?tab=looks",
};

describe("LookCard con una pieza que te falta", () => {
  it("esenciales: se puede probar, pero sin corazón", () => {
    render(<LookCard {...props} faltaAlgo ensureOutfitId={async () => "o1"} />);
    expect(screen.getByRole("button", { name: /verme con este look/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /favoritos/i })).toBeNull();
  });

  it("sin cómo crear la fila (viaje): ni try-on ni corazón", () => {
    render(<LookCard {...props} faltaAlgo />);
    expect(screen.queryByRole("button", { name: /verme con este look/i })).toBeNull();
    expect(screen.getByText(/cuando lo tengas, te lo pruebas/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /favoritos/i })).toBeNull();
  });

  it("todo tuyo: try-on y corazón", () => {
    render(<LookCard {...props} ensureOutfitId={async () => "o1"} />);
    expect(screen.getByRole("button", { name: /verme con este look/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /guardar en favoritos/i })).toBeTruthy();
  });
});
