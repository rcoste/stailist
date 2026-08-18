// @vitest-environment jsdom
//
// Tests de COMPONENTE del wizard de "crear un look" — los primeros del repo.
//
// POR QUÉ EXISTEN
// La lógica pura del wizard ya estaba probada (climaParaElMotor, el catálogo de
// eventos, las líneas del prompt), pero las DECISIONES de producto viven en la
// pantalla: qué se pregunta, en qué orden, y sobre todo qué se manda al motor
// según lo que la persona tocó. Eso no lo atrapa ningún test de función pura, y
// es justo donde un refactor rompe algo sin que nadie se entere.
//
// El entorno jsdom se activa con el docblock de arriba, POR ARCHIVO. Es a
// propósito: los otros 67 archivos de test corren en Node y no tienen por qué
// pagar el costo (ni el riesgo) de un DOM falso.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LookRequest, type LookInput, type ClosetPick } from "./weather-picker";

// Solo se simula lo que sale por RED (Open-Meteo). Las funciones puras del
// módulo —hayLluvia y compañía— se conservan con `importOriginal`: son la
// lógica que queremos ejercitar, no un borde que aislar. Simularlas de más ya
// costó un falso rojo (el banner del clima resuelto reventó con `hayLluvia is
// not a function` y el fallo apuntaba al test, no al mock).
vi.mock("@/lib/weather", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/weather")>()),
  getWeather: vi.fn(async () => null),
  getWeatherForDates: vi.fn(async () => null),
  geocodePlace: vi.fn(async () => null),
  // Sin este mock, los tests con permiso "granted" disparaban un fetch REAL a
  // BigDataCloud (el spread de importOriginal trae la función de verdad):
  // flakiness de red dentro de la suite. Cazado por la auditoría de cobertura.
  reverseGeocode: vi.fn(async () => "Querétaro"),
}));

/** Avanza al paso siguiente del wizard. */
async function siguiente(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole("button", { name: /siguiente/i }));
}

/**
 * Camino corto hasta el paso del clima con el cuestionario manual abierto:
 * plan "un día normal" → cuándo → clima → "prefiero decirte yo".
 * Sin coordenadas (jsdom no trae geolocation) el wizard ofrece compartir
 * ubicación y la salida manual, que es la que este helper toma.
 */
async function hastaElClimaManual(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole("button", { name: /un día normal/i }));
  await siguiente(u);
  await siguiente(u);
  await u.click(await screen.findByRole("button", { name: /prefiero decirte yo/i }));
}

/**
 * Sustituye SOLO las capacidades que el test necesita, conservando el resto del
 * navigator real. Un `{...navigator}` no sirve: sus propiedades viven en el
 * prototipo, así que el spread copia CERO claves y deja a userEvent sin
 * `clipboard` ni `userAgent` — falla lejos de aquí y sin pista de por qué.
 */
function stubNavigator(extras: Record<string, unknown>) {
  vi.stubGlobal(
    "navigator",
    Object.create(
      navigator,
      Object.fromEntries(
        Object.entries(extras).map(([k, v]) => [k, { value: v, configurable: true }])
      )
    )
  );
}

/** El segmentado de "¿va a llover?" / "¿la lluvia te toca?" / "¿llevas paraguas?". */
function segmentado(etiqueta: RegExp): HTMLElement {
  // Cada pregunta vive en su propia fila; se ancla por el texto y se sube al
  // contenedor para no confundir el "sí" de una con el de otra.
  const label = screen.getByText(etiqueta);
  const fila = label.closest("div")?.parentElement;
  if (!fila) throw new Error(`no encontré la fila de ${etiqueta}`);
  return fila as HTMLElement;
}

