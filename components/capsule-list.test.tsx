// @vitest-environment jsdom
//
// LA LISTA DE ESENCIALES — lo que se blinda es A QUÉ PRENDAS se les paga un render.
//
// Auto-dibujar TUS prendas sin foto (2026-08-13) conecta la lista al render bajo
// demanda que ya usaban la maleta y Hoy. Cada render es una llamada de imagen
// que se cobra la primera vez, así que la decisión de producto no es "se ven
// bonitas": es EXACTAMENTE cuáles entran a la cola y que la cola se dispare una
// sola vez por visita.
//
// Un refactor que quite el guard de `imgs[nombre]`, o que deje el efecto sin su
// candado, no rompe ninguna pantalla — sólo empieza a cobrar de más, en
// silencio. Por eso los tests miran las llamadas a `requestItemRender`, no el
// markup de los tiles.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { CapsuleList } from "@/components/capsule-list";
import type { CapsuleItem, CapsuleMatch, CapsuleTarget } from "@/lib/capsule";

afterEach(cleanup);

const { requestItemRender, prewarmRenders } = vi.hoisted(() => ({
  requestItemRender: vi.fn(async (id: string) => ({
    ok: true,
    url: `https://firmada/${id}.png`,
    skipped: false,
  })),
  prewarmRenders: vi.fn(async () => {}),
}));

vi.mock("@/lib/render-on-demand", () => ({ requestItemRender }));
vi.mock("@/lib/prewarm-renders", () => ({ prewarmRenders }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-img={alt} />,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/closet/capsula",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/closet/capsula/actions", () => ({
  dismissCapsuleSlot: vi.fn(async () => ({ ok: true })),
  markFaltaOwned: vi.fn(async () => ({ ok: true })),
  rejectCapsuleItem: vi.fn(async () => ({ ok: true })),
  setCapsuleOverride: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/wishlist-actions", () => ({
  toggleWishlistFromCapsule: vi.fn(async () => ({ ok: true })),
}));

const pieza = (nombre: string, prioridad: number): CapsuleItem => ({
  nombre,
  tipo: "camisa",
  category: "top",
  colorFamilia: "neutro claro",
  formalidad: "casual",
  temporada: "todo-el-año",
  prioridad,
  porque: "porque sí",
});

/**
 * Tres piezas CUBIERTAS por prendas propias ("ya lo tienes"), que es donde vive
 * el caso: la lista sabe el nombre de tu prenda y quiere enseñarla.
 *   · "Camisa mía"  — ya trae foto → no se le paga nada.
 *   · "Suéter mío"  — sin foto pero con id → ÉSTA es la que se dibuja.
 *   · "Saco fantasma" — sin foto y sin id (no está en el clóset) → no hay qué pedir.
 */
const target: CapsuleTarget = {
  version: 2,
  items: [pieza("Camisa blanca", 1), pieza("Suéter gris", 2), pieza("Saco azul", 3)],
};
const match: CapsuleMatch = {
  signature: "s1",
  entries: [
    { status: "tienes", by: "Camisa mía", difiere: null },
    { status: "tienes", by: "Suéter mío", difiere: null },
    { status: "tienes", by: "Saco fantasma", difiere: null },
  ],
};

function pintar(over: Partial<React.ComponentProps<typeof CapsuleList>> = {}) {
  return render(
    <CapsuleList
      target={target}
      match={match}
      overrides={null}
      images={{ "Camisa mía": "https://firmada/camisa.png" }}
      nameToId={{ "Camisa mía": "i1", "Suéter mío": "i2" }}
      userId="u1"
      {...over}
    />
  );
}

beforeEach(() => {
  requestItemRender.mockClear();
  requestItemRender.mockImplementation(async (id: string) => ({
    ok: true,
    url: `https://firmada/${id}.png`,
    skipped: false,
  }));
});

describe("CapsuleList — auto-dibujo de tus prendas sin foto", () => {
  it("sólo pide el render de la tuya que no tiene foto y SÍ está en el clóset", async () => {
    pintar();

    await waitFor(() => expect(requestItemRender).toHaveBeenCalled());
    expect(requestItemRender.mock.calls.map((c) => c[0])).toEqual(["i2"]);
  });

  it("si ya tienes foto de todas, no se paga ni un render", async () => {
    pintar({
      images: {
        "Camisa mía": "https://firmada/camisa.png",
        "Suéter mío": "https://firmada/sueter.png",
        "Saco fantasma": "https://firmada/saco.png",
      },
    });

    // Un tick real para que corran los efectos; la cola debe quedar vacía.
    await new Promise((r) => setTimeout(r, 0));
    expect(requestItemRender).not.toHaveBeenCalled();
  });

  it("un solo disparo por visita: cada prenda se pide UNA vez aunque la lista repinte", async () => {
    const { rerender } = pintar();
    await waitFor(() => expect(requestItemRender).toHaveBeenCalledTimes(1));

    rerender(
      <CapsuleList
        target={target}
        match={match}
        overrides={null}
        images={{ "Camisa mía": "https://firmada/camisa.png" }}
        nameToId={{ "Camisa mía": "i1", "Suéter mío": "i2" }}
        userId="u1"
      />
    );

    await waitFor(() => expect(requestItemRender).toHaveBeenCalledTimes(1));
  });

  it("una prenda repetida en varias filas se dibuja una sola vez", async () => {
    const repetido: CapsuleMatch = {
      signature: "s1",
      entries: [
        { status: "tienes", by: "Suéter mío", difiere: null },
        { status: "tienes", by: "Suéter mío", difiere: null },
        { status: "tienes", by: "Suéter mío", difiere: null },
      ],
    };
    pintar({ match: repetido });

    await waitFor(() => expect(requestItemRender).toHaveBeenCalledTimes(1));
    expect(requestItemRender).toHaveBeenCalledWith("i2");
  });
});
