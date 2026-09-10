import { describe, expect, it } from "vitest";
import {
  FICHA,
  PREGUNTAS_FRECUENTES,
  datosEstructurados,
  preguntasEstructuradas,
  serializarParaScript,
  textoLlms,
} from "./ficha-publica";

describe("preguntas frecuentes", () => {
  it("son las diez aprobadas y el precio dice lo que dijo Roberto: sin tarjeta, aviso antes de cobrar", () => {
    expect(PREGUNTAS_FRECUENTES).toHaveLength(10);
    const precio = PREGUNTAS_FRECUENTES[0];
    expect(precio.pregunta).toBe("¿Cuánto cuesta?");
    expect(precio.respuesta).toMatch(/no te pedimos tarjeta/);
    expect(precio.respuesta).toMatch(/te avisamos antes/);
  });

  it("la selfie: la colorimetría no la pide; el avatar sí, y es opcional", () => {
    const colores = PREGUNTAS_FRECUENTES.find((p) => p.pregunta.includes("colores"))!;
    const avatar = PREGUNTAS_FRECUENTES.find((p) => p.pregunta.includes("se me ve"))!;
    expect(colores.respuesta).toMatch(/no necesitas selfie/);
    expect(avatar.respuesta).toMatch(/selfie/);
    expect(avatar.respuesta).toMatch(/opcional/);
  });

  it("viajan al JSON-LD como FAQPage y a /llms.txt tal cual", () => {
    const faq = preguntasEstructuradas();
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity).toHaveLength(PREGUNTAS_FRECUENTES.length);
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(PREGUNTAS_FRECUENTES[0].respuesta);
    for (const p of PREGUNTAS_FRECUENTES) expect(textoLlms()).toContain(p.respuesta);
  });
});

// Lo que una IA va a repetir de stailist a gente que nunca la vio. Se blinda que
// diga lo que la app hace HOY, y que no se cuele lo que ya se decidió no prometer.

describe("datosEstructurados", () => {
  it("es una aplicación web gratis, en español", () => {
    const d = datosEstructurados();
    expect(d["@type"]).toBe("WebApplication");
    expect(d.url).toBe("https://stailist.co");
    expect(d.inLanguage).toBe("es");
    expect(d.isAccessibleForFree).toBe(true);
    expect(d.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "MXN" });
  });
});

describe("serializarParaScript", () => {
  it("un texto con </script> no puede cerrar la etiqueta", () => {
    const s = serializarParaScript({ texto: "hola</script><script>alert(1)</script>" });
    expect(s).not.toContain("</script>");
    expect(JSON.parse(s)).toEqual({ texto: "hola</script><script>alert(1)</script>" });
  });
});

describe("textoLlms", () => {
  const t = textoLlms();

  it("empieza con el título y el resumen, como pide el formato", () => {
    expect(t.startsWith("# stailist\n\n> ")).toBe(true);
  });

  it("dice el precio y enlaza las páginas públicas con URL completa", () => {
    expect(t).toContain("Gratis y sin tarjeta");
    expect(t).toContain("(https://stailist.co/privacidad)");
    expect(t).toContain("(https://stailist.co)");
  });

  it("no promete lo que Roberto frenó: leer prendas de una foto del clóset abierto", () => {
    const todo = `${t} ${JSON.stringify(datosEstructurados())}`.toLowerCase();
    expect(todo).not.toMatch(/cl[oó]set abierto|foto de tu cl[oó]set/);
    expect(FICHA.funciones.some((f) => f.includes("fotos tuyas vestido"))).toBe(true);
  });
});