const props = {
  defaultObjective: null,
  onPick: vi.fn(),
  onExit: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Desmontar a mano: el auto-cleanup de testing-library solo se engancha con
  // `globals: true` en vitest, y este repo no lo usa. Sin esto, cada render se
  // apila en el mismo document y toda query encuentra dos wizards.
  cleanup();
  // Los stubs de capacidades del navegador no deben filtrarse entre tests.
  vi.unstubAllGlobals();
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe("paso 1 — los planes que se ofrecen", () => {
  it("muestra los 6 planes sociales y YA NO el chip 'otro…'", async () => {
    render(<LookRequest {...props} />);
    for (const plan of [
      "cena con amigos",
      "una cita",
      "comida familiar",
      "comida de trabajo",
      "una fiesta",
      "una boda",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(plan, "i") })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /^otro…$/i })).toBeNull();
  });

  it("graduación y funeral NO son chips: entran por el campo libre", () => {
    // Decisión de Roberto: "son eventos muy esporádicos... nos quita espacio
    // para una acción que no es tan recurrente y que puede ir en otros". Si
    // alguien los devuelve a la rejilla, este test lo caza — y de paso avisa
    // que su paso de detalle vuelve a ser alcanzable.
    render(<LookRequest {...props} />);
    expect(screen.queryByRole("button", { name: /graduación/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /funeral/i })).toBeNull();
    expect(screen.getByPlaceholderText(/escríbelo o díctalo/i)).toBeTruthy();
  });
});

describe("el micrófono del campo libre", () => {
  it("SIN motor de dictado en el navegador, el botón no se pinta", () => {
    // jsdom no trae Web Speech API — el mismo caso que la PWA instalada de iOS.
    // La regla: un mic que no graba es una mentira visual, así que no existe.
    render(<LookRequest {...props} />);
    expect(screen.queryByRole("button", { name: /dictar tu plan/i })).toBeNull();
  });

  it("CON motor de dictado, aparece y abre la hoja 'te escucho…'", async () => {
    const start = vi.fn();
    class ReconocedorFalso {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        start();
        this.onstart?.();
      }
      abort() {}
    }
    vi.stubGlobal("SpeechRecognition", ReconocedorFalso);

    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    const mic = screen.getByRole("button", { name: /dictar tu plan/i });
    await u.click(mic);

    expect(await screen.findByText(/te escucho…/i)).toBeTruthy();
    expect(start).toHaveBeenCalled();
  });

  it("lo dictado NO se usa hasta que la persona lo confirma", async () => {
    // "listo, úsalo" es el único camino del texto al campo: nada se manda por
    // haberlo dicho en voz alta.
    let instancia: { onresult?: (e: unknown) => void; onstart?: () => void } | null = null;
    class ReconocedorFalso {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        instancia = this as never;
      }
      start() {
        this.onstart?.();
      }
      abort() {}
    }
    vi.stubGlobal("SpeechRecognition", ReconocedorFalso);

    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /dictar tu plan/i }));
    await screen.findByText(/te escucho…/i);

    // El navegador entrega la transcripción.
    instancia!.onresult?.({
      results: [{ isFinal: true, 0: { transcript: "un concierto en la noche" } }],
    });

    // Todavía NO está en el campo: solo se ve en la hoja.
    const campo = screen.getByPlaceholderText(/escríbelo o díctalo/i) as HTMLInputElement;
    expect(campo.value).toBe("");

    await u.click(screen.getByRole("button", { name: /listo, úsalo/i }));
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText(/escríbelo o díctalo/i) as HTMLInputElement).value
      ).toBe("un concierto en la noche");
    });
  });
});

