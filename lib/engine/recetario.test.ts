import { describe, expect, it } from "vitest";
import { LOOK_IDS } from "@/lib/looks";
// El espejo real: la fuente que usan los scripts de cosecha/clasificación.
// vitest sí puede importar el .mjs; el bundle de producción no debe (arrastraría
// scripts/), y por eso el mapa vive duplicado en recetario.ts con ESTE test de
// guardia.
import { FAMILIAS } from "../../scripts/familias.mjs";
import {
  RECETAS_HOMBRE,
  recetasParaTags,
  recetasParaPrompt,
  bandaDeClima,
} from "./recetario";

const porFamilia = new Map(RECETAS_HOMBRE.map((r) => [r.familia, r]));

describe("recetario v2 — el puente cartas → familias", () => {
  // El acople silencioso: si el mapa de recetario.ts diverge del de
  // scripts/familias.mjs (alguien mueve una carta de familia en uno solo), el
  // motor empieza a inyectar la receta equivocada y NADA falla — los outfits
  // solo dejan de corresponder al gusto medido, que es invisible mirando la app.
  it("el mapa carta→familia es idéntico al de scripts/familias.mjs", () => {
    expect(RECETAS_HOMBRE.map((r) => r.familia).sort()).toEqual(
      Object.keys(FAMILIAS).sort()
    );
    for (const r of RECETAS_HOMBRE) {
      expect(r.cartas.slice().sort(), r.familia).toEqual(
        FAMILIAS[r.familia as keyof typeof FAMILIAS].cartas.slice().sort()
      );
    }
  });

  // Segundo acople: las cartas viven en lib/looks.ts. Renombrar una allá sin
  // tocar acá dejaría a la carta sin familia (su ❤️ dejaría de sumar) igual de
  // silenciosamente.
  it("cada carta de cada familia existe en el deck", () => {
    for (const r of RECETAS_HOMBRE) {
      for (const carta of r.cartas) {
        expect(LOOK_IDS.has(carta), `carta fantasma "${carta}" en ${r.familia}`).toBe(true);
      }
    }
  });

  it("elige la familia por la fuerza del tag, no por el orden del array", () => {
    // "minimalista" es tag de las cartas minimalista Y clasico-elegante; con
    // el desempate por orden de array, quien pone "minimalista" de primer gusto
    // podía llevarse clásico-arreglado. La carta minimalista (casual-limpio)
    // empata sus 3 tags; clasico-elegante solo 1.
    const r = recetasParaTags(["minimalista", "sobrio", "pulido"], "hombre");
    expect(r[0].familia).toBe("casual-limpio");
  });

  it("la familia hereda el MEJOR score de sus cartas, no la suma", () => {
    // "utility" dispara la única carta de utilitario. casual-limpio tiene 4
    // cartas: si las familias sumaran, la ancha le ganaría al fan del utility
    // solo por tener más cartas.
    const r = recetasParaTags(["utility", "urbano", "relajado"], "hombre");
    expect(r[0].familia).toBe("utilitario");
  });

  it("respeta el tope — recetas de más se contradicen entre sí", () => {
    const tags = ["pulido", "clasico", "elegante", "minimalista", "versatil"];
    expect(recetasParaTags(tags, "hombre")).toHaveLength(2);
    expect(recetasParaTags(tags, "hombre", 1)).toHaveLength(1);
  });

  it("sin tags que empaten no devuelve nada", () => {
    // "coquette", "suave" y "ceñido" solo viven en cartas women-only sin
    // familia masculina. ("romantico", que usaba la versión anterior de este
    // test, ya NO sirve de ejemplo: es tag de la carta boho, que en la
    // taxonomía v2 sí apunta a resort-boho.)
    expect(recetasParaTags(["coquette", "suave", "ceñido"], "hombre")).toEqual([]);
    expect(recetasParaPrompt([])).toBe("");
  });

  it("mujer todavía no tiene recetas destiladas", () => {
    // Explícito para que no se lea como bug: el pipeline de mujer (cosecha →
    // curaduría → destilación) está pendiente. Cuando exista, este test cambia.
    expect(recetasParaTags(["minimalista", "pulido"], "mujer")).toEqual([]);
  });
});

