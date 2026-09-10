// DE LA COOKIE AL PERFIL (guardarOrigenEnPerfil).
//
// Las tres decisiones que blinda: no pisar un origen ya guardado (ni en la
// consulta), no inventar uno sin cookie válida, y que un error de la base no
// truene el onboarding. Supabase se simula: ningún test toca la base.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardarOrigenEnPerfil } from "./origen-perfil";
import { serializarOrigen, type Origen } from "./origen";

function supabaseFalso(resultado: { error: { message: string } | null } | Error) {
  const builder = {
    update: vi.fn((_valores: Record<string, unknown>) => builder),
    eq: vi.fn((_columna: string, _valor: string) => builder),
    is: vi.fn(async (_columna: string, _valor: null) => {
      if (resultado instanceof Error) throw resultado;
      return resultado;
    }),
  };
  const from = vi.fn((_tabla: string) => builder);
  return { cliente: { from } as unknown as SupabaseClient, builder, from };
}

const ANUNCIO: Origen = { landing: "/", at: "2026-09-14T15:00:00.000Z", utm_source: "google", gclid: "Cj0" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("guardarOrigenEnPerfil", () => {
  it("con cookie válida y perfil sin origen: lo guarda, y la consulta nunca pisa uno existente", async () => {
    const s = supabaseFalso({ error: null });
    const r = await guardarOrigenEnPerfil(s.cliente, "u1", null, serializarOrigen(ANUNCIO));

    expect(r).toBe("guardado");
    expect(s.from).toHaveBeenCalledWith("profiles");
    expect(s.builder.update.mock.calls[0][0]).toEqual({ origen: ANUNCIO });
    expect(s.builder.eq).toHaveBeenCalledWith("id", "u1");
    expect(s.builder.is).toHaveBeenCalledWith("origen", null);
  });

  it("si el perfil ya tenía origen, ni siquiera consulta", async () => {
    const s = supabaseFalso({ error: null });
    expect(await guardarOrigenEnPerfil(s.cliente, "u1", { utm_source: "tiktok" }, serializarOrigen(ANUNCIO))).toBe("ya-tenia");
    expect(s.from).not.toHaveBeenCalled();
  });

  it("sin cookie, o con una cookie basura, no inventa nada", async () => {
    const s = supabaseFalso({ error: null });
    expect(await guardarOrigenEnPerfil(s.cliente, "u1", null, undefined)).toBe("sin-cookie");
    expect(await guardarOrigenEnPerfil(s.cliente, "u1", null, "{basura")).toBe("sin-cookie");
    expect(s.from).not.toHaveBeenCalled();
  });

  it("un error o una excepción de la base no truenan: se registra y el onboarding sigue", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const conError = supabaseFalso({ error: { message: "violates check constraint" } });
    expect(await guardarOrigenEnPerfil(conError.cliente, "u1", null, serializarOrigen(ANUNCIO))).toBe("error");

    const conExcepcion = supabaseFalso(new Error("red caída"));
    expect(await guardarOrigenEnPerfil(conExcepcion.cliente, "u1", null, serializarOrigen(ANUNCIO))).toBe("error");
    expect(log).toHaveBeenCalledTimes(2);
  });
});
