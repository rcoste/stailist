import { describe, expect, it } from "vitest";
import {
  esDeHoy,
  esRegistro,
  LINEA_REGISTRO,
  REGISTROS,
  registroDeOcasion,
  registroSugerido,
} from "@/lib/registro";
import { TIPOS_EVENTO } from "@/lib/eventos";

// LO QUE SE BLINDA AQUÍ NO ES EL MAPA: es DÓNDE ESTÁ EL CORTE DE LA CORAZONADA.
//
// El fit check puede adivinar a dónde vas, y adivinar mal es peor que no saber
// —da un consejo con toda la seguridad y todo equivocado—. Así que la regla es
// que sólo se enciende solo lo que es barato equivocar ("un día normal" no
// afirma nada) y nunca lo que es caro ("algo especial" sube la vara, "gym" la
// quita). Ese límite es el que estos tests defienden.

const LUNES_9AM = new Date(2026, 7, 10, 9, 0); // lunes 10 de agosto de 2026
const LUNES_10PM = new Date(2026, 7, 10, 22, 0);
const SABADO_11AM = new Date(2026, 7, 15, 11, 0);

describe("registroDeOcasion — del plan del wizard al registro", () => {
  it("la oficina es trabajo", () => {
    expect(registroDeOcasion("oficina")).toBe("trabajo");
  });

  it("una comida de trabajo TAMBIÉN es trabajo, aunque esté en el catálogo de eventos", () => {
    // Es la excepción del catálogo: se sienta en la mesa de un evento pero la
    // vara con la que se mide es la de la oficina.
    expect(TIPOS_EVENTO.some((t) => t.key === "comida-trabajo")).toBe(true);
    expect(registroDeOcasion("comida-trabajo")).toBe("trabajo");
  });

  it("TODO evento del catálogo es especial — incluidos los que se agreguen mañana", () => {
    // El mapa se deriva de lib/eventos justamente para esto: si alguien suma
    // "bautizo", entra como especial sin tocar este archivo. Escrito a mano,
    // un evento nuevo caería en "normal" y nadie se enteraría.
    for (const t of TIPOS_EVENTO) {
      if (t.key === "comida-trabajo") continue;
      expect(registroDeOcasion(t.key), t.key).toBe("especial");
    }
  });

  it("el 'evento' genérico también", () => {
    expect(registroDeOcasion("evento")).toBe("especial");
  });

  it("diario y viaje son un día normal", () => {
    expect(registroDeOcasion("diario")).toBe("normal");
    expect(registroDeOcasion("viaje")).toBe("normal");
  });

  it("una ocasión desconocida NO inventa registro", () => {
    // Devolver "normal" aquí sería afirmar algo por no saber. Devuelve null y
    // deja que decida el siguiente indicio.
    expect(registroDeOcasion("lo-que-sea")).toBeNull();
    expect(registroDeOcasion(null)).toBeNull();
    expect(registroDeOcasion("")).toBeNull();
  });
});