describe("recetario v2 — clima", () => {
  const sastre = porFamilia.get("sastre")!;
  const clima = (t: number) => ({ temp_c: t, condition: "despejado" });

  it("las bandas cortan donde cambia la ropa, no el termómetro", () => {
    expect(bandaDeClima(null)).toBe("templado");
    expect(bandaDeClima(clima(8))).toBe("frio");
    expect(bandaDeClima(clima(15))).toBe("frio");
    expect(bandaDeClima(clima(16))).toBe("templado");
    expect(bandaDeClima(clima(25))).toBe("templado");
    expect(bandaDeClima(clima(26))).toBe("calor");
  });

  it("en frío van SOLO fórmulas de frío + cómo abriga", () => {
    const texto = recetasParaPrompt([sastre], clima(8));
    for (const f of sastre.formulas) {
      expect(texto.includes(f.look), `${f.clima}: ${f.look}`).toBe(f.clima === "frio");
    }
    expect(texto).toContain("Cómo abriga este estilo");
  });

  it("en calor no va la sección de abrigo ni fórmulas de frío", () => {
    const texto = recetasParaPrompt([sastre], clima(30));
    expect(texto).not.toContain("Cómo abriga");
    for (const f of sastre.formulas.filter((x) => x.clima === "frio")) {
      expect(texto).not.toContain(f.look);
    }
  });

  it("banda sin material cae a templado, avisando", () => {
    // utilitario no tiene fórmulas de calor (sus fotos no las sostienen) y
    // resort-boho no tiene de frío. Inventarle fórmulas sería mentir; callarse
    // dejaría al modelo con cero fórmulas, que es volver a improvisar.
    const util = porFamilia.get("utilitario")!;
    const texto = recetasParaPrompt([util], clima(30));
    expect(texto).toContain("adáptalas al clima de hoy");
    expect(texto).toContain(util.formulas.find((f) => f.clima === "templado")!.look);

    const boho = porFamilia.get("resort-boho")!;
    const frio = recetasParaPrompt([boho], clima(8));
    expect(frio).toContain("adáptalas al clima de hoy");
    // Su sección de frío existe y es honesta ("no hay fotos de frío…"): va tal
    // cual — decirle al modelo que este estilo NO abriga con lana es información.
    expect(frio).toContain("Cómo abriga este estilo");
  });

  it("sin clima se asume templado", () => {
    const texto = recetasParaPrompt([sastre], null);
    const templadas = sastre.formulas.filter((f) => f.clima === "templado");
    for (const f of templadas) expect(texto).toContain(f.look);
    expect(texto).not.toContain("Cómo abriga");
  });
});

describe("recetario v2 — material", () => {
  it("el bloque del prompt trae fórmulas, paleta y vetos, no solo adjetivos", () => {
    const texto = recetasParaPrompt(recetasParaTags(["minimalista"], "hombre"));
    expect(texto).toContain("Fórmulas que funcionan");
    expect(texto).toContain("Paleta del estilo");
    expect(texto).toContain("Lo que lo arruina");
    // La prueba de que no volvimos a los adjetivos: hay prendas concretas.
    expect(texto).toMatch(/playera|pantalón|tenis|camisa/);
  });

  it("cada familia trae material suficiente para servir de algo", () => {
    for (const r of RECETAS_HOMBRE) {
      expect(r.formulas.length, `${r.familia} sin fórmulas`).toBeGreaterThanOrEqual(8);
      expect(r.capsula.length, `${r.familia} con cápsula pobre`).toBeGreaterThanOrEqual(10);
      expect(r.evitar.length, `${r.familia} sin vetos`).toBeGreaterThanOrEqual(3);
      expect(r.detalles.length, `${r.familia} sin detalles`).toBeGreaterThanOrEqual(5);
      expect(r.paleta.length, `${r.familia} sin paleta`).toBeGreaterThan(40);
      // Templado es la banda de fallback: si una familia se queda sin fórmulas
      // templadas, el fallback devolvería lista vacía en silencio.
      expect(
        r.formulas.some((f) => f.clima === "templado"),
        `${r.familia} sin fórmulas templadas (el fallback quedaría vacío)`
      ).toBe(true);
    }
  });

  it("las cápsulas no traen la ambigüedad de la 'y' que cosió el suéter bicolor", () => {
    // "Suéter de ochos azul marino y crema" se lee igual de bien como UN suéter
    // mitad y mitad — y así lo generó la reconstrucción. La regla: alternativas
    // con "o", prendas distintas en renglones separados. Este test caza el
    // patrón "<color> y <color>" al final del renglón, que fue la forma exacta
    // del bug.
    const parFinal = /\b(negro|negra|blanco|blanca|crema|beige|caqui|camel|gris|café|marino|celeste|oliva|vino|verde|azul)\s+y\s+(negro|negra|blanco|blanca|crema|beige|caqui|camel|gris|café|marino|celeste|oliva|vino|verde|azul)(\s+\w+)?$/i;
    for (const r of RECETAS_HOMBRE) {
      for (const linea of r.capsula) {
        expect(parFinal.test(linea), `${r.familia}: "${linea}"`).toBe(false);
      }
    }
  });
});

describe("el peso distintivo de cada tag (v34)", () => {
  it("no te da una familia por tener sus etiquetas genéricas", () => {
    // El caso de Roberto: sus tags son pulido, clasico, minimalista, sobrio…
    // La carta "preppy" lleva [preppy, clasico, pulido]; con todos los tags
    // pesando igual, esos dos genéricos le daban 1.50 y la familia PREPPY le
    // ganaba a Clásico arreglado, que tenía tres cartas suyas puntuando. Él lo
    // cachó de memoria: "según yo era clásico elegante".
    const suyos = ["pulido", "clasico", "minimalista", "sobrio", "casual", "versatil", "moderno", "natural"];
    const familias = recetasParaTags(suyos, "hombre", 3).map((r) => r.familia);
    expect(familias).toContain("casual-limpio");
    expect(familias.indexOf("clasico-arreglado")).toBeLessThan(familias.indexOf("preppy"));
  });

  it("a quien SÍ es preppy le sigue tocando preppy, y de calle", () => {
    // La otra mitad de la prueba: el arreglo no puede romper el caso legítimo.
    const preppy = ["preppy", "clasico", "nautico", "pulido", "fresco", "academia"];
    expect(recetasParaTags(preppy, "hombre")[0].familia).toBe("preppy");
  });

  it("y al gorpcore le toca deportivo", () => {
    const gorp = ["gorpcore", "utility", "deportivo", "tecnico", "casual"];
    expect(recetasParaTags(gorp, "hombre")[0].familia).toBe("deportivo");
  });
});
