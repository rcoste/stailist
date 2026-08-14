// @vitest-environment jsdom
//
// A DÓNDE LLEVA CADA ATAJO DE LA HOJA "MÁS".
//
// Se blinda el DESTINO y nada más: el markup de la hoja ya cambió tres veces
// (mosaicos, dos niveles, morfo de alto) y volverá a cambiar. A dónde va cada
// cosa, no.
//
// Y existe porque el href de "viajes" se equivocó DOS VECES seguidas: primero
// llevaba a un asistente en blanco cuando el viaje salía a más de 7 días, y
// después —al arreglarlo— se saltaba la lista y metía dentro de la maleta viva.
// Los dos fallos comparten forma: el destino dependía del estado del viaje.
// Ahora es fijo, y esto lo mantiene fijo.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoreSheet } from "./more-sheet";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/hoy",
}));

// El flujo de añadir arrastra server actions (y con ellas `server-only`).
// Se simula entero: esta hoja se mira por sus destinos, no por sus flujos.
vi.mock("@/components/import-carrete-flow", () => ({
  ImportCarreteFlow: () => null,
}));

const VIAJE_VIVO = {
  id: "t1",
  lugar: "Kioto",
  dias: 3,
  // El detalle de ESE viaje: lo que este atajo NO debe abrir.
  href: "/viaje/t1",
};

beforeEach(() => {
  push.mockReset();
  // jsdom no trae matchMedia y la hoja lo consulta para respetar "reducir
  // movimiento". Sin esto truena al montar, no en la aserción.
  vi.stubGlobal(
    "matchMedia",
    () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Abre la hoja y toca el mosaico que se pida. */
async function tocar(etiqueta: RegExp, trip: typeof VIAJE_VIVO | null) {
  const u = userEvent.setup();
  render(<MoreSheet userId="u1" trip={trip} active={false} />);
  await u.click(screen.getByRole("button", { name: /más/i }));
  await u.click(await screen.findByRole("button", { name: etiqueta }));
}

describe('el atajo "viajes"', () => {
  it("SIN viaje cerca lleva a la lista", async () => {
    await tocar(/viajes/i, null);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/viaje/lista"));
  });

  it("CON un viaje vivo lleva a la lista IGUAL, no dentro de ese viaje", async () => {
    // El caso que reportó Roberto. El mosaico dice "viajes" —plural, el nombre
    // de la sección— y meterlo dentro de uno deja el resto inalcanzable desde
    // el drawer. El acceso directo a la maleta viva ya vive en la card del
    // home, que es donde tiene sentido.
    await tocar(/viajes/i, VIAJE_VIVO);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/viaje/lista"));
    expect(push).not.toHaveBeenCalledWith(VIAJE_VIVO.href);
  });
});

describe("los otros destinos de la hoja", () => {
  it("modo tienda y tus colores no se movieron", async () => {
    await tocar(/modo tienda/i, null);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/cartera/chequear"));
    cleanup();
    push.mockReset();
    await tocar(/tus colores/i, null);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/cartera"));
  });
});
