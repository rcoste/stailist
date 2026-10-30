import { describe, expect, it } from "vitest";
import {
  fechaLocal,
  leTocaAviso,
  pushActivo,
  textoDelAviso,
  URL_AL_ABRIR,
  type EstadoParaAviso,
} from "./avisos-push";

// Los avisos push nacen apagados (2026-10-30) y se prenden el 5-nov o después.
// Lo que estos tests blindan es la DECISIÓN que viaja: a quién le toca un
// aviso hoy y qué dice. El resto (navegador, base, envío) se prueba a mano con
// ?ensayo=1 y con un teléfono real.

const base: EstadoParaAviso = {
  ultimoEnvio: null,
  ultimaActividad: "2026-11-01T15:00:00Z",
  enviosSinActividad: 0,
  fallos: 0,
  looksHoy: 0,
};
// 13:00 UTC del 5-nov = 7:00 de CDMX del mismo día.
const ahora = new Date("2026-11-05T13:00:00Z");

describe("el switch", () => {
  it("apagado sin la variable, aunque haya llave", () => {
    expect(pushActivo({ switch: undefined, llavePublica: "B".repeat(87) })).toBe(false);
    expect(pushActivo({ switch: "0", llavePublica: "B".repeat(87) })).toBe(false);
  });
  it("apagado con la variable pero sin llave pública", () => {
    expect(pushActivo({ switch: "1", llavePublica: "" })).toBe(false);
  });
  it("prendido sólo con las dos", () => {
    expect(pushActivo({ switch: "1", llavePublica: "B".repeat(87) })).toBe(true);
  });
});

describe("la fecha local", () => {
  it("a las 13:00 UTC en CDMX todavía es el mismo día", () => {
    expect(fechaLocal(ahora)).toBe("2026-11-05");
  });
  it("a las 05:00 UTC en CDMX sigue siendo el día anterior", () => {
    expect(fechaLocal(new Date("2026-11-05T05:00:00Z"))).toBe("2026-11-04");
  });
});

describe("a quién le toca", () => {
  it("le toca a quien tiene suscripción sana, no ha recibido hoy y no está usando la app", () => {
    expect(leTocaAviso(base, ahora)).toEqual({ toca: true, motivo: "toca" });
  });

  it("no se repite el mismo día (fecha LOCAL: un envío a las 7am no se repite a las 11pm UTC)", () => {
    expect(leTocaAviso({ ...base, ultimoEnvio: "2026-11-05T13:00:30Z" }, new Date("2026-11-06T04:00:00Z")).motivo).toBe("ya_hoy");
  });

  it("sí se manda al día siguiente", () => {
    expect(leTocaAviso({ ...base, ultimoEnvio: "2026-11-04T13:00:30Z" }, ahora).toca).toBe(true);
  });

  it("no se le avisa a quien ya generó su look de hoy", () => {
    expect(leTocaAviso({ ...base, looksHoy: 1 }, ahora).motivo).toBe("ya_tiene_look_hoy");
  });

  it("no se le avisa a quien está usando la app ahora mismo", () => {
    expect(leTocaAviso({ ...base, ultimaActividad: "2026-11-05T12:30:00Z" }, ahora).motivo).toBe("esta_aqui");
  });

  it("después de siete avisos sin respuesta se deja de insistir", () => {
    expect(leTocaAviso({ ...base, enviosSinActividad: 7 }, ahora).motivo).toBe("sin_respuesta");
    expect(leTocaAviso({ ...base, enviosSinActividad: 6 }, ahora).toca).toBe(true);
  });

  it("una suscripción con tres fallos seguidos se da por rota", () => {
    expect(leTocaAviso({ ...base, fallos: 3 }, ahora).motivo).toBe("suscripcion_rota");
  });

  it("quien nunca ha hecho nada después de suscribirse también recibe (la actividad puede ser null)", () => {
    expect(leTocaAviso({ ...base, ultimaActividad: null }, ahora).toca).toBe(true);
  });
});

describe("qué dice", () => {
  it("con un look ya planeado para hoy, lo anuncia con su título", () => {
    const a = textoDelAviso({ tituloHoy: "  Camisa blanca y jeans  rectos ", hoy: "2026-11-05" });
    expect(a.titulo).toBe("tu look de hoy ya está");
    expect(a.cuerpo).toBe("Camisa blanca y jeans rectos. Ábrelo para verlo completo.");
    expect(a.url).toBe(URL_AL_ABRIR);
  });

  it("un título kilométrico se recorta para que iOS no lo corte a medias", () => {
    const a = textoDelAviso({ tituloHoy: "x".repeat(200), hoy: "2026-11-05" });
    expect(a.cuerpo.length).toBeLessThan(120);
    expect(a.cuerpo).toContain("…");
  });

  it("sin look planeado, rota entre textos por día y nunca es idéntico dos días seguidos", () => {
    const a = textoDelAviso({ tituloHoy: null, hoy: "2026-11-05" });
    const b = textoDelAviso({ tituloHoy: null, hoy: "2026-11-06" });
    expect(a.titulo).not.toBe(b.titulo);
    expect(a.url).toBe(URL_AL_ABRIR);
  });

  it("ningún texto lleva emoji ni jerga", () => {
    for (const d of ["01", "02", "03"]) {
      const a = textoDelAviso({ tituloHoy: null, hoy: `2026-11-${d}` });
      expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
