// LOS EVENTOS DE LA VITRINA — lo que se blinda es QUÉ viaja en `data`, no el
// markup. La lectura de la prueba (7 y 24 de noviembre) cruza clave, entrada y
// tienda; un refactor que renombre un campo deja la lectura en ceros sin que
// nada truene. Todo se simula: el DATABASE_URL local es producción.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  viendoComo: false,
  registrar: vi.fn(async (_s: unknown, _e: { user_id: string; type: string; data?: Record<string, unknown> }) => ({ ok: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
  }),
}));
vi.mock("@/lib/telemetria", () => ({ registrarEvento: h.registrar }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (_n: string) => (h.viendoComo ? { value: "x" } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({ VIEW_AS_COOKIE: "view_as" }));

import { registrarTiendaClick, registrarVitrinaVista } from "./vitrina-actions";

beforeEach(() => {
  h.user = { id: "u1" };
  h.viendoComo = false;
  h.registrar.mockClear();
});

describe("vitrina_vista", () => {
  it("viaja con clave, entradas, tienda y desde, para la cuenta con sesión", async () => {
    await registrarVitrinaVista("mujer|sueter|vino", ["jp:E1-000:14", "jp:E2-000:14"], "Uniqlo Japón", "maleta");
    expect(h.registrar).toHaveBeenCalledTimes(1);
    const [, evento] = h.registrar.mock.calls[0];
    expect(evento).toMatchObject({
      user_id: "u1",
      type: "vitrina_vista",
      data: { clave: "mujer|sueter|vino", entradas: ["jp:E1-000:14", "jp:E2-000:14"], tienda: "Uniqlo Japón", desde: "maleta" },
    });
  });

  it("sin sesión, sin entradas, o con el admin mirando a otra persona, no escribe nada", async () => {
    await registrarVitrinaVista("mujer|sueter|vino", [], "Uniqlo Japón", "maleta");
    h.viendoComo = true;
    await registrarVitrinaVista("mujer|sueter|vino", ["jp:E1-000:14"], "Uniqlo Japón", "maleta");
    h.viendoComo = false;
    h.user = null;
    await registrarVitrinaVista("mujer|sueter|vino", ["jp:E1-000:14"], "Uniqlo Japón", "maleta");
    expect(h.registrar).not.toHaveBeenCalled();
  });
});

describe("tienda_click", () => {
  it("viaja con la entrada exacta que se tocó (hay hasta dos por hueco)", async () => {
    await registrarTiendaClick("hombre|jean|negro", "us:E455476-000:09", "Uniqlo EE. UU.", "maleta");
    const [, evento] = h.registrar.mock.calls.at(-1)!;
    expect(evento).toMatchObject({
      type: "tienda_click",
      data: { clave: "hombre|jean|negro", entrada: "us:E455476-000:09", tienda: "Uniqlo EE. UU.", desde: "maleta" },
    });
  });

  it("sin clave o sin entrada no escribe", async () => {
    await registrarTiendaClick("", "us:E1:09", "Uniqlo EE. UU.", "maleta");
    await registrarTiendaClick("hombre|jean|negro", "", "Uniqlo EE. UU.", "maleta");
    expect(h.registrar).not.toHaveBeenCalled();
  });
});