describe("el dictado en varios turnos", () => {
  /** Reconocedor falso que guarda cada instancia creada (una por turno). */
  function stubReconocedor() {
    const instancias: {
      onstart?: () => void;
      onresult?: (e: unknown) => void;
      onerror?: (e: unknown) => void;
      onend?: () => void;
    }[] = [];
    class ReconocedorFalso {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        instancias.push(this as never);
      }
      start() {
        this.onstart?.();
      }
      abort() {}
    }
    vi.stubGlobal("SpeechRecognition", ReconocedorFalso);
    return instancias;
  }

  it("'seguir dictando' SUMA al turno anterior, no lo borra", async () => {
    // El bug que esto blinda: cada sesión de reconocimiento empieza en blanco y
    // `onresult` ASIGNA la frase de su sesión (tiene que hacerlo: el navegador
    // reenvía todos sus resultados). Sin acumulador, el segundo turno pisaba al
    // primero y la persona veía desaparecer lo que ya había dicho.
    const instancias = stubReconocedor();
    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /dictar tu plan/i }));
    await screen.findByText(/te escucho…/i);

    instancias[0].onresult?.({
      results: [{ isFinal: true, 0: { transcript: "un concierto" } }],
    });
    instancias[0].onend?.();

    await u.click(await screen.findByRole("button", { name: /seguir dictando/i }));
    await waitFor(() => expect(instancias.length).toBe(2));
    instancias[1].onresult?.({
      results: [{ isFinal: true, 0: { transcript: "en la noche" } }],
    });

    // Y se VE completo en la hoja, no solo al confirmar.
    expect(await screen.findByText(/un concierto en la noche/)).toBeTruthy();

    await u.click(screen.getByRole("button", { name: /listo, úsalo/i }));
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText(/escríbelo o díctalo/i) as HTMLInputElement).value
      ).toBe("un concierto en la noche");
    });
  });

  it("no duplica palabras cuando el navegador reenvía la sesión completa", async () => {
    // La Web Speech API manda TODOS los resultados en cada evento. Acumular con
    // `+=` entre eventos duplicaría cada palabra.
    const instancias = stubReconocedor();
    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /dictar tu plan/i }));
    await screen.findByText(/te escucho…/i);

    const r1 = { isFinal: true, 0: { transcript: "un concierto " } };
    const r2 = { isFinal: true, 0: { transcript: "en la noche" } };
    instancias[0].onresult?.({ results: [r1] });
    instancias[0].onresult?.({ results: [r1, r2] }); // reenvío completo

    await u.click(screen.getByRole("button", { name: /listo, úsalo/i }));
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText(/escríbelo o díctalo/i) as HTMLInputElement).value
      ).toBe("un concierto en la noche");
    });
  });

  it("quedarse callado NO es un error que mostrar", async () => {
    // "no-speech" es la rama negada (`e.error !== "no-speech"`): sin cerca, un
    // silencio se convertiría en la hoja de "no puedo escucharte".
    const instancias = stubReconocedor();
    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /dictar tu plan/i }));
    await screen.findByText(/te escucho…/i);

    instancias[0].onerror?.({ error: "no-speech" });
    instancias[0].onend?.();

    expect(await screen.findByText(/no alcancé a oír nada/i)).toBeTruthy();
    expect(screen.queryByText(/no puedo escucharte/i)).toBeNull();
  });

  it("con el micrófono BLOQUEADO lo dice y ofrece escribirlo", async () => {
    const instancias = stubReconocedor();
    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /dictar tu plan/i }));
    await screen.findByText(/te escucho…/i);

    instancias[0].onerror?.({ error: "not-allowed" });

    expect(await screen.findByText(/micrófono bloqueado para stailist/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /mejor lo escribo/i })).toBeTruthy();
  });
});

