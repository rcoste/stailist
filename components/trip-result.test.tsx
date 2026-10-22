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
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { listTripClosetOptions } from "@/lib/trip-actions";
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
  listTripClosetOptions: vi.fn(async (_tripId: string, _index: number) => []),
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

// "PREFERISTE LA SUGERIDA" Y LUEGO LA CUBRISTE (2026-10-21). Ganó la sugerida
// en el duelo (candNo) y después tocaste "ya lo tengo" o "la compré": el cruce
// ya dice "tienes", pero la tarjeta se quedaba en "no lo tienes — cómprala"
// para siempre. Esto blinda que se mude a lo que tienes.
describe("TripResult — un duelo que ganó la sugerida y luego se cubrió", () => {
  function pintarDuelo(base: TripRow["base"]) {
    const r = fila(0, "Short de lino negro", "short", "negro", base);
    return render(
      <TripPackedProvider initial={{}}>
        <TripResult
          tripId="t1"
          userId="u1"
          rows={[r]}
          candidatasIniciales={{ 0: { nombre: "Short de lino azul marino", image: null } as never }}
          descartadosIniciales={[0]}
        />
      </TripPackedProvider>
    );
  }

  it("mientras falta, sigue en compras con 'ya lo tengo'", () => {
    pintarDuelo("falta");
    expect(screen.getByText(/no lo tienes/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /ya lo tengo/i })).toBeTruthy();
  });

  it("ya cubierta, sale de compras", () => {
    pintarDuelo("tienes");
    expect(screen.queryByText(/no lo tienes/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /ya lo tengo/i })).toBeNull();
  });
});

// EL DUELO DICE QUÉ CAMBIA (2026-10-21). "Sneakers de piel blancos" contra sus
// "Tenis blancos" (sintéticos): dos fotos casi idénticas y ninguna razón a la
// vista, así que parecía que la app preguntaba por la misma prenda.
describe("TripResult — el duelo de un parecido dice qué cambia", () => {
  it("el rótulo nombra la diferencia del match", () => {
    const parecido: TripRow = { ...fila(0, "Sneakers de piel blancos", "sneakers", "blanco", "parecido", "Tenis blancos"), difiere: "sintético en vez de piel" };
    render(
      <TripPackedProvider initial={{}}>
        <TripResult tripId="t1" userId="u1" rows={[parecido]} />
      </TripPackedProvider>
    );
    expect(screen.getByText(/cambia: sintético en vez de piel/)).toBeTruthy();
  });
});

// "ELEGIR OTRA DE MI CLÓSET" EN EL DUELO (2026-10-21). "Capaz digo: me gustaría
// ésta en particular." Lo que viaja es la pieza: abre la lista de SU clóset
// para ESE índice (listTripClosetOptions, sin IA).
describe("TripResult — elegir otra de mi clóset desde el duelo", () => {
  it("abre la lista de su clóset para esa pieza", async () => {
    const parecido: TripRow = { ...fila(4, "Suéter de cuello redondo gris oscuro", "sueter", "gris", "parecido", "Playera cuello redondo gris"), difiere: "¿es la misma?" };
    render(
      <TripPackedProvider initial={{}}>
        <TripResult tripId="t1" userId="u1" rows={[parecido]} />
      </TripPackedProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /elegir otra de mi clóset/i }));
    expect(vi.mocked(listTripClosetOptions)).toHaveBeenCalledWith("t1", 4);
  });
});

// UNA PRENDA PARA DOS PIEZAS SE AVISA (2026-10-21). Su "Camisa de franela gris"
// ya cubría una pieza y el duelo de otra se la ofrecía otra vez. Elegirla es
// válido; lo que se blinda es que la tarjeta lo diga.
describe("TripResult — el duelo avisa si tu prenda ya va por otra pieza", () => {
  it("nombra la pieza que ya cubre", () => {
    const cubierta = fila(0, "Camisa de franela gris oscuro", "camisa", "gris", "tienes", "Camisa de franela gris");
    const duelo: TripRow = { ...fila(1, "Camisa gris oscuro de twill", "camisa", "gris", "parecido", "Camisa de franela gris"), difiere: "estampado rayas en vez de liso" };
    render(
      <TripPackedProvider initial={{}}>
        <TripResult tripId="t1" userId="u1" rows={[cubierta, duelo]} />
      </TripPackedProvider>
    );
    expect(screen.getByText(/ya va en tu maleta por «camisa de franela gris oscuro»/)).toBeTruthy();
  });

  it("si no cubre otra pieza, no avisa", () => {
    const duelo: TripRow = { ...fila(1, "Camisa gris oscuro de twill", "camisa", "gris", "parecido", "Camisa de franela gris"), difiere: "estampado rayas en vez de liso" };
    render(
      <TripPackedProvider initial={{}}>
        <TripResult tripId="t1" userId="u1" rows={[duelo]} />
      </TripPackedProvider>
    );
    expect(screen.queryByText(/ya va en tu maleta por/)).toBeNull();
  });
});

// Y DESPUÉS DE ELEGIR TAMBIÉN (2026-10-21): su franela quedó cubriendo dos
// piezas y la tarjeta resuelta no lo decía.
describe("TripResult — una prenda que cubre dos piezas se ve también ya resuelta", () => {
  it("la tarjeta resuelta dice qué otra pieza cubre y la cuadrícula marca ×2", () => {
    const tienes = fila(0, "Camisa azul marino de franela", "camisa", "marino", "tienes", "Camisa de franela gris");
    const aceptada: TripRow = { ...fila(1, "Camisa gris oscuro de twill", "camisa", "gris", "parecido", "Camisa de franela gris"), decision: "accept" };
    render(
      <TripPackedProvider initial={{}}>
        <TripResult tripId="t1" userId="u1" rows={[tienes, aceptada]} />
      </TripPackedProvider>
    );
    expect(screen.getByText(/también va por «camisa azul marino de franela»/)).toBeTruthy();
    expect(screen.getByLabelText("cubre 2 piezas")).toBeTruthy();
  });
});

// LO QUE LLEVAS, CONTADO Y AGRUPADO (2026-10-21, pedido de Roberto).
describe("TripResult — resumen por grupo", () => {
  it("cuenta por grupo contra lo que pide el viaje y agrupa lo que ya tienes", () => {
    const rows: TripRow[] = [
      fila(0, "Camisa blanca", "camisa", "blanco", "tienes", "Camisa blanca"),
      { ...fila(1, "Jeans negros", "jeans", "negro", "tienes", "Jeans negros"), renderArgs: { ...fila(1, "Jeans negros", "jeans", "negro", "tienes").renderArgs, categoria: "bottom" } },
    ];
    render(
      <TripPackedProvider initial={{}}>
        <TripResult tripId="t1" userId="u1" rows={rows} piso={{ base: 5, bottoms: 3, calzado: 2 }} />
      </TripPackedProvider>
    );
    expect(screen.getByText("camisas, playeras y blusas · 1 de 5")).toBeTruthy();
    expect(screen.getByText("pantalones y faldas · 1 de 3")).toBeTruthy();
    expect(screen.getByText("zapatos · 0 de 2")).toBeTruthy();
    expect(screen.getByText("camisas, playeras y blusas · 1")).toBeTruthy();
  });
});
