import { describe, expect, it, vi } from "vitest";
import { cuentaMeta, filasDeInsights, traerGastoMeta, urlInsights } from "@/lib/admin/gasto-meta";
import { avisoGastoMeta } from "@/lib/admin/gasto-guardar";

// LO QUE SE BLINDA: que cada anuncio de Meta caiga en la llave de su
// utm_campaign con los clics que sí abren el enlace, que la basura no entre, y
// que el token nunca salga ni en la URL ni en un mensaje de error.

vi.mock("@/lib/db", () => ({ withDb: vi.fn() }));

const fila = (o: Record<string, unknown>) => ({
  date_start: "2026-10-05",
  ad_name: "ig-etiqueta",
  impressions: "1000",
  inline_link_clicks: "12",
  spend: "54.317",
  ...o,
});

describe("gasto de Meta", () => {
  it("convierte los insights (que vienen como texto) a filas del panel", () => {
    const { filas, descartadas } = filasDeInsights([
      fila({}),
      fila({ ad_name: "ig-jeans", impressions: "300", inline_link_clicks: undefined, spend: "0" }),
    ]);
    expect(descartadas).toBe(0);
    expect(filas).toEqual([
      { dia: "2026-10-05", campana: "ig-etiqueta", impresiones: 1000, clics: 12, costo_mxn: 54.32 },
      { dia: "2026-10-05", campana: "ig-jeans", impresiones: 300, clics: 0, costo_mxn: 0 },
    ]);
  });

  it("suma dos anuncios con el mismo nombre el mismo día (una copia sin renombrar)", () => {
    const { filas } = filasDeInsights([fila({}), fila({ impressions: "10", inline_link_clicks: "1", spend: "1" })]);
    expect(filas).toEqual([{ dia: "2026-10-05", campana: "ig-etiqueta", impresiones: 1010, clics: 13, costo_mxn: 55.32 }]);
  });

  it("descarta y cuenta lo que no parece utm_campaign o no trae números", () => {
    const { filas, descartadas } = filasDeInsights([
      fila({}),
      fila({ ad_name: "ig-salgo-igual - Copia" }),
      fila({ ad_name: "ig-maleta", spend: "n/a" }),
      null,
    ]);
    expect(filas.map((f) => f.campana)).toEqual(["ig-etiqueta"]);
    expect(descartadas).toBe(2);
    expect(filasDeInsights(undefined)).toEqual({ filas: [], descartadas: 0 });
  });

  it("la cuenta acepta el prefijo act_ y nada más que dígitos", () => {
    expect(cuentaMeta("act_123456789")).toBe("123456789");
    expect(cuentaMeta(" 123456789 ")).toBe("123456789");
    expect(cuentaMeta("123/../me")).toBeNull();
    expect(cuentaMeta(undefined)).toBeNull();
  });

  it("pide por anuncio y por día, los 7 días completos, sin el token en la URL", () => {
    const u = new URL(urlInsights("123456789"));
    expect(u.pathname).toMatch(/\/act_123456789\/insights$/);
    expect(u.searchParams.get("level")).toBe("ad");
    expect(u.searchParams.get("time_increment")).toBe("1");
    expect(u.searchParams.get("date_preset")).toBe("last_7d");
    expect(u.searchParams.get("fields")).toContain("inline_link_clicks");
    expect(u.searchParams.has("access_token")).toBe(false);
  });

  it("sigue la paginación de la Graph API y no sigue enlaces a otro lado", async () => {
    const llamadas: string[] = [];
    const respuestas = [
      { data: [fila({})], paging: { next: "https://graph.facebook.com/v25.0/act_1/insights?after=x" } },
      { data: [fila({ ad_name: "ig-jeans" })], paging: { next: "https://evil.example/robar" } },
    ];
    const fetcher = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      llamadas.push(url);
      expect(init.headers.Authorization).toBe("Bearer TOKEN-SECRETO");
      return { ok: true, status: 200, json: async () => respuestas.shift() };
    });
    const { filas } = await traerGastoMeta("TOKEN-SECRETO", "123456789", fetcher);
    expect(filas.map((f) => f.campana)).toEqual(["ig-etiqueta", "ig-jeans"]);
    expect(llamadas).toHaveLength(2);
    expect(llamadas.join(" ")).not.toContain("TOKEN-SECRETO");
  });

  it("un error de Meta se explica sin filtrar el token", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid OAuth access token TOKEN-SECRETO", code: 190 } }),
    }));
    const err = await traerGastoMeta("TOKEN-SECRETO", "123456789", fetcher).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("código 190");
    expect((err as Error).message).not.toContain("TOKEN-SECRETO");
  });

  it("el correo avisa de la falla y de lo descartado, y calla cuando todo está bien", () => {
    expect(avisoGastoMeta({ estado: "error", mensaje: "Meta respondió 400" })).toContain("No se pudo traer el gasto de Meta");
    expect(avisoGastoMeta({ estado: "ok", guardadas: 4, descartadas: 1 })).toContain("1 fila");
    expect(avisoGastoMeta({ estado: "ok", guardadas: 4, descartadas: 0 })).toBeNull();
    expect(avisoGastoMeta({ estado: "sin-configurar" })).toBeNull();
  });
});