describe("la ubicación no se pide de sorpresa", () => {
  it("con el permiso sin decidir, tocar la card NO dispara el prompt del navegador", async () => {
    // El prompt sale UNA vez en la vida de la instalación y un "no permitir" no
    // se puede volver a preguntar. Por eso primero se explica para qué se usa y
    // el botón es el que lo pide.
    const getCurrentPosition = vi.fn();
    stubNavigator({
      permissions: { query: async () => ({ state: "prompt" }) },
      geolocation: { getCurrentPosition },
    });

    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await u.click(screen.getByRole("button", { name: /en esta ciudad/i }));

    expect(
      await screen.findByText(/te lo pide el navegador solo una vez/i)
    ).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    // Y el botón del reveal sí lo pide.
    await u.click(screen.getByRole("button", { name: /compartir mi ubicación/i }));
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
  });

  it("con el permiso BLOQUEADO lo dice, en vez de fallar en silencio", async () => {
    const getCurrentPosition = vi.fn();
    stubNavigator({
      permissions: { query: async () => ({ state: "denied" }) },
      geolocation: { getCurrentPosition },
    });

    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await u.click(screen.getByRole("button", { name: /en esta ciudad/i }));

    expect(await screen.findByText(/ubicación bloqueada para stailist/i)).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("con el permiso YA DADO lee en silencio: nadie se come el paso extra", async () => {
    // Es el camino de quien ya usó la app. Si aquí saliera la explicación, el
    // reveal dejaría de ser "la primera vez" y sería un tap de más para siempre.
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 18.9, longitude: -99.2 } } as GeolocationPosition)
    );
    stubNavigator({
      permissions: { query: async () => ({ state: "granted" }) },
      geolocation: { getCurrentPosition },
    });

    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await u.click(screen.getByRole("button", { name: /en esta ciudad/i }));

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    expect(screen.queryByText(/te lo pide el navegador solo una vez/i)).toBeNull();
  });

  it("la card preseleccionada arranca SOLA: el reveal sale sin segundo tap", async () => {
    // El bug de Roberto (2026-08-17): "en esta ciudad" venía marcada por
    // default, pero su lógica solo corría en el TAP — había que volver a picar
    // lo ya elegido para que apareciera "compartir mi ubicación". Ahora el
    // paso llega y el reveal se abre solo. El prompt del navegador sigue SIN
    // salir: eso queda reservado al botón (un gesto), como siempre.
    const getCurrentPosition = vi.fn();
    stubNavigator({
      permissions: { query: async () => ({ state: "prompt" }) },
      geolocation: { getCurrentPosition },
    });

    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);

    // SIN tocar la card:
    expect(await screen.findByText(/te lo pide el navegador solo una vez/i)).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("con permiso dado DICE qué ciudad detectó — en la card y en el clima", async () => {
    // "listo — ya sé dónde" sin decir dónde no deja verificar nada: un clima
    // de la ciudad equivocada se ve idéntico a uno de la correcta.
    const { getWeather } = await import("@/lib/weather");
    vi.mocked(getWeather).mockResolvedValue({ temp_c: 22, condition: "despejado" });
    stubNavigator({
      permissions: { query: async () => ({ state: "granted" }) },
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 20.6, longitude: -100.4 } } as GeolocationPosition),
      },
    });

    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);

    expect(await screen.findByText(/estás en Querétaro/i)).toBeTruthy();

    // Y el banner del clima nombra la ciudad detectada (aquiLabel), no solo
    // cuando se escribió una "otra ciudad" (ciudadGeo).
    await siguiente(u);
    expect(await screen.findByText(/en Querétaro/i)).toBeTruthy();
  });
});

describe("¿la lluvia te toca? — lo que viaja al motor", () => {
  /** Deja el wizard en: clima manual, banda templada, "sí llueve". */
  async function conLluviaManual(u: ReturnType<typeof userEvent.setup>) {
    await hastaElClimaManual(u);
    await u.click(await screen.findByRole("button", { name: /templado/i }));
    const llover = segmentado(/¿va a llover\?/i);
    await u.click(within(llover).getByRole("button", { name: /^sí$/i }));
  }

  it("sin lluvia no se pregunta nada de techo ni de paraguas", async () => {
    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await hastaElClimaManual(u);
    await u.click(await screen.findByRole("button", { name: /templado/i }));

    expect(screen.queryByText(/¿la lluvia te toca\?/i)).toBeNull();
    expect(screen.queryByText(/¿llevas paraguas\?/i)).toBeNull();
  });

  it("la lluvia MANUAL también pasa por el filtro del techo", async () => {
    // El hueco de consistencia que marcó Roberto: si "¿va a llover?" se
    // contesta a mano y no apareciera esta pregunta, la lluvia se colaría al
    // motor sin pasar por el filtro.
    const u = userEvent.setup();
    render(<LookRequest {...props} />);
    await conLluviaManual(u);

    expect(await screen.findByText(/¿la lluvia te toca\?/i)).toBeTruthy();
  });

  it("TECHADO manda `techado` y NO manda paraguas (la pregunta desaparece)", async () => {
    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} />);
    await conLluviaManual(u);

    await u.click(screen.getByRole("button", { name: /^techado$/i }));
    // Bajo techo el paraguas no significa nada: la pregunta se va.
    await waitFor(() => expect(screen.queryByText(/¿llevas paraguas\?/i)).toBeNull());

    await u.click(screen.getByRole("button", { name: /armar mi look/i }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());

    const input = onPick.mock.calls[0][0] as LookInput;
    expect(input.techado).toBe(true);
    // Lo que se MANDA sigue diciendo que llueve: quitarle el agua es cosa del
    // server (climaParaElMotor), y solo para el motor — lo guardado no miente.
    expect("weather" in input && input.weather.condition).toBe("lluvia");
    expect("paraguas" in input).toBe(false);
  });

  it("AFUERA manda paraguas y NO manda techado", async () => {
    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} />);
    await conLluviaManual(u);

    // "afuera" es el default (el lado seguro): quien no conteste recibe el
    // look de lluvia de siempre.
    expect(await screen.findByText(/¿llevas paraguas\?/i)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /armar mi look/i }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());

    const input = onPick.mock.calls[0][0] as LookInput;
    expect("techado" in input).toBe(false);
    expect(input.paraguas).toBe(false);
  });
});

