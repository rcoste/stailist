// Pide el render limpio de UNA prenda sin imagen al endpoint compartido
// (/api/render-item → renderItemImage, mismo motor que el auto-sanado del
// clóset). Devuelve la URL firmada del render, o null si fue skip/fallo.
// Usado por el render bajo demanda en Hoy (auto) y maleta (tap).
export async function requestItemRender(
  itemId: string
): Promise<{ ok: boolean; url: string | null; skipped: boolean }> {
  try {
    const res = await fetch("/api/render-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string | null;
      skipped?: boolean;
    };
    return {
      ok: res.ok && !!data?.url,
      url: data?.url ?? null,
      skipped: !!data?.skipped,
    };
  } catch {
    return { ok: false, url: null, skipped: false };
  }
}
