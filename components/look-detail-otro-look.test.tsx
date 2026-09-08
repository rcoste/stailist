// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LookDetail } from "@/components/look-detail";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _f, sizes: _s, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));
vi.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => null,
}));

afterEach(cleanup);

// LA DECISIÓN QUE VIAJA (2026-09-08): en el primer look del wow, "otro look"
// dejó de ser un botón suelto. Roberto: "mucha gente le va a picar y en vez de
// avanzar van a regresar". Pedir otro vive bajo el 👎: la persona dice que NO
// le gustó antes de ver los otros dos del trío — la señal que el atajo se
// saltaba (Hoy lo quitó por lo mismo el 2026-08-12). Hoy sólo 5 de 24 votan su
// primer look; este pliegue es para que el que quiere otro, primero vote.

const base = {
  nombre: "Sutileza en Burdeos",
  prendas: [{ id: "1", nombre: "camisa azul claro", swatch: "#A9C4E0", imagen: null }],
  justificacion: "camisa azul claro con marino es un combo clásico que nunca falla",
  outfitId: "outfit-1",
  initialFavorited: false,
  onVote: () => {},
  enterApp: () => {},
};

describe("LookDetail — pedir otro look vive bajo el 👎", () => {
  it("sin onOtroLook (el wow) no hay botón 'otro look', y la salida a la app sigue", () => {
    render(<LookDetail {...base} voto={null} bajoVotoNegativo={<p>¿probamos otro de los tres?</p>} />);
    expect(screen.queryByRole("button", { name: /otro look/i })).toBeNull();
    expect(screen.getByRole("button", { name: /entrar a la app/i })).toBeTruthy();
  });

  it("las alternativas NO se ven antes de votar: primero dices que no te gustó", () => {
    render(<LookDetail {...base} voto={null} bajoVotoNegativo={<p>¿probamos otro de los tres?</p>} />);
    expect(screen.queryByText(/probamos otro de los tres/i)).toBeNull();
  });

  it("con 👎 aparecen; con 👍 no (el único camino que queda es entrar a la app)", () => {
    const { unmount } = render(
      <LookDetail {...base} voto="down" bajoVotoNegativo={<p>¿probamos otro de los tres?</p>} />
    );
    expect(screen.getByText(/probamos otro de los tres/i)).toBeTruthy();
    unmount();
    render(<LookDetail {...base} voto="up" bajoVotoNegativo={<p>¿probamos otro de los tres?</p>} />);
    expect(screen.queryByText(/probamos otro de los tres/i)).toBeNull();
  });

  it("el 👎 sigue registrando el voto (no es sólo la llave de las alternativas)", () => {
    const onVote = vi.fn((_up: boolean) => {});
    render(<LookDetail {...base} voto={null} onVote={onVote} />);
    fireEvent.click(screen.getByRole("button", { name: /no me gusta este look/i }));
    expect(onVote).toHaveBeenCalledWith(false);
  });

  it("el historial (con onOtroLook y sin fit check) conserva su botón", () => {
    const onOtroLook = vi.fn();
    render(<LookDetail {...base} voto={null} onOtroLook={onOtroLook} />);
    fireEvent.click(screen.getByRole("button", { name: /otro look/i }));
    expect(onOtroLook).toHaveBeenCalledTimes(1);
  });
});