describe("la lluvia AUTOMÁTICA (el camino real de casi todos)", () => {
  it("el pronóstico con lluvia abre la pregunta del techo y conserva la condición REAL", async () => {
    // Los otros tests de techado entran por el cuestionario manual. Este es el
    // camino que recorre casi todo el mundo: el pronóstico dice que llueve y la
    // app concluye. Además ejercita la rama `intacto` de armar(): si nadie
    // corrigió el pre-llenado, viaja la condición leída ("chubascos"), no la
    // palabra genérica "lluvia" — y el server necesita reconocerla como agua.
    const { getWeather } = await import("@/lib/weather");
    vi.mocked(getWeather).mockResolvedValue({ temp_c: 19, condition: "chubascos" });
    stubNavigator({
      permissions: { query: async () => ({ state: "granted" }) },
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 18.9, longitude: -99.2 } } as GeolocationPosition),
      },
    });

    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await siguiente(u);

    expect(await screen.findByText(/¿la lluvia te toca\?/i)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /^techado$/i }));
    await waitFor(() => expect(screen.queryByText(/¿llevas paraguas\?/i)).toBeNull());

    await u.click(screen.getByRole("button", { name: /armar mi look/i }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());

    const input = onPick.mock.calls[0][0] as LookInput;
    expect(input.techado).toBe(true);
    expect("weather" in input && input.weather.condition).toBe("chubascos");
  });
});

describe("el funeral escrito con tus palabras", () => {
  it("llega al motor COMO funeral, no como día normal", () => {
    // El agujero que abrió quitarle el chip: el campo libre manda
    // `objective: "diario"`, así que "un funeral" se armaba como un martes
    // cualquiera y la regla del catálogo —EL COLOR ES NEGRO, el azul marino
    // NO— no la alcanzaba ninguna ruta de código. Sigue SIN paso de detalle
    // (eso se acordó), pero hereda la formalidad del catálogo.
    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} />);
    return (async () => {
      await u.type(
        screen.getByPlaceholderText(/escríbelo o díctalo/i),
        "un funeral el jueves"
      );
      await siguiente(u);
      // Del plan pasa directo a "cuándo": el texto libre no abre detalle.
      expect(await screen.findByText(/¿qué día\?/i)).toBeTruthy();
      await siguiente(u);
      await u.click(await screen.findByRole("button", { name: /prefiero decirte yo/i }));
      await u.click(await screen.findByRole("button", { name: /templado/i }));
      await u.click(screen.getByRole("button", { name: /armar mi look/i }));

      await waitFor(() => expect(onPick).toHaveBeenCalled());
      const input = onPick.mock.calls[0][0] as LookInput;
      expect(input.objective).toBe("evento");
      expect(input.tipoEvento).toBe("funeral");
      expect(input.formality).toBe("formal");
      // Y el texto sigue viajando tal cual, que es la promesa del campo.
      expect(input.plan).toBe("un funeral el jueves");
    })();
  });

  it("un plan cualquiera sigue siendo día normal y viaja tal cual", async () => {
    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} />);
    await u.type(
      screen.getByPlaceholderText(/escríbelo o díctalo/i),
      "concierto en la noche"
    );
    await siguiente(u);
    await siguiente(u);
    await u.click(await screen.findByRole("button", { name: /prefiero decirte yo/i }));
    await u.click(await screen.findByRole("button", { name: /templado/i }));
    await u.click(screen.getByRole("button", { name: /armar mi look/i }));

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const input = onPick.mock.calls[0][0] as LookInput;
    expect(input.objective).toBe("diario");
    expect(input.tipoEvento).toBeNull();
    expect(input.plan).toBe("concierto en la noche");
  });
});

