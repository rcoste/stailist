import { describe, it, expect } from "vitest";
import { loadUltimoLook } from "./ultimo-look";

// Lo que este test blinda: la card de zona 1 del home es el ÚNICO acceso a lo
// último que el motor armó (el CTA "ver mi look" y los chips de planeados
// murieron con el rediseño 2026-08-11). Todos sus modos de fallo son MUDOS: no
// truenan nada, solo dejan la card sin imagen, con las prendas en desorden o
// enseñando un look del fit check como si fuera una propuesta.
//
// El Supabase de mentira solo recuerda a quién le preguntaron y devuelve lo que
// se le dijo: aquí no se prueba la base, se prueba QUÉ card sale del dato.

type Fila = Record<string, unknown>;

function supabaseFalso(opts: {
  outfits?: Fila[];
  items?: Fila[];
  /** path → URL firmada. Un path ausente simula una firma que no salió. */
  firmadas?: Record<string, string>;
}) {
  const tablas: string[] = [];
  const idsPedidos: string[][] = [];
  const pathsFirmados: string[][] = [];
  /** Los filtros que se le pusieron a la consulta de outfits, como texto. */
  const filtros: string[] = [];

  const consulta = (tabla: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "neq", "or", "order", "limit"]) {
      chain[m] = (...args: unknown[]) => {
        if (tabla === "outfits") {
          const a = args
            .map((v) => (typeof v === "object" && v ? JSON.stringify(v) : String(v)))
            .join(",");
          filtros.push(`${m}(${a})`);
        }
        return chain;
      };
    }
    chain.in = (_col: string, ids: string[]) => {
      idsPedidos.push(ids);
      return chain;
    };
    chain.then = (resolve: (r: { data: Fila[] }) => unknown) =>
      Promise.resolve(
        resolve({ data: (tabla === "outfits" ? opts.outfits : opts.items) ?? [] })
      );
    return chain;
  };

  return {
    cliente: {
      from: (tabla: string) => {
        tablas.push(tabla);
        return consulta(tabla);
      },
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => {
            pathsFirmados.push(paths);
            return {
              data: paths.map((p) => ({
                path: p,
                signedUrl: opts.firmadas?.[p] ?? null,
              })),
            };
          },
        }),
      },
    } as never,
    tablas,
    idsPedidos,
    pathsFirmados,
    filtros,
  };
}

const look = (f: Fila = {}): Fila => ({
  id: "look-1",
  title: "Sastre Suelto de Noche",
  occasion: "evento",
  planned_for: null,
  look_date: null,
  created_at: "2026-08-11T15:00:00Z",
  tryon_path: null,
  item_ids: null,
  ...f,
});

/** Prenda que resuelve por arquetipo (ruta pública, no hay que firmarla). */
const prendaArq = (id: string) => ({
  id,
  photo_path: null,
  render_status: null,
  render_path: null,
  attrs: null,
  archetypes: { image_path: `/arq/${id}.png` },
});

