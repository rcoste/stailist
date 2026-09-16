// LA INSTALACIÓN SE CUENTA UNA VEZ POR PERSONA.
// `appinstalled` (Chrome) y "abrió la app desde su ícono" (todas, incluido
// iPhone) describen el mismo hecho. Si los dos escribieran, el porcentaje de
// /admin/adquisicion contaría a una persona dos veces. Todo se simula: el
// DATABASE_URL local es producción.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  existentes: [] as { id: string }[],
  registrar: vi.fn(async (_s: unknown, _e: { type: string; data: Record<string, unknown> }) => ({ ok: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: h.existentes }) }) }) }),
    }),
  }),
}));
vi.mock("@/lib/telemetria", () => ({ registrarEvento: h.registrar }));

import { registrarAppAbiertaInstalada, registrarPwa } from "./pwa-actions";

beforeEach(() => {
  h.existentes = [];
  h.registrar.mockClear();
});

describe("registrar la app instalada", () => {
  it("abrir la app desde su ícono la registra como instalada", async () => {
    await registrarAppAbiertaInstalada();
    expect(h.registrar).toHaveBeenCalledTimes(1);
    const [, evento] = h.registrar.mock.calls[0];
    expect(evento).toMatchObject({ type: "pwa_installed", data: { motivo: "standalone" } });
  });

  it("si ya estaba registrada (por appinstalled o por otro teléfono), no se vuelve a contar", async () => {
    h.existentes = [{ id: "e1" }];
    await registrarAppAbiertaInstalada();
    await registrarPwa("pwa_installed", "like");
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it("el aviso mostrado no se deduplica: cada vez que se muestra cuenta", async () => {
    h.existentes = [{ id: "e1" }];
    await registrarPwa("pwa_prompt_shown", "look");
    expect(h.registrar).toHaveBeenCalledTimes(1);
  });
});