describe("cambiar de día NO deja pegada la lluvia del día anterior", () => {
  it("un pronóstico nuevo manda sobre la lluvia, el techo y la banda", async () => {
    // El camino que lo rompía, con el botón atrás del propio wizard: resuelvo
    // un día con lluvia → contesto "techado" → atrás → cambio la fecha a un día
    // despejado. El banner decía despejado pero `rain` seguía prendido, se
    // seguía preguntando por el techo y al motor le viajaba la banda VIEJA
    // marcada como techada. Un pronóstico nuevo manda sobre lo que él mismo
    // pre-llenó.
    const { getWeather } = await import("@/lib/weather");
    vi.mocked(getWeather).mockResolvedValue({ temp_c: 19, condition: "lluvia" });
    stubNavigator({
      permissions: { query: async () => ({ state: "granted" }) },
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 18.9, longitude: -99.2 } } as GeolocationPosition),
      },
    });

    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await siguiente(u);

    // Día lluvioso: contesto que estaré bajo techo.
    await u.click(await screen.findByRole("button", { name: /^techado$/i }));

    // Atrás y cambio la fecha: el nuevo día está despejado y más caluroso.
    // OJO: una fecha futura se lee con getWeatherForDates, no con getWeather.
    const { getWeatherForDates } = await import("@/lib/weather");
    vi.mocked(getWeatherForDates).mockResolvedValue({ temp_c: 31, condition: "despejado" });
    await u.click(screen.getByRole("button", { name: /atrás/i }));
    await u.click(await screen.findByRole("button", { name: /^mañana$/i }));
    await siguiente(u);

    // Ya no se pregunta por una lluvia que no existe.
    await waitFor(() => expect(screen.queryByText(/¿la lluvia te toca\?/i)).toBeNull());

    await u.click(screen.getByRole("button", { name: /armar mi look/i }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const input = onPick.mock.calls[0][0] as LookInput;
    expect("techado" in input).toBe(false);
    expect("weather" in input && input.weather.condition).toBe("despejado");
    expect("weather" in input && input.weather.temp_c).toBe(31);
  });

  it("si el pronóstico nuevo NO se puede leer, tampoco queda la lluvia vieja", async () => {
    // El caso que descubrió este test al fallar: una fecha futura se lee con
    // otra función, y si esa devuelve null (sin red, fuera del horizonte) el
    // `if (!w) return` de resolverClima dejaba intacto todo lo del día anterior
    // — y viajaba un "techado" contestado sobre la lluvia de otro día.
    const { getWeather, getWeatherForDates } = await import("@/lib/weather");
    vi.mocked(getWeather).mockResolvedValue({ temp_c: 19, condition: "lluvia" });
    vi.mocked(getWeatherForDates).mockResolvedValue(null);
    stubNavigator({
      permissions: { query: async () => ({ state: "granted" }) },
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 18.9, longitude: -99.2 } } as GeolocationPosition),
      },
    });

    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} />);
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await siguiente(u);
    await u.click(await screen.findByRole("button", { name: /^techado$/i }));

    await u.click(screen.getByRole("button", { name: /atrás/i }));
    await u.click(await screen.findByRole("button", { name: /^mañana$/i }));
    await siguiente(u);

    // Sin pronóstico se vuelve a preguntar desde cero, no se hereda nada.
    await waitFor(() => expect(screen.queryByText(/¿la lluvia te toca\?/i)).toBeNull());
    await u.click(await screen.findByRole("button", { name: /prefiero decirte yo/i }));
    // La banda tampoco se hereda: hay que volver a elegirla.
    await u.click(await screen.findByRole("button", { name: /cálido/i }));
    await u.click(screen.getByRole("button", { name: /armar mi look/i }));

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const input = onPick.mock.calls[0][0] as LookInput;
    expect("techado" in input).toBe(false);
    expect("weather" in input && input.weather.condition).toBe("despejado");
  });
});

