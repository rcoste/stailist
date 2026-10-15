import { describe, it, expect } from "vitest";
import { agrupar, estadoEfectivo, porRevisar, type Ocurrencia } from "./errores";
import { claseDe, rutaSinIds, tituloDe } from "@/lib/errores-clave";

// LO QUE BLINDAN: que un error marcado "arreglado" que vuelve a pasar no se
// quede escondido como arreglado, y que el globo rojo del menú cuente sólo lo
// que vio una persona (no frenos ni ruido técnico).

const o = (clave: string, at: string, userId = "u1"): Ocurrencia => ({
  at, userId, clave, pantalla: null, mensaje: null, tecnico: null, fuente: "errores",
});

describe("estadoEfectivo", () => {
  it("sin fila es sin revisar", () => expect(estadoEfectivo(undefined, "2026-10-14T10:00:00Z")).toBe("sin_revisar"));
  it("arreglado y no volvió a pasar: arreglado", () =>
    expect(estadoEfectivo({ clave: "x", estado: "arreglado", nota: null, actualizado: "2026-10-14T12:00:00Z" }, "2026-10-14T10:00:00Z")).toBe("arreglado"));
  it("arreglado y pasó después: volvió", () =>
    expect(estadoEfectivo({ clave: "x", estado: "arreglado", nota: null, actualizado: "2026-10-14T12:00:00Z" }, "2026-10-14T13:00:00+00:00")).toBe("volvio"));
});

describe("agrupar", () => {
  it("junta por clave, cuenta personas distintas y ordena lo que pide atención arriba", () => {
    const g = agrupar(
      [
        o("viaje:cortado", "2026-10-14T15:19:00Z"),
        o("generation_failed:TOO_FEW_OUTFITS", "2026-10-12T15:34:00Z", "a"),
        o("generation_failed:TOO_FEW_OUTFITS", "2026-10-12T15:35:00Z", "a"),
        o("generation_failed:TOO_FEW_OUTFITS", "2026-10-12T16:02:00Z", "b"),
      ],
      [{ clave: "viaje:cortado", estado: "arreglado", nota: "maxDuration 300", actualizado: "2026-10-14T20:00:00Z" }]
    );
    expect(g.map((x) => x.clave)).toEqual(["generation_failed:TOO_FEW_OUTFITS", "viaje:cortado"]);
    expect(g[0]).toMatchObject({ veces: 3, personas: 2, estado: "sin_revisar", ultima: "2026-10-12T16:02:00Z" });
    expect(g[1].estado).toBe("arreglado");
  });

  it("el globo del menú no cuenta frenos ni técnicos", () => {
    const g = agrupar([o("freno:looks", "2026-10-14T10:00:00Z"), o("ia:motor", "2026-10-14T10:00:00Z"), o("pantalla-de-error", "2026-10-14T10:00:00Z")], []);
    expect(porRevisar(g)).toBe(1);
  });
});

describe("claves", () => {
  it("los ids no parten un error en mil", () => {
    expect(rutaSinIds("/api/trip/21bbce2f-1111-4222-8333-444455556666/outfits?x=1")).toBe("/api/trip/[id]/outfits");
  });
  it("títulos en palabras de la persona", () => {
    expect(tituloDe("http:/api/trip:504")).toBe("Crear un viaje se cortó por tiempo");
    expect(tituloDe("generation_failed:TOO_FEW_OUTFITS")).toBe("Su look no salió: muy pocas prendas");
    expect(tituloDe("freno:renders")).toBe("Llegó a su cuota de dibujos de prendas");
    expect(tituloDe("viaje:cortado")).toBe("Crear un viaje se cortó a medias");
  });
  it("clases", () => {
    expect(claseDe("freno:gasto")).toBe("freno");
    expect(claseDe("red:/api/generate")).toBe("tecnico");
    expect(claseDe("http:/api/generate:500")).toBe("error");
  });
});
