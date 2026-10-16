import { describe, it, expect } from "vitest";
import { llamadaVigilada } from "./avisar-error";

// LO QUE BLINDAN: que el vigía mire sólo las llamadas de la app (no las de
// Google, ni la del propio aviso, que haría un bucle) y que agrupe por ruta.
const O = "https://stailist.co";

describe("llamadaVigilada", () => {
  it("vigila las rutas de /api de la app, sin ids", () => {
    expect(llamadaVigilada("/api/trip/21bbce2f-1111-4222-8333-444455556666/outfits", undefined, O)).toEqual({
      ruta: "/api/trip/[id]/outfits",
      accion: false,
    });
  });
  it("vigila las acciones del servidor aunque no sean /api", () => {
    expect(llamadaVigilada("/viaje/abc", { headers: { "Next-Action": "x" } }, O)).toEqual({ ruta: "/viaje/abc", accion: true });
  });
  it("no vigila otros dominios, ni páginas, ni el propio aviso", () => {
    expect(llamadaVigilada("https://www.google-analytics.com/g/collect", undefined, O)).toBeNull();
    expect(llamadaVigilada("/hoy", undefined, O)).toBeNull();
    expect(llamadaVigilada("/api/errores", { method: "POST" }, O)).toBeNull();
  });
});

// Regression: ISSUE-003 — una publicación rompía el onboarding de quien tenía la pestaña abierta
// Found by /admin/errores on 2026-10-16 (pantalla-de-error en /onboarding/objetivo, v0.2.379.4)
describe("esVersionVieja", () => {
  it("reconoce la acción del servidor que ya no existe tras publicar", async () => {
    const { esVersionVieja } = await import("./avisar-error");
    expect(
      esVersionVieja('Server Action "40919069e1f5a07b19aa8836385ed29cab9c286358" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action')
    ).toBe(true);
    expect(esVersionVieja("Failed to find Server Action \"abc\". This request might be from an older or newer deployment.")).toBe(true);
    expect(esVersionVieja("Cannot read properties of undefined")).toBe(false);
    expect(esVersionVieja(undefined)).toBe(false);
  });
});

// Regression: ISSUE-004 — salir de la página mientras algo cargaba se anotaba como falla de red
// Found by /admin/errores on 2026-10-16 (red:/api/render-ideal, "Failed to fetch" al cerrar sesión)
describe("debeAvisarRed", () => {
  it("cancelar o irse de la página no es un error; una falla de verdad sí", async () => {
    const { debeAvisarRed } = await import("./avisar-error");
    expect(debeAvisarRed(new DOMException("x", "AbortError"), false)).toBe(false);
    expect(debeAvisarRed(new TypeError("Failed to fetch"), true)).toBe(false);
    expect(debeAvisarRed(new TypeError("Failed to fetch"), false)).toBe(true);
  });
});