describe("paso 2 — la boda de playa", () => {
  it("la boda ofrece 'guayabera o lino' además de los cuatro niveles", async () => {
    const u = userEvent.setup();
    render(<LookRequest {...props} gender="hombre" />);
    await u.click(screen.getByRole("button", { name: /una boda/i }));
    await siguiente(u);

    expect(await screen.findByText(/guayabera o lino/i)).toBeTruthy();
    expect(screen.getByText(/traje y corbata/i)).toBeTruthy();
    expect(screen.getByText(/esmoquin/i)).toBeTruthy();
  });

  it("elegirla la manda al motor como formalidad 'playa'", async () => {
    const onPick = vi.fn();
    const u = userEvent.setup();
    render(<LookRequest {...props} onPick={onPick} gender="hombre" />);
    await u.click(screen.getByRole("button", { name: /una boda/i }));
    await siguiente(u);
    await u.click(await screen.findByText(/guayabera o lino/i));
    await siguiente(u);
    await siguiente(u);
    await u.click(await screen.findByRole("button", { name: /prefiero decirte yo/i }));
    await u.click(await screen.findByRole("button", { name: /cálido/i }));
    await u.click(screen.getByRole("button", { name: /armar mi look/i }));

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const input = onPick.mock.calls[0][0] as LookInput;
    expect(input.formality).toBe("playa");
    expect(input.tipoEvento).toBe("boda");
  });
});

