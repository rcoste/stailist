// @vitest-environment jsdom
//
// EL DIARIO — lo que se blinda es el BORRADO OPTIMISTA y su vuelta atrás.
//
// Borrar un look pasa por `marcarBorrado` + `revalidatePath`, y hasta que el
// server contestaba la fila seguía ahí, idéntica: confirmabas "sí, bórralo" y la
// pantalla no acusaba nada (reporte de Roberto, 2026-08-13 — el mismo síntoma
// que "le pico y no reacciona"). Ahora sale de la lista al instante.
//
// Lo optimista tiene un precio: si el server falla y NADIE lo revierte, la
// persona cree que borró un look que sigue vivo — y lo descubre al recargar. Esa
// vuelta atrás es invisible en el happy path, no la cubre ningún test de markup,
// y es exactamente lo que se rompe al refactorizar. Por eso este archivo.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoryList, type HistoryOutfit } from "@/app/historial/history-list";

afterEach(cleanup);

const { deleteOutfit, refresh, push } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- el parámetro existe para tipar mock.calls
  deleteOutfit: vi.fn(async (_id: string) => ({ ok: true })),
  refresh: vi.fn(() => {}),
  push: vi.fn((_url: string) => {}),
}));

vi.mock("@/lib/delete-actions", () => ({ deleteOutfit }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/historial",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/outfit-actions", () => ({
  voteOutfit: vi.fn(async () => ({ ok: true })),
  toggleFavorite: vi.fn(async () => ({ ok: true })),
  wearToday: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/pwa", () => ({ notifyFirstLike: vi.fn() }));
// El try-on del detalle sale por red y pide avatar; aquí sólo estorba.
vi.mock("@/lib/use-tryon", () => ({
  useTryon: () => ({
    mode: "idle",
    image: null,
    errMsg: null,
    generar: vi.fn(),
    openFull: vi.fn(),
    closeFull: vi.fn(),
    avatarHref: "/perfil/avatar",
  }),
}));
vi.mock("@/lib/use-wake-lock", () => ({ useWakeLock: vi.fn() }));

const look = (over: Partial<HistoryOutfit> = {}): HistoryOutfit => ({
  id: "o1",
  nombre: "Camisa blanca y jeans",
  explicacion: "porque sí",
  createdAt: "2026-08-10T12:00:00.000Z",
  fecha: "10 ago",
  occasion: "diario",
  origen: "daily",
  tryonImage: null,
  prendas: [{ nombre: "Camisa blanca", swatch: "#fff" }],
  voto: null,
  worn: false,
  favorited: false,
  ...over,
});

const otro = look({
  id: "o2",
  nombre: "Saco negro",
  createdAt: "2026-08-09T12:00:00.000Z",
  fecha: "9 ago",
});

/** Del diario al diálogo de confirmación de UN look: abrir → ⋯ → borrar. */
function pedirBorrado(nombre: string) {
  fireEvent.click(screen.getByRole("button", { name: `Abrir ${nombre}` }));
  fireEvent.click(screen.getByRole("button", { name: "más opciones" }));
  fireEvent.click(screen.getByRole("button", { name: /borrar este look/i }));
}

const enLista = (nombre: string) =>
  screen.queryByRole("button", { name: `Abrir ${nombre}` }) !== null;

beforeEach(() => {
  deleteOutfit.mockClear();
  refresh.mockClear();
  deleteOutfit.mockImplementation(async () => ({ ok: true }));
});

describe("HistoryList — borrado optimista", () => {
  it("el look sale de la lista ANTES de que conteste el server", async () => {
    // El server se queda colgado a propósito: si la fila sólo desapareciera al
    // resolver, este test la seguiría viendo.
    let resolver: (r: { ok: boolean }) => void = () => {};
    deleteOutfit.mockImplementation(
      () => new Promise<{ ok: boolean }>((r) => (resolver = r))
    );

    render(<HistoryList outfits={[look(), otro]} />);
    pedirBorrado("Camisa blanca y jeans");
    fireEvent.click(screen.getByRole("button", { name: "sí, bórralo" }));

    expect(deleteOutfit).toHaveBeenCalledWith("o1");
    expect(enLista("Camisa blanca y jeans")).toBe(false);
    // Y sólo se va el que se pidió: el diario no se vacía de más.
    expect(enLista("Saco negro")).toBe(true);

    resolver({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(enLista("Camisa blanca y jeans")).toBe(false);
  });

  it("si el server falla, el look REGRESA (no se puede mentir un borrado)", async () => {
    deleteOutfit.mockImplementation(async () => ({ ok: false }));

    render(<HistoryList outfits={[look(), otro]} />);
    pedirBorrado("Camisa blanca y jeans");
    fireEvent.click(screen.getByRole("button", { name: "sí, bórralo" }));

    expect(enLista("Camisa blanca y jeans")).toBe(false); // optimista
    await waitFor(() => expect(enLista("Camisa blanca y jeans")).toBe(true));
    // Y NO se refresca: refrescar sobre un borrado que no ocurrió sólo
    // repintaría lo mismo y taparía el problema.
    expect(refresh).not.toHaveBeenCalled();
  });

  it("«mejor no» no borra nada", () => {
    render(<HistoryList outfits={[look(), otro]} />);
    pedirBorrado("Camisa blanca y jeans");
    fireEvent.click(screen.getByRole("button", { name: "mejor no" }));

    expect(deleteOutfit).not.toHaveBeenCalled();
    expect(enLista("Camisa blanca y jeans")).toBe(true);
  });

  it("el detalle se cierra al confirmar: nunca queda abierto sobre un look que ya no existe", async () => {
    render(<HistoryList outfits={[look(), otro]} />);
    pedirBorrado("Camisa blanca y jeans");
    fireEvent.click(screen.getByRole("button", { name: "sí, bórralo" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "más opciones" })).toBeNull();
  });
});
