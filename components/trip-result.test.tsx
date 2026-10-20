// @vitest-environment jsdom
//
// LA MALETA SIN VITRINA SE VE IGUAL QUE SIEMPRE (contrato de regresión, D5 de la
// revisión de docs/designs/vitrina-de-tienda.md, 2026-10-20).
//
// La vitrina de Uniqlo sólo aparece en viajes a EE. UU., Japón o Corea: 1 de
// los 13 viajes vivos cuando se construyó. Los otros 12 pasan por este mismo
// componente, que ahora recibe una prop nueva (`vitrina`), y tienen que
// verse EXACTAMENTE como antes. Lo que se blinda no es el markup de la card:
// es que (1) sin vitrina la lista de "te falta" pinta las mismas piezas y las
// mismas acciones, y (2) con vitrina, el nodo cuelga bajo la card de SU
// índice y de ninguna otra. Un refactor que cablee mal la prop no rompe
// ninguna pantalla visible para quien la revisa con un viaje a Japón; rompe
// la de todos los demás.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TripResult, type TripRow } from "@/components/trip-result";
import { TripPackedProvider } from "@/components/trip-packed-context";

afterEach(cleanup);

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-img={alt} />,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/viaje/t1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/prewarm-renders", () => ({ prewarmRenders: vi.fn(async () => {}) }));
vi.mock("@/components/ideal-tile", () => ({
  useIdealRender: () => ({ state: "idle", src: null, start: vi.fn(async () => {}), freno: null }),
  IdealTileInner: ({ colorFamilia }: { colorFamilia: string }) => <span data-tile={colorFamilia} />,
}));
vi.mock("@/lib/trip-actions", () => ({
  dismissTripCandidate: vi.fn(async () => ({ ok: true })),
  proposeTripSubstitutes: vi.fn(async () => ({})),
  undoTripDuel: vi.fn(async () => ({ ok: true })),
  setTripOverride: vi.fn(async () => ({ ok: true })),
  setTripPacked: vi.fn(async () => ({ ok: true })),
  setTripPackedAll: vi.fn(async () => ({ ok: true })),
  setTripSubstitute: vi.fn(async () => ({ ok: true })),
  suggestTripSubstitutes: vi.fn(async () => []),
  markTripFaltaOwned: vi.fn(async () => ({ ok: true })),
  excludeTripPiece: vi.fn(async () => ({ ok: true })),
  replaceTripPiece: vi.fn(async () => ({ ok: true })),
  rejectTripDuel: vi.fn(async () => ({ ok: true })),
  listTripClosetOptions: vi.fn(async () => []),
  recalcularMaletaViaje: vi.fn(async () => ({ ok: true })),
  posiblesYaLoTengo: vi.fn(async () => []),
}));
vi.mock("@/lib/wishlist-actions", () => ({
  toggleWishlistFromCapsule: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/components/import-carrete-flow", () => ({ ImportCarreteFlow: () => null }));
vi.mock("@/components/match-recalc", () => ({ MatchRecalc: () => null }));
vi.mock("@/components/prenda-zoom", () => ({ PrendaZoom: () => null }));
vi.mock("@/components/motivo-sheet", () => ({ MotivoSheet: () => null }));
vi.mock("@/components/trip-pieza-opciones", () => ({
  MasOpcionesSheet: () => null,
  ParecidoSheet: () => null,
}));

const fila = (index: number, nombre: string, tipo: string, colorFamilia: string, base: TripRow["base"], by: string | null = null): TripRow => ({
  index,
  nombre,
  porque: "porque sí",
  base,
  decision: null,
  by,
  byImage: null,
  faltaKey: `${tipo}|${colorFamilia}`,
  idealImage: null,
  renderArgs: {
    tipo,
    colorFamilia,
    nombre,
    categoria: "top",
    formalidad: "casual",
    temporada: "todo-el-año",
    visual: nombre,
  } as TripRow["renderArgs"],
});

// Dos piezas que faltan (0 y 1) y una que ya tienes (2): la vitrina sólo puede
// colgar de las dos primeras, y sólo de la suya.
const rows: TripRow[] = [
  fila(0, "Suéter de punto vino", "sueter-punto", "vino", "falta"),
  fila(1, "Jeans negros rectos", "jeans", "negro", "falta"),
  fila(2, "Camisa blanca", "camisa", "blanco", "tienes", "Camisa mía"),
];

function pintar(vitrina?: Record<number, React.ReactNode>) {
  return render(
    <TripPackedProvider initial={{}}>
      <TripResult tripId="t1" userId="u1" rows={rows} vitrina={vitrina} />
    </TripPackedProvider>
  );
}

const textos = () => screen.getAllByRole("button").map((b) => b.textContent?.trim()).filter(Boolean);

describe("TripResult — la maleta con y sin vitrina", () => {
  it("sin vitrina: las dos piezas que faltan pintan su card con 'ya lo tengo' y 'wishlist', como siempre", () => {
    pintar();
    expect(screen.getByText("Suéter de punto vino")).toBeTruthy();
    expect(screen.getByText("Jeans negros rectos")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /ya lo tengo/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^wishlist$/i })).toHaveLength(2);
    expect(screen.queryByTestId(/^vitrina-/)).toBeNull();
  });

  it("con vitrina: el nodo cuelga bajo la card de su índice y de ninguna otra, sin cambiar las acciones", () => {
    const sin = pintar();
    const accionesSin = textos();
    sin.unmount();

    pintar({ 1: <span data-testid="vitrina-1">la hay en Uniqlo Japón</span> });
    const nodo = screen.getByTestId("vitrina-1");
    const cardJeans = screen.getByText("Jeans negros rectos").closest("li")!;
    const cardSueter = screen.getByText("Suéter de punto vino").closest("li")!;
    expect(cardJeans.contains(nodo)).toBe(true);
    expect(cardSueter.contains(nodo)).toBe(false);
    expect(within(cardSueter).queryByTestId(/^vitrina-/)).toBeNull();
    // Las mismas acciones, en el mismo orden: la vitrina no mueve nada.
    expect(textos()).toEqual(accionesSin);
  });

  it("una vitrina para un índice que no falta (ya la tienes) no se pinta", () => {
    pintar({ 2: <span data-testid="vitrina-2">no debería verse</span> });
    expect(screen.queryByTestId("vitrina-2")).toBeNull();
  });
});
