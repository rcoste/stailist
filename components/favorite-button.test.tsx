// @vitest-environment jsdom
//
// EL CORAZÓN — lo que se blinda es que el estado del corazón y el de la base
// terminen diciendo LO MISMO.
//
// El botón es optimista: pinta primero y guarda después. Sin candado, dos taps
// rápidos encolaban dos server actions contra el mismo look (una con `true` y
// otra con `false`); ganaba la que resolviera al último, que no tiene por qué
// ser la que la persona vio. El corazón quedaba lleno con el look sin guardar,
// o al revés — y el único síntoma aparecía al recargar, días después.
//
// Por eso los tests miran QUÉ se le manda a `toggleFavorite` y qué dice el
// `aria-pressed` al final, no cómo se ve el svg.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FavoriteButton } from "@/components/favorite-button";

afterEach(cleanup);

// Firma completa a propósito (ver el mismo comentario en closet-grid.test.tsx):
// abajo se inspeccionan los ARGUMENTOS, y `vi.fn(async () => …)` dejaría
// `mock.calls` tipado como `[][]` — TS2493 que vitest no ve pero `next build` sí.
const { toggleFavorite } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- los parámetros existen para tipar mock.calls
  toggleFavorite: vi.fn(async (_outfitId: string, _favorite: boolean) => ({ ok: true })),
}));

vi.mock("@/lib/outfit-actions", () => ({ toggleFavorite }));

beforeEach(() => {
  toggleFavorite.mockClear();
  toggleFavorite.mockImplementation(async () => ({ ok: true }));
});

const corazon = () => screen.getByRole("button");

describe("FavoriteButton — un toggle a la vez", () => {
  it("dos taps en el mismo frame guardan UNA vez, y guardan lo que se ve", async () => {
    render(<FavoriteButton outfitId="o1" initialFavorited={false} />);

    fireEvent.click(corazon());
    fireEvent.click(corazon()); // el segundo tap cae mientras el primero está en vuelo

    expect(toggleFavorite).toHaveBeenCalledTimes(1);
    expect(toggleFavorite).toHaveBeenCalledWith("o1", true);
    // Lo pintado y lo mandado coinciden: corazón lleno ↔ favorito true.
    expect(corazon().getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledTimes(1));
  });

  it("el candado se suelta al resolver: quitar el favorito después SÍ pasa", async () => {
    render(<FavoriteButton outfitId="o1" initialFavorited={false} />);

    fireEvent.click(corazon());
    await waitFor(() => expect(corazon().getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(corazon());
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledTimes(2));
    expect(toggleFavorite).toHaveBeenLastCalledWith("o1", false);
    expect(corazon().getAttribute("aria-pressed")).toBe("false");
  });

  it("si el server falla, el corazón vuelve a como estaba", async () => {
    toggleFavorite.mockImplementation(async () => ({ ok: false }));
    const onChange = vi.fn((_favorited: boolean) => {});
    render(<FavoriteButton outfitId="o1" initialFavorited={false} onChange={onChange} />);

    fireEvent.click(corazon());
    expect(corazon().getAttribute("aria-pressed")).toBe("true"); // optimista

    await waitFor(() => expect(corazon().getAttribute("aria-pressed")).toBe("false"));
    // El padre también se entera de la reversión (Hoy e Historial pintan su
    // propio corazón a partir de esto).
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("si la action REVIENTA (sin red), revierte y el corazón sigue vivo", async () => {
    toggleFavorite.mockImplementation(async () => {
      throw new Error("network");
    });
    render(<FavoriteButton outfitId="o1" initialFavorited={false} />);

    fireEvent.click(corazon());
    await waitFor(() => expect(corazon().getAttribute("aria-pressed")).toBe("false"));

    // Y el candado se soltó: sin `finally`, el botón quedaría muerto para
    // siempre — el mismo "le pico y no reacciona" que venía a evitar, pero peor.
    toggleFavorite.mockImplementation(async () => ({ ok: true }));
    fireEvent.click(corazon());
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledTimes(2));
    expect(corazon().getAttribute("aria-pressed")).toBe("true");
  });

  it("el acuse «guardado en tus favoritos» sale al guardar, no al quitar", async () => {
    render(<FavoriteButton outfitId="o1" initialFavorited={false} confirmaDestino />);

    fireEvent.click(corazon());
    expect(screen.getByRole("status").textContent).toContain("guardado en tus favoritos");
    // Y lleva la salida al sitio donde quedó (feedback de Alberto).
    expect(screen.getByRole("link", { name: "ver" }).getAttribute("href")).toBe(
      "/historial?filtro=fav"
    );

    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledTimes(1));
  });

  it("quitar el favorito NO ofrece ir a verlo (acabas de decir que no lo quieres ahí)", async () => {
    render(<FavoriteButton outfitId="o1" initialFavorited confirmaDestino />);

    fireEvent.click(corazon());
    await waitFor(() => expect(toggleFavorite).toHaveBeenLastCalledWith("o1", false));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sin confirmaDestino el corazón guarda callado (Historial y wow ya están en el destino)", async () => {
    render(<FavoriteButton outfitId="o1" initialFavorited={false} />);

    fireEvent.click(corazon());
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
