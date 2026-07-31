import { describe, expect, it } from "vitest";
import { LOOKS } from "@/lib/looks";
import {
  RECETAS_HOMBRE,
  recetasParaTags,
  recetasParaPrompt,
} from "./recetario";

describe("recetario", () => {
  // El acople silencioso: una receta se dispara por sus tags, y los tags viven
  // en lib/looks.ts. Si alguien renombra un tag de un look ("pulido" → "nitido")
  // la receta deja de aparecer y NADA falla — los outfits solo vuelven a ser
  // genéricos, que es exactamente el bug que el recetario vino a arreglar y el
  // más difícil de notar mirando la app.
  it("los tags de cada receta existen en el look del mismo id", () => {
    for (const receta of RECETAS_HOMBRE) {
      const look = LOOKS.find((l) => l.id === receta.id);
      expect(look, `no hay look con id "${receta.id}"`).toBeDefined();
      expect(receta.tags.slice().sort()).toEqual(look!.tags.slice().sort());
    }
  });

  it("elige las recetas por la fuerza del tag, no por el orden del array", () => {
    // Caso que rompió la primera versión: "clasico-elegante" TAMBIÉN lleva el
    // tag "minimalista", así que empataba en la posición 0 y ganaba solo por
    // estar antes en RECETAS_HOMBRE. Quien pone "minimalista" de primer gusto
    // se llevaba la receta de clásico elegante — con su mocasín y su saco.
    const r = recetasParaTags(["minimalista", "pulido", "versatil"], "hombre");
    expect(r[0].id).toBe("minimalista");
  });

  it("respeta el tope — recetas de más se contradicen entre sí", () => {
    // Estos tags disparan las tres recetas; sin tope, el prompt le pediría al
    // modelo mocasín (clásico) y le prohibiría el mocasín (minimalista) a la vez.
    const tags = ["pulido", "clasico", "elegante", "minimalista", "versatil"];
    expect(recetasParaTags(tags, "hombre")).toHaveLength(2);
    expect(recetasParaTags(tags, "hombre", 1)).toHaveLength(1);
  });

  it("sin tags que empaten no devuelve nada", () => {
    expect(recetasParaTags(["coquette", "romantico"], "hombre")).toEqual([]);
    expect(recetasParaPrompt([])).toBe("");
  });

  it("mujer todavía no tiene recetas destiladas", () => {
    // Explícito para que no se lea como bug: la destilación de mujer está
    // pendiente. Cuando se agregue, este test cambia junto con RECETAS_MUJER.
    expect(recetasParaTags(["minimalista", "pulido"], "mujer")).toEqual([]);
  });

  it("el bloque del prompt trae fórmulas y vetos, no solo adjetivos", () => {
    const texto = recetasParaPrompt(recetasParaTags(["minimalista"], "hombre"));
    expect(texto).toContain("Fórmulas que funcionan");
    expect(texto).toContain("Lo que lo arruina");
    // La prueba de que no volvimos a los adjetivos: hay prendas concretas.
    expect(texto).toMatch(/playera|pantalón|tenis/);
  });

  it("cada receta trae material suficiente para servir de algo", () => {
    for (const r of RECETAS_HOMBRE) {
      expect(r.formulas.length, `${r.id} sin fórmulas`).toBeGreaterThanOrEqual(5);
      expect(r.capsula.length, `${r.id} con cápsula pobre`).toBeGreaterThanOrEqual(10);
      expect(r.evitar.length, `${r.id} sin vetos`).toBeGreaterThanOrEqual(3);
    }
  });
});
