// LA MARCA DE MENOR AL SALIR DE LA APP (marcarNavegadorSiEsMenor).
//
// Lo que blinda: una cuenta de 13-17 que cierra sesión o borra su cuenta sale
// con la marca puesta (y "/" ya no le carga etiquetas); una adulta no; y un
// fallo de la base no impide salir. Supabase y next/headers se simulan.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COOKIE_MENOR } from "@/lib/publicidad";

const h = vi.hoisted(() => ({
  setCookie: vi.fn((_nombre: string, _valor: string, _opciones: Record<string, unknown>) => {}),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: h.setCookie }) }));

import { marcarNavegadorSiEsMenor } from "./marca-menor-servidor";

function supabaseCon(ageRange: string | null, opciones: { usuario?: string | null; error?: Error } = {}) {
  const usuario = opciones.usuario === undefined ? "u1" : opciones.usuario;
  return {
    auth: { getUser: async () => ({ data: { user: usuario ? { id: usuario } : null } }) },
    from: (_tabla: string) => ({
      select: (_columnas: string) => ({
        eq: (_col: string, _valor: string) => ({
          maybeSingle: async () => {
            if (opciones.error) throw opciones.error;
            return { data: ageRange === null ? null : { age_range: ageRange } };
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  h.setCookie.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("marcarNavegadorSiEsMenor", () => {
  it("13-17: pone la cookie que lib/publicidad lee, legible por el navegador", async () => {
    expect(await marcarNavegadorSiEsMenor(supabaseCon("13-17"), "u1")).toBe(true);
    const [nombre, valor, opciones] = h.setCookie.mock.calls[0];
    expect(nombre).toBe(COOKIE_MENOR);
    expect(valor).toBe("1");
    expect(opciones).toMatchObject({ path: "/", httpOnly: false });
  });

  it("adulta, sin perfil o sin sesión: no marca", async () => {
    expect(await marcarNavegadorSiEsMenor(supabaseCon("25-34"), "u1")).toBe(false);
    expect(await marcarNavegadorSiEsMenor(supabaseCon(null), "u1")).toBe(false);
    expect(await marcarNavegadorSiEsMenor(supabaseCon("13-17", { usuario: null }))).toBe(false);
    expect(h.setCookie).not.toHaveBeenCalled();
  });

  it("sin id, lo saca de la sesión", async () => {
    expect(await marcarNavegadorSiEsMenor(supabaseCon("13-17"))).toBe(true);
  });

  it("un fallo de la base no impide salir", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await marcarNavegadorSiEsMenor(supabaseCon("13-17", { error: new Error("red") }), "u1")).toBe(false);
  });
});
