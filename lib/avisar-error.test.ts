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
