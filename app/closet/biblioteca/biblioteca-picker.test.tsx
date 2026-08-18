// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BibliotecaPicker } from "./biblioteca-picker";
import type { CatalogItem } from "@/app/onboarding/closet/checklist";

afterEach(cleanup);

// LA BIBLIOTECA — lo que se blinda es qué viaja: los ids que recibe
// addArchetypes y las llamadas por pieza de la wishlist del traje.
//
// La parte con lógica de verdad es toggleWishTraje: guarda/quita las DOS
// piezas, pero el server action es un TOGGLE por pieza — así que si el saco ya
// estaba guardado suelto y ahora guardas el traje, llamar toggle sobre el saco
// lo QUITARÍA. El skip (`yaEsta === target → no llamar`) es exactamente lo que
// un refactor rompe sin ruido; estos tests lo dejan clavado.

// Firmas completas para que mock.calls quede tipado (regla del repo).
const { addArchetypes, toggleWishlistArchetype } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tipa mock.calls
  addArchetypes: vi.fn(async (_ids: number[]) => ({ ok: true, added: 2 })),
  toggleWishlistArchetype: vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tipa mock.calls
    async (_input: {
      archetypeId: number;
      name: string;
      imageUrl: string | null;
      colorHex: string | null;
    }) => ({ ok: true, saved: true })
  ),
}));
vi.mock("@/app/closet/actions", () => ({ addArchetypes }));
vi.mock("@/lib/wishlist-actions", () => ({ toggleWishlistArchetype }));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => {
  addArchetypes.mockClear();
  toggleWishlistArchetype.mockClear();
});

const CARBON = "c0a21321-b0de-4a11-9b71-000000000321";

const item = (
  id: number,
  name: string,
  category: string,
  conjunto?: string
): CatalogItem => ({
  id,
  name,
  category,
  attrs: conjunto ? { conjunto } : {},
  image_path: null,
});

const CATALOGO: CatalogItem[] = [
  item(1, "Camiseta blanca", "top"),
  item(321, "Saco de traje gris carbón", "saco", CARBON),
  item(322, "Pantalón de traje gris carbón", "bottom", CARBON),
];

/** El contenedor de la tarjeta del traje (botón + bookmark viven juntos). */
const cardDeTraje = () =>
  screen.getByText("Traje gris carbón").closest("div.relative") as HTMLElement;

describe("el traje en la biblioteca", () => {
  it("agregar el traje manda LAS DOS piezas a addArchetypes", async () => {
    const u = userEvent.setup();
    render(<BibliotecaPicker catalog={CATALOGO} />);

    await u.click(screen.getByRole("button", { name: /traje gris carbón/i }));
    await u.click(screen.getByRole("button", { name: /agregar a mi clóset \(2\)/i }));

    await waitFor(() => expect(addArchetypes).toHaveBeenCalled());
    const ids = [...addArchetypes.mock.calls.at(-1)![0]].sort((a, b) => a - b);
    expect(ids).toEqual([321, 322]);
  });

  it("wishlist con estado MIXTO: solo se toggletea la pieza que falta", async () => {
    // El saco ya estaba guardado suelto. Guardar el traje debe llamar el
    // toggle SOLO para el pantalón — llamarlo para el saco lo quitaría.
    const u = userEvent.setup();
    render(<BibliotecaPicker catalog={CATALOGO} savedWishIds={[321]} />);

    await u.click(within(cardDeTraje()).getByRole("button", { name: /agregar a wishlist/i }));

    await waitFor(() => expect(toggleWishlistArchetype).toHaveBeenCalledTimes(1));
    expect(toggleWishlistArchetype.mock.calls[0][0].archetypeId).toBe(322);
  });

  it("quitar el traje de la wishlist toggletea las dos piezas", async () => {
    const u = userEvent.setup();
    render(<BibliotecaPicker catalog={CATALOGO} savedWishIds={[321, 322]} />);

    await u.click(within(cardDeTraje()).getByRole("button", { name: /quitar de wishlist/i }));

    await waitFor(() => expect(toggleWishlistArchetype).toHaveBeenCalledTimes(2));
    const ids = toggleWishlistArchetype.mock.calls.map((c) => c[0].archetypeId).sort();
    expect(ids).toEqual([321, 322]);
  });

  it("si el server falla, el optimismo se revierte a lo que el server confirmó", async () => {
    // El pitfall documentado del repo: un optimista sin rollback deja la UI
    // mintiendo para siempre. saved:false = el server NO la tiene guardada.
    toggleWishlistArchetype.mockResolvedValueOnce({ ok: false, saved: false });
    const u = userEvent.setup();
    render(<BibliotecaPicker catalog={CATALOGO} />);

    await u.click(within(cardDeTraje()).getByRole("button", { name: /agregar a wishlist/i }));

    // Las dos piezas se intentaron; la primera falló → su marca se revierte y
    // el bookmark del traje vuelve a "agregar" (ya no están las dos guardadas).
    await waitFor(() => expect(toggleWishlistArchetype).toHaveBeenCalledTimes(2));
    expect(
      await within(cardDeTraje()).findByRole("button", { name: /agregar a wishlist/i })
    ).toBeTruthy();
    expect(await screen.findByText(/no pude guardar el traje completo/i)).toBeTruthy();
  });

  it("buscar por el nombre de una PIEZA encuentra el traje", async () => {
    // Nadie escribe "traje gris carbón" completo; "carbon" (sin acento) debe
    // dar con la tarjeta vía el nombre de sus piezas.
    const u = userEvent.setup();
    render(<BibliotecaPicker catalog={CATALOGO} />);

    await u.type(screen.getByPlaceholderText(/busca un básico/i), "carbon");

    expect(screen.getByText("Traje gris carbón")).toBeTruthy();
    expect(screen.queryByText("Camiseta blanca")).toBeNull();
  });
});
