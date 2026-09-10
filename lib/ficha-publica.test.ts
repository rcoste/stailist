import { describe, expect, it } from "vitest";
import { FICHA, datosEstructurados, serializarParaScript, textoLlms } from "./ficha-publica";

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
