import { describe, expect, it } from "vitest";
import {
  MINUTOS_EN_CURSO,
  construirEmbudo,
  duracion,
  pasoDeEvento,
  type EventoPaso,
  type PersonaEmbudo,
} from "./embudo";

// LO QUE BLINDAN: que el embudo no mienta sobre dónde se va la gente. Las tres
// reglas de lib/admin/embudo.ts (llegar es monótono, "se quedó" contra "en
// curso", volver no se cuenta como pérdida mientras la semana sigue abierta).

const AHORA = new Date("2026-10-20T18:00:00Z");
const ev = (type: string, at: string, data: Record<string, unknown> | null = null): EventoPaso => ({
  type,
  data,
  at,
});
const persona = (id: string, eventos: EventoPaso[], extra: Partial<PersonaEmbudo> = {}): PersonaEmbudo => ({
  id,
  etiqueta: id,
  eventos,
  primeraFoto: null,
  volvio: null,
  ultimaActividad: eventos.at(-1)?.at ?? "2026-10-01T00:00:00Z",
  ...extra,
});
const fila = (filas: ReturnType<typeof construirEmbudo>, id: string) => filas.find((f) => f.id === id)!;

describe("pasoDeEvento", () => {
  it("el step 3 es la lista de básicos sin `paso`, y el correo con `paso: correo`", () => {
    expect(pasoDeEvento(ev("onboarding_step", "x", { step: 3, items: 32 }))).toBe("prendas");
    expect(pasoDeEvento(ev("onboarding_step", "x", { step: 3, paso: "correo" }))).toBe("correo");
  });
  it("las pantallas nuevas se leen por `paso`", () => {
    expect(pasoDeEvento(ev("onboarding_step", "x", { paso: "genero", step: 0 }))).toBe("genero");
    expect(pasoDeEvento(ev("onboarding_started", "x"))).toBe("inicio");
    expect(pasoDeEvento(ev("first_outfit_ttv", "x", { seconds: 500 }))).toBe("primer_look");
  });
  it("lo que no es un paso no cuenta", () => {
    expect(pasoDeEvento(ev("hint_seen", "x"))).toBeNull();
    expect(pasoDeEvento(ev("onboarding_step", "x", { paso: "otra-cosa" }))).toBeNull();
  });
});

describe("construirEmbudo", () => {
  it("llegar es monótono: un paso sin registro cuenta si llegó a uno posterior", () => {
    // Cuenta vieja: sin "cómo nos conoció" (no existía) pero llegó a los swipes.
    const p = persona("vieja", [
      ev("onboarding_started", "2026-09-01T10:00:00Z"),
      ev("onboarding_step", "2026-09-01T10:00:05Z", { paso: "genero" }),
      ev("onboarding_step", "2026-09-01T10:00:10Z", { paso: "edad" }),
      ev("onboarding_step", "2026-09-01T10:01:00Z", { step: 1 }),
    ]);
    const f = construirEmbudo([p], AHORA);
    expect(fila(f, "conocio").llegaron).toBe(1);
    expect(fila(f, "swipes").llegaron).toBe(1);
    expect(fila(f, "colorimetria").llegaron).toBe(0);
  });

  it("se quedó vs en curso, en la pantalla SIGUIENTE a la última que terminó", () => {
    const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString();
    const quieta = persona("quieta", [ev("onboarding_started", hace(120)), ev("onboarding_step", hace(119), { paso: "genero" })]);
    const activa = persona("activa", [
      ev("onboarding_started", hace(10)),
      ev("onboarding_step", hace(MINUTOS_EN_CURSO - 25), { paso: "genero" }),
    ]);
    const f = construirEmbudo([quieta, activa], AHORA);
    // Contestaron género y no edad: se quedaron en la pantalla de edad.
    expect(fila(f, "edad").seQuedaron.map((x) => x.id)).toEqual(["quieta"]);
    expect(fila(f, "edad").enCurso).toBe(1);
    expect(fila(f, "genero").seQuedaron).toEqual([]);
  });

  it("la mediana de tiempo es desde el paso anterior", () => {
    const p = (id: string, seg: number) =>
      persona(id, [
        ev("onboarding_started", "2026-10-01T10:00:00Z"),
        ev("onboarding_step", new Date(Date.parse("2026-10-01T10:00:00Z") + seg * 1000).toISOString(), {
          paso: "genero",
        }),
      ]);
    const f = construirEmbudo([p("a", 4), p("b", 6), p("c", 100)], AHORA);
    expect(fila(f, "genero").medianaSeg).toBe(6);
  });

  it("después del primer look, no volver dentro de la semana no es quedarse", () => {
    const pasos = (inicio: string) => [
      ev("onboarding_started", inicio),
      ev("first_outfit_ttv", new Date(Date.parse(inicio) + 500_000).toISOString(), { seconds: 500 }),
    ];
    const reciente = persona("reciente", pasos("2026-10-18T10:00:00Z"));
    const vieja = persona("vieja", pasos("2026-10-01T10:00:00Z"));
    const f = construirEmbudo([reciente, vieja], AHORA);
    // Tuvo su primer look y no subió foto: se quedó en "subió una foto".
    expect(fila(f, "foto").seQuedaron.map((x) => x.id)).toEqual(["vieja"]);
    expect(fila(f, "volvio").aunPueden).toBe(1);
  });

  it("la foto sólo cuenta si fue después del primer look, y volver cierra el embudo", () => {
    const p = persona(
      "completa",
      [ev("onboarding_started", "2026-10-01T10:00:00Z"), ev("first_outfit_ttv", "2026-10-01T10:08:00Z")],
      { primeraFoto: "2026-10-01T10:20:00Z", volvio: "2026-10-03T15:00:00Z" }
    );
    const antes = persona(
      "foto-antes",
      [ev("onboarding_started", "2026-10-01T10:00:00Z"), ev("first_outfit_ttv", "2026-10-01T10:08:00Z")],
      { primeraFoto: "2026-10-01T10:05:00Z" }
    );
    const f = construirEmbudo([p, antes], AHORA);
    expect(fila(f, "foto").llegaron).toBe(1);
    expect(fila(f, "volvio").llegaron).toBe(1);
    expect(f.flatMap((x) => x.seQuedaron).map((x) => x.id)).toEqual(["foto-antes"]);
  });
});

describe("duracion", () => {
  it("se lee como tiempo", () => {
    expect(duracion(8)).toBe("8s");
    expect(duracion(84)).toBe("1m 24s");
    expect(duracion(3900)).toBe("1h 5m");
    expect(duracion(null)).toBe("—");
  });
});