describe("loadUltimoLook", () => {
  it("sin looks generados no hay card", async () => {
    const { cliente } = supabaseFalso({ outfits: [] });
    expect(await loadUltimoLook(cliente, "u1")).toBeNull();
  });

  it("con try-on va el RETRATO y ni siquiera se leen las prendas", async () => {
    // La variante la decide el dato: con avatar vestido no hay tira que armar,
    // y cargar prendas que nadie va a ver es una consulta regalada.
    const fake = supabaseFalso({
      outfits: [look({ tryon_path: "u1/tryon.png", item_ids: ["a", "b"] })],
      firmadas: { "u1/tryon.png": "https://firmada/tryon.png" },
    });
    const card = await loadUltimoLook(fake.cliente, "u1");
    expect(card?.retrato).toBe("https://firmada/tryon.png");
    expect(card?.prendas).toEqual([]);
    expect(fake.tablas).toEqual(["outfits"]);
  });

  it("si el try-on no se puede firmar, cae a la tira — la card no se queda sin imagen", async () => {
    const fake = supabaseFalso({
      outfits: [look({ tryon_path: "u1/tryon.png", item_ids: ["a"] })],
      items: [prendaArq("a")],
      firmadas: {}, // la firma no salió
    });
    const card = await loadUltimoLook(fake.cliente, "u1");
    expect(card?.retrato).toBeNull();
    expect(card?.prendas).toEqual(["/arq/a.png"]);
  });

  it("la tira sigue el orden de item_ids, corta a 5 y no deja huecos", async () => {
    // Tres cosas que fallan mudas: item_ids es el orden del motor (top→bottom) y
    // la consulta devuelve lo que se le antoja; a 390px más de 5 tiles son
    // confeti; y una prenda sin ninguna imagen tiene que DESAPARECER, no dejar
    // un cuadro vacío.
    const fake = supabaseFalso({
      outfits: [look({ item_ids: ["a", "b", "c", "d", "e", "f"] })],
      // La base devuelve al revés y con "c" sin imagen de ningún tipo.
      items: [
        prendaArq("e"),
        prendaArq("d"),
        {
          id: "c",
          photo_path: null,
          render_status: null,
          render_path: null,
          attrs: null,
          archetypes: null,
        },
        // "b" es una foto propia: ruta privada que hay que FIRMAR. Va mezclada
        // a propósito — es la mitad del clóset y si se cayera la firma, la card
        // enseñaría huecos solo a quien sube sus fotos.
        {
          id: "b",
          photo_path: "u1/b.jpg",
          render_status: null,
          render_path: null,
          attrs: null,
          archetypes: null,
        },
        prendaArq("a"),
      ],
      firmadas: { "u1/b.jpg": "https://firmada/b.jpg" },
    });
    const card = await loadUltimoLook(fake.cliente, "u1");
    expect(card?.prendas).toEqual([
      "/arq/a.png",
      "https://firmada/b.jpg",
      "/arq/d.png",
      "/arq/e.png",
    ]);
    // "f" es el sexto: ni se pidió a la base.
    expect(fake.idsPedidos[0]).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("pide SOLO looks propuestos: ni fit checks, ni borrados, ni a medio generar", async () => {
    // Los cuatro filtros de esta consulta son decisiones de producto, y quitar
    // cualquiera falla en silencio (la card sale, solo que con el look
    // equivocado):
    // · source = SOLO `daily`. Lista blanca, no `neq(espejo)`: viaje y cápsula
    //   crean filas fantasma que solo cachean un try-on (favorited_at null, a
    //   propósito fuera del Historial) y con un `neq` se colaban de titular
    //   del home. Lo cazó el review adversarial del ship.
    // · deleted_at = un look borrado no puede volver por la puerta de atrás;
    // · gen_status = uno a medio generar se vería vacío;
    // · created_at desc + limit 1 = "el ÚLTIMO", que es todo el punto.
    const fake = supabaseFalso({ outfits: [look()] });
    await loadUltimoLook(fake.cliente, "u1");
    const filtros = fake.filtros.join(" | ");
    expect(filtros).toContain("eq(user_id,u1)");
    expect(filtros).toContain("eq(source,daily)");
    expect(filtros).not.toContain("neq(source,espejo)");
    expect(filtros).toContain("is(deleted_at,null)");
    expect(filtros).toContain("gen_status.is.null,gen_status.eq.ready");
    expect(filtros).toContain('order(created_at,{"ascending":false})');
    expect(filtros).toContain("limit(1)");
  });

  it("sin item_ids la card existe igual, solo con texto", async () => {
    // Un look sin prendas resueltas NO puede devolver null: la card es el único
    // acceso a lo último generado, y sin ella el home lo esconde para siempre.
    const fake = supabaseFalso({ outfits: [look({ item_ids: null })] });
    const card = await loadUltimoLook(fake.cliente, "u1");
    expect(card).not.toBeNull();
    expect(card?.retrato).toBeNull();
    expect(card?.prendas).toEqual([]);
    expect(fake.tablas).toEqual(["outfits"]);
  });

  it("rellena nombre y ocasión, y planned_for gana a look_date", async () => {
    const sinDatos = supabaseFalso({
      outfits: [look({ title: null, occasion: null })],
    });
    const card = await loadUltimoLook(sinDatos.cliente, "u1");
    expect(card?.nombre).toBe("tu look");
    expect(card?.ocasion).toBe("diario");
    expect(card?.fecha).toBeNull();

    // Un look planeado manda su día; si no, el look_date recortado a YYYY-MM-DD
    // (llega con hora y la card lo compara contra una fecha pura).
    const planeado = supabaseFalso({
      outfits: [
        look({ planned_for: "2026-08-15", look_date: "2026-08-11T00:00:00Z" }),
      ],
    });
    expect((await loadUltimoLook(planeado.cliente, "u1"))?.fecha).toBe("2026-08-15");

    const delDia = supabaseFalso({
      outfits: [look({ look_date: "2026-08-11T00:00:00Z" })],
    });
    expect((await loadUltimoLook(delDia.cliente, "u1"))?.fecha).toBe("2026-08-11");
  });
});
