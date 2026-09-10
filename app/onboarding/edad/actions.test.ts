// CUÁNDO EL SERVIDOR PIDE MEDIR "REGISTRO" (saveAge).
//
// La promesa del aviso de privacidad: a quien declara 13-17 años no se le avisa
// NINGÚN momento a una plataforma de anuncios. El registro se mide aquí, al
// guardar la edad, justo para poder cumplirla — y sólo la primera vez, para no
// contar dos registros si alguien vuelve a mandar el formulario.
//
// Todo lo que sale del proceso se simula (Supabase, Postgres, Postmark): el
// DATABASE_URL local es producción y este test no puede tocarlo.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_CONVERSION, COOKIE_MENOR } from "@/lib/publicidad";
import type { ResultadoEdad } from "@/lib/edad-guardar";

const h = vi.hoisted(() => ({
  setCookie: vi.fn((_nombre: string, _valor: string, _opciones: Record<string, unknown>) => {}),
  resultado: null as ResultadoEdad | null,
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: h.setCookie }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { onboarding_step: 1 } }) }) }),
    }),
  }),
}));
vi.mock("@/lib/db", () => ({ withDb: async (fn: (c: unknown) => unknown) => fn({}) }));
vi.mock("@/lib/edad-guardar", () => ({ guardarEdad: async () => h.resultado }));
vi.mock("@/lib/consentimiento", () => ({ sendParentConsentEmail: async () => ({ ok: true }) }));
vi.mock("@/lib/telemetria", () => ({ registrarEvento: async () => ({ ok: true }) }));

import { saveAge } from "./actions";

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.setCookie.mockClear();
  h.resultado = null;
});

describe("saveAge — la cookie de conversión", () => {
  it("una adulta que guarda su edad por primera vez: el servidor pide medir el registro", async () => {
    h.resultado = { onboarding_step: 0, token: null };
    await expect(saveAge(form({ age_range: "25-34" }))).rejects.toThrow(/REDIRECT/);

    expect(h.setCookie).toHaveBeenCalledTimes(1);
    const [nombre, valor, opciones] = h.setCookie.mock.calls[0];
    expect(nombre).toBe(COOKIE_CONVERSION);
    expect(valor).toBe("registro");
    // La lee el JavaScript de la pantalla siguiente: no puede ser httpOnly.
    expect(opciones).toMatchObject({ path: "/", httpOnly: false, sameSite: "lax" });
  });

  it("13-17: nunca se le avisa a una plataforma de anuncios, y ese navegador deja de cargar etiquetas", async () => {
    h.resultado = { onboarding_step: 0, token: "tok" };
    await expect(
      saveAge(form({ age_range: "13-17", minor_ack: "1", parent_email: "mama@correo.com" }))
    ).rejects.toThrow(/REDIRECT/);

    expect(h.setCookie.mock.calls.map((c) => c[0])).not.toContain(COOKIE_CONVERSION);
    expect(h.setCookie).toHaveBeenCalledTimes(1);
    const [nombre, valor, opciones] = h.setCookie.mock.calls[0];
    expect(nombre).toBe(COOKIE_MENOR);
    expect(valor).toBe("1");
    // La lee lib/publicidad en el navegador antes de cargar nada.
    expect(opciones).toMatchObject({ path: "/", httpOnly: false });
  });

  it("volver a mandar la edad (ya estaba puesta) no cuenta un segundo registro", async () => {
    h.resultado = null;
    await expect(saveAge(form({ age_range: "25-34" }))).rejects.toThrow(/REDIRECT/);

    expect(h.setCookie).not.toHaveBeenCalled();
  });
});