describe("registroSugerido — qué chip llega encendida", () => {
  it("lo que ella pidió HOY manda sobre el reloj", () => {
    // Sábado a mediodía, pero hoy pidió un look para la oficina: no es una
    // corazonada, es acordarse.
    expect(
      registroSugerido({ ocasionDeHoy: "oficina", lastObjective: null, ahora: SABADO_11AM })
    ).toBe("trabajo");
  });

  it("un look de hoy para una boda enciende 'algo especial'", () => {
    expect(
      registroSugerido({ ocasionDeHoy: "boda", lastObjective: "diario", ahora: LUNES_9AM })
    ).toBe("especial");
  });

  it("sin look de hoy, un lunes a las 9 de quien trabaja en oficina: trabajo", () => {
    expect(
      registroSugerido({ ocasionDeHoy: null, lastObjective: "oficina", ahora: LUNES_9AM })
    ).toBe("trabajo");
  });

  it("el MISMO lunes 9am de quien NO pide looks de oficina: día normal", () => {
    // El reloj solo no basta. Media base no trabaja en oficina y encenderles
    // "trabajo" cada mañana sería adivinar mal de forma sistemática.
    expect(
      registroSugerido({ ocasionDeHoy: null, lastObjective: "diario", ahora: LUNES_9AM })
    ).toBe("normal");
    expect(
      registroSugerido({ ocasionDeHoy: null, lastObjective: null, ahora: LUNES_9AM })
    ).toBe("normal");
  });

  it("lunes a las 10 de la noche no es horario de oficina", () => {
    expect(
      registroSugerido({ ocasionDeHoy: null, lastObjective: "oficina", ahora: LUNES_10PM })
    ).toBe("normal");
  });

  it("sábado no es día de oficina, aunque sea su objetivo de siempre", () => {
    expect(
      registroSugerido({ ocasionDeHoy: null, lastObjective: "oficina", ahora: SABADO_11AM })
    ).toBe("normal");
  });

  it("NUNCA enciende 'especial' ni 'rapido' por corazonada — sólo con look de hoy", () => {
    // La prueba de fuego del módulo. Se barren las 168 horas de la semana con
    // todos los objetivos guardados y sin look de hoy: nada puede salir de las
    // dos opciones baratas de equivocar.
    for (let dia = 0; dia < 7; dia++) {
      for (let hora = 0; hora < 24; hora++) {
        for (const obj of [null, "diario", "oficina", "evento", "viaje", "boda"]) {
          const r = registroSugerido({
            ocasionDeHoy: null,
            lastObjective: obj,
            ahora: new Date(2026, 7, 9 + dia, hora, 0),
          });
          expect(["normal", "trabajo"], `${dia} ${hora} ${obj}`).toContain(r);
        }
      }
    }
  });
});

describe("esDeHoy — en calendario local, no en UTC", () => {
  const ahora = new Date(2026, 7, 10, 20, 0); // lunes 8pm local

  it("un look de esta mañana es de hoy", () => {
    expect(esDeHoy(new Date(2026, 7, 10, 7, 30).toISOString(), ahora)).toBe(true);
  });

  it("LAS 8PM NO SON MAÑANA. La trampa de UTC, que ya mordió a look_date", () => {
    // A las 8pm de CDMX el reloj UTC ya pasó de medianoche. Comparar con
    // toISOString().slice(0,10) diría que este look es de otro día — y el
    // fit check de la noche perdería justo el contexto de la cena.
    const estaNoche = new Date(2026, 7, 10, 20, 30);
    expect(estaNoche.toISOString().slice(0, 10)).not.toBe("2026-08-10"); // la trampa existe
    expect(esDeHoy(estaNoche.toISOString(), ahora)).toBe(true); // y no caemos en ella
  });

  it("el de ayer no", () => {
    expect(esDeHoy(new Date(2026, 7, 9, 20, 0).toISOString(), ahora)).toBe(false);
  });

  it("una fecha basura no truena, sólo dice que no", () => {
    expect(esDeHoy("no-es-fecha", ahora)).toBe(false);
  });
});

describe("el contrato con la UI y con el prompt", () => {
  it("los cuatro registros tienen chip y tienen línea de prompt", () => {
    // Un registro sin línea llegaría al modelo como silencio: la chip cambiaría
    // de color y la respuesta sería idéntica.
    for (const r of REGISTROS) {
      expect(LINEA_REGISTRO[r.key], r.key).toBeTruthy();
      expect(r.label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(LINEA_REGISTRO)).toHaveLength(REGISTROS.length);
  });

  it("esRegistro no deja pasar basura del request", () => {
    expect(esRegistro("trabajo")).toBe(true);
    expect(esRegistro("Trabajo")).toBe(false);
    expect(esRegistro("")).toBe(false);
    expect(esRegistro(null)).toBe(false);
    expect(esRegistro(7)).toBe(false);
  });

  it("'gym o un mandado' le dice al modelo que NO hay vara, no que la baje", () => {
    // Es el registro que más fácil se rompe en una edición futura: si esta
    // línea se vuelve "es informal", el modelo va a sugerirle arreglarse para
    // ir al gym, que es no haber entendido la pregunta.
    expect(LINEA_REGISTRO.rapido).toContain("NO HAY VARA");
  });
});
