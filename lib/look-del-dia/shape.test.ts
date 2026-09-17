import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shape } from "@/lib/look-del-dia/nucleo";

// EL RENDER DEL LOOK 2 (2026-09-16). `shape` es por donde llegan los alternos
// del trío ("te armé 2 looks") y sólo devolvía prendas y textos: el render y el
// corazón de esos looks se perdían en cada apertura, y Roberto tenía que picar
// "verme con este look" una y otra vez. Si alguien vuelve a adelgazar `shape`,
// esto truena.

function supabaseFalso() {
  const firmados: string[][] = [];
  const cliente = {
    from: () => ({
      select: () => ({ in: async () => ({ data: [] }) }),
    }),
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => {
          firmados.push(paths);
          return { data: paths.map((p) => ({ path: p, signedUrl: `https://firmada/${p}` })) };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { cliente, firmados };
}

const base = { id: "look-2", item_ids: [], title: "x", explanation: "y" };

describe("shape — el look llega con su render y su corazón", () => {
  it("firma el render guardado y lo devuelve", async () => {
    const { cliente, firmados } = supabaseFalso();
    const look = await shape(cliente, { ...base, tryon_path: "u/tryons/look-2.jpg" });
    expect(firmados.flat()).toContain("u/tryons/look-2.jpg");
    expect(look.tryon).toBe("https://firmada/u/tryons/look-2.jpg");
  });

  it("sin render, tryon null (y no firma nada de más)", async () => {
    const { cliente, firmados } = supabaseFalso();
    const look = await shape(cliente, base);
    expect(look.tryon).toBeNull();
    expect(firmados.flat()).toEqual([]);
  });

  it("el corazón sale de favorited_at", async () => {
    const { cliente } = supabaseFalso();
    expect((await shape(cliente, { ...base, favorited_at: "2026-09-16" })).favorited).toBe(true);
    expect((await shape(cliente, base)).favorited).toBe(false);
  });
});
