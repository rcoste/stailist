// @vitest-environment jsdom
//
// "LA COMPRÉ" — lo que se blinda es QUÉ compra viaja al servidor, no el markup.
// Ese toque es la medición entera de la prueba de la vitrina (2026-10-21): si
// la prenda equivocada, el índice equivocado o el viaje equivocado llegan a
// markTripFaltaOwned, la compra se registra mal y cubre la pieza que no es, sin
// que nada truene en pantalla.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VitrinaFranja } from "@/components/vitrina-franja";
import type { PrendaVitrina } from "@/lib/vitrina-uniqlo";

afterEach(cleanup);

const h = vi.hoisted(() => ({
  marcar: vi.fn(async (_trip: string, _index: number, _variante: unknown, _compra: Record<string, unknown>) => ({ ok: true, itemId: "i1" })),
  refresh: vi.fn(),
}));

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span data-img={alt} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh, push: vi.fn() }) }));
vi.mock("@/lib/trip-actions", () => ({ markTripFaltaOwned: h.marcar }));
vi.mock("@/lib/vitrina-actions", () => ({
  registrarVitrinaVista: vi.fn(async (_c: string, _e: string[], _t: string, _d: string) => {}),
  registrarTiendaClick: vi.fn(async (_c: string, _e: string, _t: string, _d: string) => {}),
}));

const prenda = (n: string, id: string): PrendaVitrina => ({
  id: `us:${id}:09`,
  productId: id,
  colorCode: "09",
  mercado: "us",
  tienda: "Uniqlo EE. UU.",
  nombre: n,
  color: "BLACK",
  precio: 29.9,
  moneda: "USD",
  precioTexto: "US$29.90",
  url: `https://www.uniqlo.com/us/en/products/${id}/00?colorDisplayCode=09`,
  foto: `https://image.uniqlo.com/UQ/ST3/us/imagesgoods/${id}/item/x_09.jpg`,
  vistoEl: null,
});

describe("VitrinaFranja — la compré, en tienda y pesos", () => {
  it("'la compré' manda ESA prenda, ese viaje y esa pieza; luego dice 'en tu clóset'", async () => {
    render(
      <VitrinaFranja
        prendas={[prenda("Linen Blend Easy Shorts", "E482788-000"), prenda("Linen Blend Shorts", "E478001-000")]}
        clave="hombre|short|negro"
        desde="maleta"
        tripId="t1"
        index={4}
        tasas={{ USD: 18.52 }}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "la compré" })[1]);
    await waitFor(() => expect(h.marcar).toHaveBeenCalledTimes(1));
    const [trip, index, variante, compra] = h.marcar.mock.calls.at(-1)!;
    expect([trip, index, variante]).toEqual(["t1", 4, null]);
    expect(compra).toMatchObject({ entrada: "us:E478001-000:09", producto: "Linen Blend Shorts", precio: 29.9, moneda: "USD" });
    expect(await screen.findByText("en tu clóset")).toBeTruthy();
    expect(h.refresh).toHaveBeenCalled();
  });

  it("enseña el número de la etiqueta y el precio en pesos; sin viaje no ofrece 'la compré'", () => {
    render(<VitrinaFranja prendas={[prenda("Linen Blend Easy Shorts", "E482788-000")]} clave="k" desde="maleta" tasas={{ USD: 18.52 }} />);
    expect(screen.getByText(/en tienda: No\. 482788 · color 09/)).toBeTruthy();
    expect(screen.getByText(/≈ \$550 MXN/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "la compré" })).toBeNull();
  });
});
