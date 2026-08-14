import { describe, expect, it } from "vitest";
import {
  DIAS_MAXIMOS,
  HORAS_MINIMAS,
  elegirGancho,
  haceCuanto,
  leToca,
  type LookParaGancho,
  type PerfilReenganche,
} from "./reenganche";

const AHORA = new Date("2026-08-14T12:00:00Z");
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();

const perfil = (p: Partial<PerfilReenganche> = {}): PerfilReenganche => ({
  email: "andy@ejemplo.com",
  ultimaActividad: haceHoras(60),
  looks: 8,
  semanalUltimoEnvio: null,
  ...p,
});

describe("leToca — la ventana de rescate", () => {
  it("le escribe a quien lleva quieta 60h (el caso de Andy)", () => {
    expect(leToca(perfil(), AHORA)).toEqual({ toca: true });
  });

  it("no le escribe a quien sigue usando la app", () => {
    const v = leToca(perfil({ ultimaActividad: haceHoras(HORAS_MINIMAS - 1) }), AHORA);
    expect(v.toca).toBe(false);
  });

  it("justo en el borde de 48h ya califica", () => {
    expect(leToca(perfil({ ultimaActividad: haceHoras(HORAS_MINIMAS) }), AHORA).toca).toBe(true);
  });

  // La regla que evita el correo que miente: sin techo, la primera corrida le
  // dice "hace poco estuviste aquí" a quien se fue hace dos meses.
  it("NO le escribe a los fríos de hace más de una semana", () => {
    const v = leToca(perfil({ ultimaActividad: haceHoras(DIAS_MAXIMOS * 24 + 1) }), AHORA);
    expect(v.toca).toBe(false);
    expect(v.toca === false && v.motivo).toContain("win-back");
  });

  it("el último día de la ventana todavía entra", () => {
    expect(leToca(perfil({ ultimaActividad: haceHoras(DIAS_MAXIMOS * 24) }), AHORA).toca).toBe(true);
  });

  // roberto@playrobix.com: 127 prendas y 0 looks. Cargó todo y nunca pidió uno.
  it("no le escribe a quien cargó clóset pero nunca pidió un look", () => {
    const v = leToca(perfil({ looks: 0 }), AHORA);
    expect(v.toca).toBe(false);
    expect(v.toca === false && v.motivo).toBe("sin looks generados");
  });

  it("se espera si el semanal salió hace nada (nada de dobletes)", () => {
    const v = leToca(perfil({ semanalUltimoEnvio: haceHoras(10) }), AHORA);
    expect(v.toca).toBe(false);
    expect(v.toca === false && v.motivo).toContain("semanal");
  });

  it("con el semanal viejo sí le escribe", () => {
    expect(leToca(perfil({ semanalUltimoEnvio: haceHoras(24 * 6) }), AHORA).toca).toBe(true);
  });

  it("una fecha ilegible no manda correo (falla cerrado)", () => {
    expect(leToca(perfil({ ultimaActividad: "no-es-fecha" }), AHORA).toca).toBe(false);
  });
});

const look = (l: Partial<LookParaGancho> = {}): LookParaGancho => ({
  titulo: "Corsé Rebelde de Noche",
  prendas: ["Chamarra de piel", "Corsé de encaje", "Jean wide-leg"],
  voto: null,
  creadoEn: haceHoras(72),
  ...l,
});

describe("elegirGancho — qué le decimos", () => {
  it("con un 👍 usa SU look, con nombre, en el asunto", () => {
    const g = elegirGancho({ looks: [look({ voto: "up" })], prendas: 78, ahora: AHORA });
    expect(g.tipo).toBe("favorito");
    expect(g.asunto).toBe("¿Ya estrenaste el «Corsé Rebelde de Noche»?");
    expect(g.card?.frase).toBe("Corsé Rebelde de Noche");
    expect(g.parrafoHtml).toContain("78 prendas");
  });

  it("prefiere el look con 👍 aunque no sea el más reciente", () => {
    const g = elegirGancho({
      looks: [look({ titulo: "Look de ayer", voto: null }), look({ titulo: "El bueno", voto: "up" })],
      prendas: 78,
      ahora: AHORA,
    });
    expect(g.card?.frase).toBe("El bueno");
  });

  // Islam se fue justo después de un 👎. Recordarle ESE look sería decirle
  // "vuelve por lo que no te gustó".
  it("nunca usa un look rechazado con 👎", () => {
    const g = elegirGancho({
      looks: [look({ titulo: "El que odió", voto: "down" }), look({ titulo: "El anterior" })],
      prendas: 57,
      ahora: AHORA,
    });
    expect(g.tipo).toBe("ultimo");
    expect(g.card?.frase).toBe("El anterior");
    expect(JSON.stringify(g)).not.toContain("El que odió");
  });

  it("si TODOS sus looks son 👎 se apoya en el clóset, sin card", () => {
    const g = elegirGancho({ looks: [look({ voto: "down" })], prendas: 57, ahora: AHORA });
    expect(g.tipo).toBe("closet");
    expect(g.card).toBeNull();
    expect(g.asunto).toBe("Tus 57 prendas no se van a combinar solas");
  });

  it("sin título no arma un asunto absurdo con comillas vacías", () => {
    const g = elegirGancho({
      looks: [look({ titulo: null, voto: "up" })],
      prendas: 12,
      ahora: AHORA,
    });
    expect(g.asunto).toBe("¿Ya estrenaste el look que te gustó?");
    expect(g.card?.frase).toBe("Tu look");
  });

  it("escapa el HTML del título — lo escribe la IA, no nosotros", () => {
    const g = elegirGancho({
      looks: [look({ titulo: 'Negro & <b>filo</b>', voto: "up" })],
      prendas: 20,
      ahora: AHORA,
    });
    expect(g.card?.frase).toBe("Negro &amp; &lt;b&gt;filo&lt;/b&gt;");
  });

  it("nombra máximo 3 prendas — más es un inventario, no una carta", () => {
    const g = elegirGancho({
      looks: [look({ voto: "up", prendas: ["a", "b", "c", "d", "e"] })],
      prendas: 30,
      ahora: AHORA,
    });
    expect(g.card?.pie).toBe("a · b · c");
  });

  it("aguanta un look sin prendas legibles", () => {
    const g = elegirGancho({
      looks: [look({ voto: "up", prendas: ["", "  "] })],
      prendas: 30,
      ahora: AHORA,
    });
    expect(g.card?.pie).toBe("con tu ropa de siempre");
  });
});

describe("haceCuanto — en voz de amiga, no de reloj", () => {
  it("dice ayer, no 'hace 24 horas'", () => {
    expect(haceCuanto(haceHoras(30), AHORA)).toBe("ayer");
  });
  it("cuenta días completos", () => {
    expect(haceCuanto(haceHoras(72), AHORA)).toBe("hace 3 días");
  });
  it("una fecha rota no rompe la frase", () => {
    expect(haceCuanto("x", AHORA)).toBe("hace poco");
  });
});
