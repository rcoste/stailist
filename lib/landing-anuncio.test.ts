import { describe, expect, it } from "vitest";
import { anuncioDeCampana, tituloParaCampana } from "@/lib/landing-anuncio";

// LO QUE SE BLINDA: que quien toca un anuncio caiga en el título de ESE anuncio,
// que lo demás (Google, orgánico, basura en la URL) vea el de siempre, y que el
// mismo video en TikTok herede su título.

describe("el título de la landing sigue al anuncio", () => {
  it("cada anuncio de Instagram tiene su título", () => {
    expect(tituloParaCampana("ig-maleta")?.enfasis).toBe("maleta");
    expect(tituloParaCampana("ig-salgo-igual")?.antes).toContain("Sales igual");
    expect(tituloParaCampana("ig-etiqueta")?.sub).toContain("ya está en tu clóset");
    expect(tituloParaCampana("ig-jeans")?.antes).toContain("jeans");
  });

  it("el mismo video en TikTok hereda el título", () => {
    expect(anuncioDeCampana("tt-maleta")).toBe("maleta");
  });

  it("Google, orgánico o lo desconocido ven el título de siempre", () => {
    expect(tituloParaCampana("app-neutra")).toBeNull();
    expect(tituloParaCampana("hombres-diario")).toBeNull();
    expect(tituloParaCampana("ig-anuncio-nuevo")).toBeNull();
    expect(tituloParaCampana(undefined)).toBeNull();
    expect(tituloParaCampana("ig-<script>")).toBeNull();
  });

  it("ningún título promete tiempos (la promesa de minutos salió de la landing por no sostenerse)", () => {
    for (const c of ["ig-maleta", "ig-salgo-igual", "ig-etiqueta", "ig-jeans"]) {
      const t = tituloParaCampana(c)!;
      expect(`${t.antes}${t.enfasis}${t.despues ?? ""} ${t.sub}`).not.toMatch(/minuto|segundo|\d+ ?min/i);
    }
  });
});
