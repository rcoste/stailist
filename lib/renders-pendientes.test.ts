import { describe, expect, it, vi } from "vitest";
import { esRenderPendiente, mensajeDePendientes } from "@/lib/renders-pendientes";
import { correoPrendasPendientes, leTocaAviso, type CandidataAviso } from "@/lib/prendas-pendientes-correo";
import { gastoPausaImagenes } from "@/lib/freno-imagenes";
import { AVISO_USD_PERSONA, decidirAlarmas } from "@/lib/vigilancia";
import { CUOTAS, TOPE_USD_DIA_GLOBAL } from "@/lib/cuotas";

vi.mock("@/lib/db", () => ({ withDb: vi.fn() }));

// LO QUE SE BLINDA: la decisión de producto del tope de imágenes. Subir ropa no
// se corta nunca; lo que se pospone es la imagen limpia, una sola vez por
// prenda, y sólo se le escribe a la persona cuando de verdad puede seguir.

describe("prendas pendientes de pulir", () => {
  const base = { photo_path: "u/origen-1.jpg", render_path: null, render_status: "none", attrs: { render_pendiente: true } };

  it("es pendiente la que trae la marca, tiene su foto y aún no tiene imagen limpia", () => {
    expect(esRenderPendiente(base)).toBe(true);
  });

  it("no lo es sin la marca: un render que FALLÓ no se reintenta solo (bucle de costo)", () => {
    expect(esRenderPendiente({ ...base, render_status: "failed", attrs: {} })).toBe(false);
    expect(esRenderPendiente({ ...base, attrs: null })).toBe(false);
  });

  it("vale también la foto guardada aparte (de una foto salieron varias prendas)", () => {
    expect(esRenderPendiente({ ...base, photo_path: null, attrs: { render_pendiente: true, origen_foto: "u/origen-1.jpg" } })).toBe(true);
  });

  it("no lo es sin foto de dónde sacarla, ni cuando ya quedó pulida", () => {
    expect(esRenderPendiente({ ...base, photo_path: null })).toBe(false);
    expect(esRenderPendiente({ ...base, render_status: "done", render_path: "u/render-1.jpg" })).toBe(false);
  });

  it("al terminar de subir dice cuántas entraron, cuántas quedaron listas y que avisa mañana", () => {
    const m = mensajeDePendientes(120, 80)!;
    expect(m).toContain("120 prendas");
    expect(m).toContain("dejé 40 listas");
    expect(m).toContain("mañana");
    expect(m).not.toMatch(/límite|error|no se pudo/);
    expect(mensajeDePendientes(12, 12)).toContain("ya sirven para armar looks");
    expect(mensajeDePendientes(12, 0)).toBeNull();
  });
});

describe("el aviso del día siguiente", () => {
  const mediodia = new Date("2026-10-05T18:00:00Z"); // 12:00 en CDMX
  const c: CandidataAviso = {
    pendientes: 80,
    ultimaPendiente: "2026-10-04T02:40:00Z",
    renders24h: 0,
    avisoEnviado: null,
  };

  it("toca cuando hay pendientes, ya hay cupo y es de día", () => {
    expect(leTocaAviso(c, mediodia)).toEqual({ toca: true });
  });

  it("no toca mientras sus renders de ayer sigan ocupando el cupo", () => {
    expect(leTocaAviso({ ...c, renders24h: CUOTAS.renders }, mediodia)).toMatchObject({ toca: false, motivo: "aún sin cupo" });
    // Con pocas pendientes basta con que quepan ésas.
    expect(leTocaAviso({ ...c, pendientes: 5, renders24h: CUOTAS.renders - 5 }, mediodia)).toEqual({ toca: true });
  });

  it("uno por tanda: no se repite hasta que suba prendas nuevas", () => {
    expect(leTocaAviso({ ...c, avisoEnviado: "2026-10-05T15:00:00Z" }, mediodia)).toMatchObject({ motivo: "ya avisada" });
    expect(
      leTocaAviso({ ...c, avisoEnviado: "2026-10-05T15:00:00Z", ultimaPendiente: "2026-10-05T16:00:00Z" }, mediodia)
    ).toEqual({ toca: true });
  });

  it("no escribe de madrugada ni a quien no tiene pendientes", () => {
    expect(leTocaAviso(c, new Date("2026-10-05T09:00:00Z"))).toMatchObject({ motivo: "fuera de horario" }); // 3 am
    expect(leTocaAviso({ ...c, pendientes: 0 }, mediodia)).toMatchObject({ motivo: "sin pendientes" });
  });

  it("el correo no promete que ya están: se pulen cuando entra, y dice el tope del día", () => {
    const { subject, text, html } = correoPrendasPendientes({ unsubToken: "tok", pendientes: 80 });
    expect(subject).toBe("ya puedo seguir con tu clóset");
    expect(text).toContain("las 80 prendas que faltaban");
    expect(text).toContain(`Hoy alcanzo a dejar ${CUOTAS.renders}`);
    expect(text).toContain("/closet");
    expect(text).toContain("Date de baja");
    expect(html).toContain("Abrir mi clóset");
    expect(correoPrendasPendientes({ unsubToken: "tok", pendientes: 1 }).text).toContain("la prenda que faltaba");
  });
});

describe("frenos de dinero", () => {
  it("el freno global pausa las imágenes al llegar al tope, no antes", () => {
    expect(gastoPausaImagenes(TOPE_USD_DIA_GLOBAL - 0.01)).toBe(false);
    expect(gastoPausaImagenes(TOPE_USD_DIA_GLOBAL)).toBe(true);
    expect(gastoPausaImagenes(Number.NaN)).toBe(false);
  });

  it("avisa de cada persona que cruzó el umbral de gasto", () => {
    const quieto = { fallosUltimaHora: 0, llamadasUltimaHora: 10, gastoUltimasHoras: 1, topeGasto: 40 };
    expect(decidirAlarmas(quieto)).toEqual([]);
    const a = decidirAlarmas({ ...quieto, personasCaras: [{ correo: "a@ejemplo.com", gasto: 19.15 }, { correo: "b@ejemplo.com", gasto: AVISO_USD_PERSONA - 1 }] });
    expect(a.map((x) => x.clave)).toEqual(["persona-gasto"]);
    expect(a[0].titulo).toContain("a@ejemplo.com lleva $19.15");
  });
});
