import { describe, expect, it } from "vitest";
import { correoDiarioHtml, diaEnPalabras, esc } from "@/lib/admin/campana-correo";
import type { DatosCorreoDiario } from "@/lib/admin/campana";

const base: DatosCorreoDiario = {
  ayer: "2026-10-03",
  iaAyerUsd: 1.5,
  iaAyerLlamadas: 12,
  iaTop: null,
  nuevasAyer: 2,
  nuevasAyerDeCampana: 2,
  primerLookAyer: 2,
  campanas: [],
  paro: { estado: "faltan-datos", conPrimerLook: 3, cerradas: 0, volvieron: 0 },
  desde: "2026-10-01",
};

describe("correoDiarioHtml", () => {
  it("dice el día en palabras y trae las cifras del vistazo", () => {
    const html = correoDiarioHtml(base);
    expect(diaEnPalabras("2026-10-03")).toBe("sábado, 3 de octubre");
    expect(html).toContain("3 de octubre");
    expect(html).toContain("$1.50");
    expect(html).toContain("0/6");
    expect(html).toContain("Faltan datos");
    expect(html).toContain("https://stailist.co/admin/campana");
  });

  it("escapa lo que viene de la base: un correo o una campaña nunca se vuelven HTML", () => {
    const html = correoDiarioHtml({
      ...base,
      quienAyer: [
        { correo: "<script>x</script>@a.test", origen: "a&b", dispositivo: "celular", paso: "llegó", prendas: 1, fotos: 0 },
      ],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&amp;b");
    expect(esc('"')).toBe("&quot;");
  });

  it("pinta cada campaña con su embudo y cada objetivo con su estado", () => {
    const html = correoDiarioHtml({
      ...base,
      campanas: [
        {
          fuente: "google",
          campana: "app-neutra",
          impresiones: 40,
          clics: 6,
          costoMxn: 90,
          registrosGoogle: null,
          pidieronCodigo: 0, landing: 0, boton: 0, correoVisto: 0, correoOk: 0,
          entraron: 2,
          registro: 2,
          pasos: [2, 2, 2, 2, 2],
          primerLook: 2,
          ttvMedianaS: 480,
          ventanaCerrada: 0,
          volvieron: 0,
          seLoPusieron: 0,
          iaUsd: 0,
        },
      ],
      objetivosLineas: [{ clave: "x", objetivo: "Costo por primer look", meta: "≤ $150", real: "$45", estado: "bien" }],
    });
    expect(html).toContain("app-neutra");
    expect(html).toContain("primer look");
    expect(html).toContain("Costo por primer look");
    expect(html).toContain("va bien");
  });
});

describe("campanasParaCorreo", () => {
  it("deja fuera una etiqueta de prueba sin clics, sin gasto y sin nadie adentro", async () => {
    const { campanasParaCorreo } = await import("@/lib/admin/campana");
    const vacia = {
      fuente: "google", campana: "prueba-borrador", impresiones: null, clics: null, costoMxn: null,
      registrosGoogle: null, pidieronCodigo: 4, landing: 0, boton: 0, correoVisto: 0, correoOk: 0, entraron: 0, registro: 0, pasos: [0, 0, 0, 0, 0],
      primerLook: 0, ttvMedianaS: null, ventanaCerrada: 0, volvieron: 0, seLoPusieron: 0, iaUsd: 0,
    };
    const conGente = { ...vacia, campana: "app-neutra", entraron: 2 };
    const conGasto = { ...vacia, campana: "hombres-eventos", costoMxn: 20 };
    expect(campanasParaCorreo([vacia, conGente, conGasto]).map((c) => c.campana)).toEqual(["app-neutra", "hombres-eventos"]);
  });
});

describe("avisos del correo", () => {
  it("una falla (p. ej. el gasto de Meta) sale arriba en los dos formatos, escapada", async () => {
    const { correoDiario } = await import("@/lib/admin/campana");
    const d = { ...base, avisos: ["No se pudo traer el gasto de Meta: <código 190>"] };
    const { text } = correoDiario(d);
    expect(text.startsWith("AVISOS\n- No se pudo traer el gasto de Meta")).toBe(true);
    const html = correoDiarioHtml(d);
    expect(html).toContain("No se pudo traer el gasto de Meta: &lt;código 190&gt;");
    expect(html.indexOf("No se pudo traer")).toBeLessThan(html.indexOf("cuentas nuevas"));
    expect(correoDiario(base).text).not.toContain("AVISOS");
  });
});
