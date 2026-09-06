import { describe, it, expect, vi, afterEach } from "vitest";
import { registrarEvento } from "./telemetria";

function fake(error: { message: string } | null) {
  const insert = vi.fn(async (_filas: unknown[]) => ({ error }));
  const supabase = { from: () => ({ insert }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: supabase as any, insert };
}

afterEach(() => {
  delete process.env.TELEMETRIA_ESTRICTA;
  vi.restoreAllMocks();
});

describe("registrarEvento", () => {
  it("normaliza la fila: data vacío y outfit_id null si no vienen", async () => {
    const { supabase, insert } = fake(null);
    const r = await registrarEvento(supabase, { user_id: "u1", type: "vote_up" });
    expect(r.ok).toBe(true);
    expect(insert.mock.calls.at(-1)![0]).toEqual([
      { user_id: "u1", type: "vote_up", data: {}, outfit_id: null },
    ]);
  });

  it("acepta una lista y la manda en un solo insert", async () => {
    const { supabase, insert } = fake(null);
    await registrarEvento(supabase, [
      { user_id: "u1", type: "a" },
      { user_id: "u1", type: "b", data: { x: 1 } },
    ]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect((insert.mock.calls[0][0] as unknown[]).length).toBe(2);
  });

  it("una lista vacía no toca la base", async () => {
    const { supabase, insert } = fake(null);
    expect(await registrarEvento(supabase, [])).toEqual({ ok: true });
    expect(insert).not.toHaveBeenCalled();
  });

  it("si la base lo rechaza, LO DICE y no lanza (producción)", async () => {
    const { supabase } = fake({ message: 'violates check constraint "events_type_check"' });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await registrarEvento(supabase, { user_id: "u1", type: "tipo_nuevo" });
    expect(r.ok).toBe(false);
    expect(err).toHaveBeenCalledOnce();
    expect(String(err.mock.calls[0][0])).toContain("tipo_nuevo");
  });

  it("con TELEMETRIA_ESTRICTA=1 el rechazo truena: así un tipo que falta en el CHECK se ve en la primera prueba", async () => {
    process.env.TELEMETRIA_ESTRICTA = "1";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = fake({ message: "check" });
    await expect(
      registrarEvento(supabase, { user_id: "u1", type: "tipo_nuevo" })
    ).rejects.toThrow(/tipo_nuevo/);
  });

  it("una excepción de red tampoco lanza en producción", async () => {
    const supabase = {
      from: () => ({
        insert: async () => {
          throw new Error("fetch failed");
        },
      }),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await registrarEvento(supabase as any, { user_id: "u1", type: "x" });
    expect(r).toEqual({ ok: false, error: "fetch failed" });
  });
});
