import { describe, it, expect } from "vitest";
import {
  colapsar,
  construirFeed,
  etiqueta,
  porDia,
  EVENTOS_FUERA,
  type FuentesCrudas,
  type Momento,
} from "./actividad";

// LO QUE BLINDAN ESTOS TESTS no es que un array se ordene: es que el feed no
// mienta sobre lo que hizo la gente. Los dos hallazgos que le dieron forma
// están medidos contra producción (2026-09-01) y son justo lo que se rompería
// si alguien "simplifica" esto:
//   1. el 87% de las prendas entra en ráfagas de 6+ en un minuto → sin
//      colapsar, mil líneas de "añadió una prenda" tapan todo lo demás;
//   2. el 76% de `events` es instrumentación → sin filtrar, el feed enseña
//      jueces y timings en vez de acciones.

const m = (userId: string, at: string, tipo: Momento["tipo"], key = `${userId}${at}${tipo}`): Momento => ({
  key,
  userId,
  at,
  tipo,
  n: 1,
  refId: key,
  data: null,
});

describe("colapsar", () => {
  it("junta la ráfaga de un carrete en UNA línea", () => {
    // El caso real: 23 prendas en el mismo minuto (13 tandas así en prod).
    const raf = Array.from({ length: 23 }, (_, i) =>
      m("andy", `2026-08-10T14:0${i % 2}:00Z`, "prenda_add", `p${i}`)
    );
    const out = colapsar(raf);
    expect(out).toHaveLength(1);
    expect(out[0].n).toBe(23);
  });

  it("NO junta a dos personas distintas", () => {
    // Si esto se rompiera, el feed diría "añadió 2 prendas" sobre gente que ni
    // se conoce — y el feed existe justamente para saber QUIÉN.
    const out = colapsar([
      m("andy", "2026-08-10T14:00:00Z", "prenda_add"),
      m("islam", "2026-08-10T14:00:30Z", "prenda_add"),
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((x) => x.n === 1)).toBe(true);
  });

  it("NO junta acciones de tipo distinto aunque sean del mismo minuto", () => {
    // Subir una prenda y generar un look son dos hechos; fundirlos borra el
    // único dato interesante (que hizo las dos cosas seguidas).
    const out = colapsar([
      m("andy", "2026-08-10T14:00:00Z", "prenda_add"),
      m("andy", "2026-08-10T14:00:20Z", "look"),
    ]);
    expect(out.map((x) => x.tipo)).toEqual(["look", "prenda_add"]);
  });

  it("dos sesiones separadas siguen siendo dos momentos", () => {
    // Mismo usuario, mismo tipo, pero con horas de por medio: son dos visitas
    // y el feed tiene que poder enseñar las dos.
    const out = colapsar([
      m("andy", "2026-08-10T09:00:00Z", "prenda_add"),
      m("andy", "2026-08-10T18:00:00Z", "prenda_add"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("la ráfaga suelta el refId; la línea sola lo conserva", () => {
    // Una ráfaga no puede enlazar a UN objeto —son varios— y dejar el del
    // primero mandaría a Roberto a una prenda al azar de las 23.
    const raf = colapsar([
      m("andy", "2026-08-10T14:00:00Z", "prenda_add", "p1"),
      m("andy", "2026-08-10T14:01:00Z", "prenda_add", "p2"),
    ]);
    expect(raf[0].refId).toBeNull();
    const sola = colapsar([m("andy", "2026-08-10T14:00:00Z", "look", "o1")]);
    expect(sola[0].refId).toBe("o1");
  });

  it("ordena del más reciente al más viejo", () => {
    const out = colapsar([
      m("a", "2026-08-01T10:00:00Z", "look"),
      m("a", "2026-08-31T10:00:00Z", "viaje"),
      m("a", "2026-08-15T10:00:00Z", "alta"),
    ]);
    expect(out.map((x) => x.at.slice(0, 10))).toEqual([
      "2026-08-31",
      "2026-08-15",
      "2026-08-01",
    ]);
  });
});

describe("construirFeed", () => {
  const base: FuentesCrudas = {
    profiles: [],
    items: [],
    outfits: [],
    trips: [],
    wishlist: [],
    events: [],
  };

  it("cruza las fuentes: la acción más común del producto NO vive en events", () => {
    // 1012 prendas en `items` y CERO eventos: un feed hecho solo de `events`
    // escondería lo único que la gente hace de verdad. Este test es el que
    // impide volver a `select * from events`.
    const feed = construirFeed({
      ...base,
      items: [{ id: "i1", user_id: "andy", created_at: "2026-08-10T14:00:00Z", deleted_at: null }],
      outfits: [{ id: "o1", user_id: "andy", created_at: "2026-08-10T15:00:00Z", deleted_at: null }],
      trips: [{ id: "t1", user_id: "andy", created_at: "2026-08-10T16:00:00Z", deleted_at: null }],
      profiles: [{ id: "andy", created_at: "2026-08-01T09:00:00Z" }],
    });
    expect(feed.map((x) => x.tipo)).toEqual(["viaje", "look", "prenda_add", "alta"]);
  });

  it("tira la instrumentación y deja las acciones", () => {
    const feed = construirFeed({
      ...base,
      events: [
        { user_id: "a", outfit_id: null, type: "critic_review", data: null, created_at: "2026-08-10T10:00:00Z" },
        { user_id: "a", outfit_id: null, type: "generation_timing", data: null, created_at: "2026-08-10T10:00:01Z" },
        { user_id: "a", outfit_id: null, type: "hint_seen", data: null, created_at: "2026-08-10T10:00:02Z" },
        { user_id: "a", outfit_id: "o9", type: "worn", data: null, created_at: "2026-08-10T10:00:03Z" },
      ],
    });
    expect(feed).toHaveLength(1);
    expect(feed[0].tipo).toBe("ev:worn");
    expect(feed[0].refId).toBe("o9");
  });

  it("un evento NUEVO entra solo al feed en vez de quedarse invisible", () => {
    // La lista es de EXCLUSIÓN a propósito: con una de inclusión, cada evento
    // que alguien agregue al producto queda fuera del radar hasta que se
    // acuerde de darlo de alta aquí. Sale con su nombre crudo, que es la señal
    // de que le falta etiqueta.
    const feed = construirFeed({
      ...base,
      events: [
        { user_id: "a", outfit_id: null, type: "fit_check_nuevo", data: null, created_at: "2026-08-10T10:00:00Z" },
      ],
    });
    expect(feed).toHaveLength(1);
    expect(etiqueta(feed[0])).toBe("fit_check_nuevo");
    expect(EVENTOS_FUERA.has("fit_check_nuevo")).toBe(false);
  });

  it("un borrado NO sale dos veces (tabla y evento a la vez)", () => {
    // Medido en prod: 21 prendas con `deleted_at` contra 10 eventos
    // `item_deleted`. Con las dos fuentes dentro, los 10 que sí escribieron
    // evento salían DOS VECES en el feed —son `tipo` distinto, así que el
    // colapso no los junta— y los otros 11 salían una. El ciclo de vida lo
    // cuenta la tabla; `events` sólo cuenta lo que no deja fila.
    const feed = construirFeed({
      ...base,
      items: [
        { id: "i1", user_id: "a", created_at: "2026-08-01T10:00:00Z", deleted_at: "2026-08-20T14:00:00Z" },
      ],
      events: [
        { user_id: "a", outfit_id: null, type: "item_deleted", data: null, created_at: "2026-08-20T14:00:01Z" },
      ],
    });
    expect(feed.filter((x) => x.tipo === "prenda_del")).toHaveLength(1);
    expect(feed.some((x) => x.tipo === "ev:item_deleted")).toBe(false);
  });

  it("una prenda borrada aporta DOS momentos, no cero", () => {
    // El feed cuenta lo que PASÓ, no lo que queda. Filtrando por deleted_at
    // null, borrar 20 prendas borraría del historial también el día en que las
    // subió — y ese día es justo el que se quiere poder mirar.
    const feed = construirFeed({
      ...base,
      items: [
        {
          id: "i1",
          user_id: "andy",
          created_at: "2026-08-10T14:00:00Z",
          deleted_at: "2026-08-20T14:00:00Z",
        },
      ],
    });
    expect(feed.map((x) => x.tipo)).toEqual(["prenda_del", "prenda_add"]);
  });
});

describe("etiqueta", () => {
  it("pluraliza según la ráfaga", () => {
    const uno = { ...m("a", "2026-08-10T14:00:00Z", "prenda_add"), n: 1 };
    const varios = { ...uno, n: 23 };
    expect(etiqueta(uno)).toBe("añadió una prenda");
    expect(etiqueta(varios)).toBe("añadió 23 prendas");
  });

  it("los eventos conocidos llevan nombre humano", () => {
    expect(etiqueta({ ...m("a", "2026-08-10T14:00:00Z", "ev:worn"), n: 1 })).toBe(
      "se puso un look"
    );
    expect(etiqueta({ ...m("a", "2026-08-10T14:00:00Z", "ev:vote_up"), n: 3 })).toBe(
      "votó 👍 un look ×3"
    );
  });
});

describe("porDia", () => {
  it("agrupa por día conservando el orden", () => {
    const feed = colapsar([
      m("a", "2026-08-31T22:00:00Z", "look"),
      m("a", "2026-08-31T09:00:00Z", "viaje"),
      m("b", "2026-08-30T09:00:00Z", "alta"),
    ]);
    const dias = porDia(feed);
    expect(dias.map((d) => d.dia)).toEqual(["2026-08-31", "2026-08-30"]);
    expect(dias[0].momentos).toHaveLength(2);
  });
});
