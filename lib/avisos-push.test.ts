import { describe, expect, it } from "vitest";
import {
  esCulpaDeLaSuscripcion,
  esServicioDePush,
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

describe("a quién le habla nuestro servidor", () => {
  // La dirección la escribe el navegador y la base sólo pide que la fila sea de
  // quien la guarda. Sin esta lista, cualquiera con cuenta pone a nuestro
  // servidor a llamar cada mañana a la dirección que quiera.
  it("acepta los cuatro servicios de avisos que existen", () => {
    for (const e of [
      "https://fcm.googleapis.com/fcm/send/abc123:APA91b",
      "https://fcm.googleapis.com/wp/abc123",
      "https://jmt17.google.com/fcm/send/abc123",
      "https://web.push.apple.com/QGx7abc",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-par02p.notify.windows.com/w/?token=AwYAAAB",
    ]) {
      expect(esServicioDePush(e), e).toBe(true);
    }
  });

  it("rechaza cualquier otra dirección, aunque sea https", () => {
    for (const e of [
      "https://ejemplo.com/push",
      "http://fcm.googleapis.com/fcm/send/abc", // sin candado
      "https://fcm.googleapis.com.ejemplo.com/x", // el nombre bueno como prefijo de uno ajeno
      "https://ejemplo.com/?u=https://fcm.googleapis.com/", // el nombre bueno escondido en la ruta
      "https://push.apple.com.mx/x",
      "https://google.com.ejemplo.com/x",
      "https://migoogle.com/x",
      "https://usuario:clave@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest/meta-data/",
      "https://localhost/x",
      "no es una dirección",
      "",
    ]) {
      expect(esServicioDePush(e), e).toBe(false);
    }
  });

  it("rechaza una dirección kilométrica", () => {
    expect(esServicioDePush("https://fcm.googleapis.com/" + "a".repeat(2100))).toBe(false);
  });
});

describe("de quién es un fallo de envío", () => {
  // Tres fallos dan por rota una suscripción para siempre. Si los nuestros
  // contaran, unas llaves mal puestas en Vercel matarían todas en tres mañanas.
  it("un rechazo del servicio a ESA suscripción sí cuenta", () => {
    expect(esCulpaDeLaSuscripcion(400)).toBe(true);
    expect(esCulpaDeLaSuscripcion(413)).toBe(true);
  });
  it("llaves nuestras mal puestas, ritmo, caídas del servicio y cortes de red no cuentan", () => {
    for (const s of [401, 403, 429, 500, 502, 503, undefined]) {
      expect(esCulpaDeLaSuscripcion(s), String(s)).toBe(false);
    }
  });
  it("404 y 410 tampoco: ésas no acumulan, se borran al instante", () => {
    expect(esCulpaDeLaSuscripcion(404)).toBe(false);
    expect(esCulpaDeLaSuscripcion(410)).toBe(false);
  });
});
