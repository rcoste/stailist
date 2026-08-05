import { createClient } from "@/lib/supabase/server";
import {
  ITEM_IMAGE_SELECT,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";

// Prendas que podrían estar registradas dos veces.
//
// DE DÓNDE SALE
// Midiendo por qué el motor usa siempre las mismas prendas apareció otra cosa:
// el clóset de Roberto tiene 5 filas de "Sandalia de cuero negra", idénticas en
// color, material y atributos. No es un problema del motor — es basura en los
// datos — y hace daño doble: le come espacio al prompt, y cuando el motor
// "elige una sandalia" está eligiendo entre cinco filas que son la misma cosa.
//
// PERO NO SE DECIDE SOLO, y esa es la regla de este archivo. Roberto avisó
// antes de que yo tocara nada: "tengo prendas que se parecen pero no son las
// mismas — puedo tener dos o tres grises que son diferentes, un cuello V y un
// crewneck". Tenía razón: sus tres "Pantalón negro" son de sintético, lana y
// algodón. Tres pantalones distintos con el mismo nombre.
//
// Así que esto NO fusiona nada: junta los candidatos, los ordena por qué tan
// idénticos son, y se los enseña para que él decida. Su ropa, su juicio.

/** Qué tan parecidas son dos filas, para ordenar los candidatos. */
export type Confianza = "idénticas" | "muy parecidas" | "distintas";

export type FilaDup = {
  id: string;
  url: string | null;
  nombre: string;
  hex: string | null;
  material: string | null;
  corte: string | null;
  manga: string | null;
  categoria: string | null;
  source: string | null;
  tieneFoto: boolean;
};

export type GrupoDup = {
  clave: string;
  nombre: string;
  confianza: Confianza;
  /** Por qué se clasificó así — se le enseña, no se le pide que confíe. */
  porque: string;
  filas: FilaDup[];
};

type Cruda = ItemImageRow & {
  id: string;
  source: string | null;
  attrs: Record<string, unknown> | null;
};

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Distancia entre dos hex, 0-441. La misma medida que usan las reglas de
 * ejecución: no es perceptualmente exacta pero separa "el mismo negro" de "dos
 * negros distintos", que es lo único que hace falta aquí.
 */
function dist(a: string | null, b: string | null): number | null {
  const p = (h: string | null) => {
    if (!h) return null;
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
  };
  const x = p(a);
  const y = p(b);
  if (!x || !y) return null;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/**
 * El veredicto de la máquina sobre un grupo — que es una SUGERENCIA.
 *
 * "idénticas" pide que TODO coincida: color casi exacto y ningún atributo que
 * las separe. Basta un material distinto para bajarlo a "distintas", porque ese
 * es justo el caso que Roberto señaló y el que más caro sale equivocar: fusionar
 * dos prendas reales le borra una del clóset.
 */
function clasificar(filas: FilaDup[]): { confianza: Confianza; porque: string } {
  const campos = ["material", "corte", "manga", "categoria"] as const;
  const difs: string[] = [];
  for (const c of campos) {
    const vals = new Set(filas.map((f) => f[c]).filter(Boolean));
    if (vals.size > 1) difs.push(`${c}: ${[...vals].join(" / ")}`);
  }
  const dists = filas
    .slice(1)
    .map((f) => dist(filas[0].hex, f.hex))
    .filter((d): d is number => d != null);
  const maxDist = dists.length ? Math.max(...dists) : 0;

  if (difs.length) {
    return {
      confianza: "distintas",
      porque: `Se diferencian en ${difs.join(" · ")}. Con el mismo nombre, pero no son la misma prenda.`,
    };
  }
  // 12 sobre 441: dos capturas de la MISMA prenda dan hex casi iguales; dos
  // prendas distintas del mismo color casi nunca caen tan cerca.
  if (maxDist <= 12) {
    return {
      confianza: "idénticas",
      porque: `Mismo color (a ${Math.round(maxDist)} de distancia) y ningún atributo que las separe.`,
    };
  }
  return {
    confianza: "muy parecidas",
    porque: `Mismos atributos pero el color no coincide del todo (${Math.round(maxDist)} de distancia). Míralas.`,
  };
}

/**
 * Los grupos de un usuario, ordenados por qué tan probable es que sobren.
 *
 * Se agrupa por NOMBRE dentro del mismo usuario. Nombres distintos jamás se
 * juntan: el nombre es lo único que el análisis de visión produce de forma
 * estable, y agrupar por color o categoría metería en el mismo saco prendas que
 * nadie confundiría.
 */
export async function duplicadosDe(userId: string): Promise<GrupoDup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(`id, source, attrs, ${ITEM_IMAGE_SELECT}`)
    .eq("user_id", userId)
    .is("deleted_at", null);

  const filas = (data ?? []) as unknown as Cruda[];

  const porNombre = new Map<string, Cruda[]>();
  for (const f of filas) {
    const nombre = txt(f.attrs?.nombre);
    if (!nombre) continue;
    // Ya revisado y declarado distinto: no se vuelve a preguntar.
    if (f.attrs?.dup_ok === true) continue;
    porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), f]);
  }

  const grupos = [...porNombre.entries()].filter(([, v]) => v.length > 1);
  if (!grupos.length) return [];

  // Todas las imágenes privadas firmadas de una vez.
  const aFirmar = [
    ...new Set(grupos.flatMap(([, v]) => v).flatMap((f) => itemPrivatePaths(f))),
  ];
  const firmadas = new Map<string, string>();
  if (aFirmar.length) {
    const { data: urls } = await supabase.storage
      .from("prendas")
      .createSignedUrls(aFirmar, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
  }

  const orden: Record<Confianza, number> = {
    idénticas: 0,
    "muy parecidas": 1,
    distintas: 2,
  };

  return grupos
    .map(([nombre, v]) => {
      const fs: FilaDup[] = v.map((f) => ({
        id: f.id,
        url: itemImageUrlSync(f, (p) => firmadas.get(p)),
        nombre,
        hex: txt(f.attrs?.color_hex),
        material: txt(f.attrs?.material),
        corte: txt(f.attrs?.corte),
        manga: txt(f.attrs?.manga),
        categoria: txt(f.attrs?.categoria),
        source: f.source,
        tieneFoto: !!f.photo_path,
      }));
      const { confianza, porque } = clasificar(fs);
      return { clave: nombre, nombre, confianza, porque, filas: fs };
    })
    .sort(
      (a, b) =>
        orden[a.confianza] - orden[b.confianza] || b.filas.length - a.filas.length
    );
}

/**
 * Cuál fila conservar al fusionar: la que más información trae.
 *
 * Foto propia primero (es la prenda de verdad, no un dibujo del catálogo),
 * después la que tenga más atributos rellenos. Fusionar quedándose con la más
 * pobre perdería el material y el corte que el análisis de visión ya sacó.
 */
export function cualConservar(filas: FilaDup[]): string {
  const puntos = (f: FilaDup) =>
    (f.tieneFoto ? 100 : 0) +
    [f.material, f.corte, f.manga, f.categoria, f.hex].filter(Boolean).length;
  return [...filas].sort((a, b) => puntos(b) - puntos(a))[0].id;
}