describe("el ancla que llega precargada desde el clóset", () => {
  // LA CONVERGENCIA, BLINDADA. La ficha de una prenda manda a
  // /hoy?generar=…&prenda=<id> y el wizard abre con esa prenda ya fijada. No es
  // un flujo nuevo: es la MISMA pregunta del paso 1 ("¿algo que te quieras
  // poner?"), sólo que contestada antes de entrar.
  //
  // El contrato tiene dos mitades y las dos se prueban aquí: que la prenda SE
  // VEA elegida (si no, la persona vuelve a elegir lo que ya eligió) y que
  // VIAJE al motor (si no, el look se arma sin ella y el botón mintió).
  const closet: ClosetPick[] = [
    { id: "abc", nombre: "Blazer marino", imagen: null, swatch: "#1F2A44", category: "saco" },
    { id: "xyz", nombre: "Jeans rectos", imagen: null, swatch: "#3B5A80", category: "bottom" },
    { id: "p2", nombre: "Pantalón de vestir", imagen: null, swatch: "#1A1A1A", category: "bottom" },
    { id: "t1", nombre: "Camisa blanca", imagen: null, swatch: "#F2F2F2", category: "top" },
  ];

  it("se ve fijada, sin volver a preguntar", () => {
    render(<LookRequest {...props} closet={closet} defaultSeedItemIds={["abc"]} />);
    expect(screen.getByText(/vas a usar/i)).toBeTruthy();
    expect(screen.getByText("Blazer marino")).toBeTruthy();
    expect(screen.queryByText(/¿algo que te quieras poner\?/i)).toBeNull();
  });

  it("y viaja al motor como seedItemId", async () => {
    const onPick = vi.fn();
    const u = userEvent.setup();
    render(
      <LookRequest {...props} onPick={onPick} closet={closet} defaultSeedItemIds={["abc"]} />
    );
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await siguiente(u);
    await u.click(await screen.findByRole("button", { name: /prefiero decirte yo/i }));
    await u.click(await screen.findByRole("button", { name: /cálido/i }));
    await u.click(screen.getByRole("button", { name: /armar mi look/i }));

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect((onPick.mock.calls[0][0] as LookInput).seedItemIds).toEqual(["abc"]);
  });

  it("se pueden fijar VARIAS: elegir no cierra la hoja", async () => {
    // Con una sola prenda, elegir ERA terminar. Con varias, cerrarse en la
    // primera obligaría a reabrir la hoja por cada una — el mismo error que ya
    // corregimos en "+ más" de la ficha del clóset.
    const u = userEvent.setup();
    render(<LookRequest {...props} closet={closet} defaultSeedItemIds={["abc"]} />);
    await u.click(screen.getByRole("button", { name: /agregar otra/i }));
    await u.click(screen.getByRole("button", { name: /jeans rectos/i }));
    // La hoja sigue abierta (su buscador continúa en pantalla) y ya hay dos.
    expect(screen.getByPlaceholderText(/busca una prenda/i)).toBeTruthy();
    expect(screen.getAllByText(/vas a usar/i)).toHaveLength(2);
  });

  it("las dos viajan al motor", async () => {
    const onPick = vi.fn();
    const u = userEvent.setup();
    render(
      <LookRequest
        {...props}
        onPick={onPick}
        closet={closet}
        defaultSeedItemIds={["abc", "xyz"]}
      />
    );
    await u.click(screen.getByRole("button", { name: /un día normal/i }));
    await siguiente(u);
    await siguiente(u);
    await u.click(await screen.findByRole("button", { name: /prefiero decirte yo/i }));
    await u.click(await screen.findByRole("button", { name: /cálido/i }));
    await u.click(screen.getByRole("button", { name: /armar mi look/i }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect((onPick.mock.calls[0][0] as LookInput).seedItemIds).toEqual(["abc", "xyz"]);
  });

  it("dos pantalones no se pueden, Y SE DICE POR QUÉ", async () => {
    // ESTE TEST NACE DE UN BUG QUE LA SUITE NO VIO Y EL NAVEGADOR SÍ: el motivo
    // del bloqueo se calculaba, se guardaba en estado… y no se pintaba nunca.
    // El resultado era un botón que no responde y no explica — que no se lee
    // como una regla, se lee como que la app está rota.
    const u = userEvent.setup();
    render(<LookRequest {...props} closet={closet} defaultSeedItemIds={["xyz"]} />);
    await u.click(screen.getByRole("button", { name: /agregar otra/i }));
    await u.click(screen.getByRole("button", { name: /pantalón de vestir/i }));
    expect(screen.getByText(/ya elegiste un pantalón/i)).toBeTruthy();
    // Y no se sumó: sigue habiendo una sola.
    expect(screen.getAllByText(/vas a usar/i)).toHaveLength(1);
  });

  it("pero DOS TOPS sí: camisa + suéter es un look en capas", async () => {
    const u = userEvent.setup();
    render(<LookRequest {...props} closet={closet} defaultSeedItemIds={["abc"]} />);
    await u.click(screen.getByRole("button", { name: /agregar otra/i }));
    await u.click(screen.getByRole("button", { name: /camisa blanca/i }));
    expect(screen.queryByText(/ya elegiste/i)).toBeNull();
    expect(screen.getAllByText(/vas a usar/i)).toHaveLength(2);
  });

  it("cada ancla se quita sin abrir la hoja", async () => {
    const u = userEvent.setup();
    render(<LookRequest {...props} closet={closet} defaultSeedItemIds={["abc", "xyz"]} />);
    await u.click(screen.getByRole("button", { name: /quitar blazer marino/i }));
    expect(screen.getAllByText(/vas a usar/i)).toHaveLength(1);
    expect(screen.queryByText("Blazer marino")).toBeNull();
  });

  it("una prenda que no es tuya no fija nada", () => {
    // El id viene de la URL y cualquiera puede escribir ahí. El wizard lo busca
    // en TU clóset: si no está, no enseña nada y la pregunta vuelve a su estado
    // normal. (El motor además re-verifica dueño antes de anclar.)
    render(<LookRequest {...props} closet={closet} defaultSeedItemIds={["de-alguien-mas"]} />);
    expect(screen.queryByText(/vas a usar/i)).toBeNull();
    expect(screen.getByText(/¿algo que te quieras poner\?/i)).toBeTruthy();
  });
});
