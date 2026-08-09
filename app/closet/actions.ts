"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { borrowArchetypeImage } from "@/lib/capsule-data";
import {
  cleanPatron,
  cleanTextAttr,
  MAX_COLOR_LEN,
  MAX_MATERIAL_LEN,
  MAX_VISUAL_LEN,
} from "@/lib/prenda-atributos";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";
import {
  ITEM_IMAGE_SELECT,
  categoriaDeItem,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";
import type { PrendaExistente } from "@/lib/ya-la-tienes";
import { attrsDelPantalon } from "@/lib/pantalon-del-traje";
import { descripcionObsoleta } from "@/lib/garment-desc";

// Frontera de confianza LLM→DB: los campos de texto libre del análisis de
// visión se normalizan/validan server-side antes de persistir (las server
// actions son endpoints públicos para usuarios autenticados — un cliente
// manipulado no debe poder meter strings arbitrarios que luego entran a los
// prompts del motor). patron se valida contra el vocabulario cerrado.
// Vocabulario CERRADO: cualquier otra cosa se descarta (ausente = ropa de calle,
// que es el caso normal). Igual que patron, no se acepta texto libre — de aquí
// sale una decisión del match, no una etiqueta decorativa.
const CONTEXTOS_VALIDOS = ["bano", "dormir", "interior", "gym"] as const;
function cleanContexto(v: unknown): string | undefined {
  return typeof v === "string" &&
    (CONTEXTOS_VALIDOS as readonly string[]).includes(v)
    ? v
    : undefined;
}

// Vocabulario CERRADO de lo que se puede declarar confirmado: son los campos
// que el motor consulta para saber si un dato es de la persona o suposición
// nuestra. Un cliente manipulado no debe poder marcar "confirmado" cualquier
// cosa — la lista es corta y se valida contra ella.
const CONFIRMABLES = [
  "nombre",
  "categoria",
  "color",
  "formalidad",
  "temporada",
  "corte",
  "largo",
  "material",
  "patron",
] as const;
function confirmadosLimpios(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v)].filter(
    (x): x is string => typeof x === "string" && (CONFIRMABLES as readonly string[]).includes(x)
  );
}

function cleanAtributosRicos(attrs: PrendaAnalisis) {
  return {
    material: cleanTextAttr(attrs.material, MAX_MATERIAL_LEN),
    // El tipo fino: derby/oxford, cruzado/sencillo, con pinzas. Corto a
    // propósito — es una etiqueta, no una descripción, y el motor la lee pegada
    // al nombre. Si el modelo se explaya, se recorta en vez de descartarse.
    subtipo: cleanTextAttr(attrs.subtipo, MAX_MATERIAL_LEN),
    patron: cleanPatron(attrs.patron),
    color_secundario: cleanTextAttr(attrs.color_secundario, MAX_COLOR_LEN),
    contexto: cleanContexto(attrs.contexto),
  };
}

// Guarda una prenda fotografiada por la usuaria. La foto ya está en el bucket
// privado 'prendas' (la subió el cliente con su RLS). attrs lleva los atributos
// confirmados/editados — entran al motor igual que los de un arquetipo.
export async function addPhotoItem(
  photoPath: string,
  attrs: PrendaAnalisis
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // photoPath debe estar dentro de la carpeta del usuario (defensa extra
  // además de la RLS del Storage).
  if (!photoPath.startsWith(`${user.id}/`)) return { ok: false };

  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    source: "photo",
    certeza: "exacta",
    photo_path: photoPath,
    attrs: {
      nombre: attrs.nombre,
      categoria: attrs.categoria,
      color: attrs.color,
      color_hex: attrs.color_hex,
      formalidad: attrs.formalidad,
      temporada: attrs.temporada,
      largo: attrs.largo,
      corte: attrs.corte,
      manga: attrs.manga,
      ...cleanAtributosRicos(attrs),
    },
  });
  if (error) return { ok: false };

  revalidatePath("/closet");
  return { ok: true };
}

// Backfill: a las prendas que agregaste con "ya la tengo" ANTES de que el préstamo
// de imagen existiera (sin foto, sin arquetipo, sin image_path) les presta ahora el
// flat-lay de un arquetipo de su misma categoría y color, para que no salgan como
// un bloque de color. Idempotente: re-correrlo no toca lo que ya tiene imagen.
// Opera solo sobre las prendas propias (RLS); el botón vive gateado a admin.
export async function backfillBorrowedImages(): Promise<{ ok: boolean; updated: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, updated: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .single();
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  // Candidatas: sin arquetipo y sin foto propia (las de "ya la tengo").
  const { data: items } = await supabase
    .from("items")
    .select("id, attrs, render_path, render_status")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .is("archetype_id", null)
    .is("photo_path", null);

  let updated = 0;
  for (const it of items ?? []) {
    const attrs = (it.attrs ?? {}) as {
      nombre?: string;
      categoria?: string;
      color_hex?: string;
      image_path?: string;
    };
    const hasRender = it.render_status === "done" && !!it.render_path;
    // Ya tiene de dónde sacar imagen, o le faltan datos para emparejar → salta.
    if (hasRender || attrs.image_path || !attrs.categoria || !attrs.color_hex) continue;
    const img = await borrowArchetypeImage(
      supabase,
      attrs.categoria,
      attrs.color_hex,
      gender,
      attrs.nombre ?? ""
    );
    if (!img) continue;
    const { error } = await supabase
      .from("items")
      .update({ attrs: { ...attrs, image_path: img } })
      .eq("id", it.id)
      .eq("user_id", user.id);
    if (!error) updated++;
  }

  revalidatePath("/closet");
  return { ok: true, updated };
}

// Quita una prenda del clóset (soft delete — deja rastro para señales del
// journey). Sirve para podar básicos asumidos que la usuaria no tiene. Verifica
// propiedad por user_id además de la RLS.
export async function removeItem(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data, error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return { ok: false };

  // Deja rastro: qué prendas se van y cuándo es señal de qué le sobra al clóset.
  await supabase
    .from("events")
    .insert({ user_id: user.id, type: "item_deleted", data: { item_id: id } });

  revalidatePath("/closet");
  return { ok: true };
}

// Edita los atributos de una prenda FOTOGRAFIADA (corrige lo que la IA leyó mal).
// Solo aplica a source='photo': los arquetipos derivan su display del catálogo,
// así que editarlos no tendría efecto (se podan, no se editan).
// material/patron/color_secundario son corregibles porque una mala lectura de
// visión (o del backfill) es señal DURA para el motor ("lana" excluye la prenda
// de looks de calor) — write-once sería incorregible.
export async function updateItemAttrs(
  id: string,
  patch: {
    nombre?: string;
    categoria?: string;
    formalidad?: string;
    temporada?: string;
    material?: string;
    patron?: string;
    color_secundario?: string;
    /**
     * MARCA Y TALLA — los dos únicos atributos que ningún modelo puede leer.
     *
     * Idea de Roberto. Van SÓLO aquí y nunca en los flujos de alta, y eso es la
     * decisión: la marca la vio la visión en 2 de 336 prendas (las Columbia,
     * por el logo) y la talla vive en una etiqueta por dentro, así que las dos
     * son tecleo manual siempre. Pedirlas al dar de alta —quince prendas por
     * dos campos de texto en un teléfono— es exactamente la fricción de
     * catalogar que mató al alfa de Replit y que este producto existe para no
     * tener. En la ficha, en cambio, tienes el zapato en la mano y no hay prisa.
     *
     * NO LAS LEE EL MOTOR, y es a propósito. Nada entra al prompt sin medirse:
     * la marca es señal de estilo de verdad (un Meermin no es un zapato café
     * cualquiera), pero eso se prueba con el instrumento pareado, no de oído.
     * Hoy su consumidor es la persona mirando su propia prenda, que es un
     * consumidor legítimo — a diferencia de los campos que se escriben y no lee
     * nadie.
     */
    marca?: string;
    talla?: string;
    /** El color principal — no estaba editable en la ficha y es el que más pesa. */
    color?: string;
    color_hex?: string;
    /**
     * Se manda SOLO si la persona tocó una silueta. Preseleccionamos lo que
     * creemos, así que si se mandara siempre, guardar sin mirar marcaría como
     * confirmado un dato que nadie revisó — que es exactamente la mentira que
     * la certeza vino a impedir.
     */
    corte?: string;
  }
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // SIN GATE DE `source`. Antes sólo se dejaba editar lo fotografiado, y el
  // efecto era exactamente el contrario del que se buscaba: las prendas con el
  // dato INVENTADO —las 513 del catálogo en categorías donde el corte importa—
  // eran justo las que no se podían corregir. Abrías la ficha de tus jeans, y
  // no se dejaba tocar nada.
  const { data: item } = await supabase
    .from("items")
    .select("attrs")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (!item) return { ok: false };

  const attrs = (item.attrs ?? {}) as Record<string, unknown>;
  const clean: Record<string, unknown> = { ...attrs };
  if (typeof patch.nombre === "string" && patch.nombre.trim())
    clean.nombre = patch.nombre.trim().slice(0, 60);
  // La UI manda valores de selects fijos; el tope es la frontera de confianza
  // (estos attrs entran a prompts del motor — sin tope, un cliente manipulado
  // mete párrafos por esta puerta).
  if (patch.categoria) clean.categoria = patch.categoria.slice(0, 30);
  if (patch.formalidad) clean.formalidad = patch.formalidad.slice(0, 30);
  if (patch.temporada) clean.temporada = patch.temporada.slice(0, 30);
  // Atributos ricos: mandar el campo con string vacío = "quitar el dato"
  // (una lectura equivocada se borra, no solo se reemplaza).
  if (patch.material !== undefined) {
    const v = cleanTextAttr(patch.material, MAX_MATERIAL_LEN);
    if (v) clean.material = v;
    else delete clean.material;
  }
  if (patch.patron !== undefined) {
    const v = cleanPatron(patch.patron);
    if (v) clean.patron = v;
    else delete clean.patron;
  }
  // EL COLOR PRINCIPAL. Faltaba: la ficha dejaba corregir el SEGUNDO color y no
  // el primero, que es el que alimenta las reglas de cuero, las de monocromo y
  // la colorimetría entera.
  // Texto libre corto: mandar vacío BORRA el dato (te equivocaste de talla y
  // la quitas, no te quedas con la mala).
  for (const campo of ["marca", "talla"] as const) {
    if (patch[campo] === undefined) continue;
    const v = cleanTextAttr(patch[campo], MAX_MATERIAL_LEN);
    if (v) clean[campo] = v;
    else delete clean[campo];
  }
  if (patch.color) clean.color = patch.color.slice(0, 40);
  if (patch.color_hex && /^#[0-9a-f]{6}$/i.test(patch.color_hex))
    clean.color_hex = patch.color_hex;
  // CORREGIR LA PRENDA INVALIDA SU DESCRIPCIÓN VISUAL. La regla y el porqué
  // viven en lib/garment-desc (descripcionObsoleta): en resumen, la descripción
  // le gana al nombre en el generador, así que sin esto renombrar "Blazer
  // marrón" a "Abrigo de lana marrón" y aceptar rehacer la imagen devolvía otra
  // vez un blazer.
  if (
    descripcionObsoleta({
      nombreViejo: attrs.nombre as string | undefined,
      nombreNuevo: clean.nombre as string | undefined,
      hexViejo: attrs.color_hex as string | undefined,
      hexNuevo: clean.color_hex as string | undefined,
    })
  ) {
    delete clean.visual;
  }
  if (patch.color_secundario !== undefined) {
    const v = cleanTextAttr(patch.color_secundario, MAX_COLOR_LEN);
    if (v) clean.color_secundario = v;
    else delete clean.color_secundario;
  }
  // El corte, cuando viene, viene de un tap explícito en una silueta → cuenta
  // como confirmado y el motor deja de tratarlo como aproximado. Es el mismo
  // contrato que la card de afinar: se confirma el ATRIBUTO, no la prenda.
  if (patch.corte && ["entallado", "recto", "holgado"].includes(patch.corte)) {
    clean.corte = patch.corte;
    const confirmados = new Set(
      Array.isArray(clean.confirmados) ? (clean.confirmados as string[]) : []
    );
    confirmados.add("corte");
    clean.confirmados = [...confirmados];
  }

  const { error } = await supabase
    .from("items")
    .update({ attrs: clean })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false };

  revalidatePath("/closet");
  return { ok: true };
}

// Agrega básicos del catálogo (arquetipos) al clóset DESPUÉS del onboarding —
// la "biblioteca completa". A diferencia de saveCloset (onboarding), no avanza
// pasos ni exige mínimo; valida contra el catálogo, respeta el género y no
// reinserta lo que ya tiene.
export async function addArchetypes(
  archetypeIds: number[]
): Promise<{ ok: boolean; added: number }> {
  const ids = [...new Set(archetypeIds)].filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (ids.length === 0) return { ok: false, added: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, added: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .single();
  const gender = profile?.gender ?? "hombre";

  const { data: archetypes } = await supabase
    .from("archetypes")
    .select("id, name, attrs, image_path, segment")
    .in("id", ids);
  if (!archetypes || archetypes.length === 0) return { ok: false, added: 0 };

  // Solo del género del usuario o unisex (defensa contra IDs manipulados).
  const allowed = archetypes.filter(
    (a) => a.segment === "unisex" || a.segment === gender
  );

  // No reinsertar lo que ya tiene.
  const { data: existing } = await supabase
    .from("items")
    .select("archetype_id")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const have = new Set((existing ?? []).map((e) => e.archetype_id));
  const toInsert = allowed.filter((a) => !have.has(a.id));
  if (toInsert.length === 0) return { ok: true, added: 0 };

  const { error } = await supabase.from("items").insert(
    toInsert.map((a) => ({
      user_id: user.id,
      source: "archetype",
      // GENERICA y no "asumida": eligió ESTA prenda del catálogo a propósito,
      // así que el tipo sí es suyo. Lo que sigue siendo del arquetipo son los
      // detalles finos (corte, largo), y por eso tampoco es "exacta".
      certeza: "generica",
      archetype_id: a.id,
      attrs: {
        nombre: a.name,
        image_path: a.image_path,
        ...(a.attrs as Record<string, unknown>),
      },
    }))
  );
  if (error) return { ok: false, added: 0 };

  revalidatePath("/closet");
  return { ok: true, added: toInsert.length };
}

// Importar del carrete: inserta en lote las prendas que el usuario CONFIRMÓ
// (texto + render visual). Se llama una sola vez al final del flujo, así las
// prendas no aparecen/desaparecen del clóset mientras se curan. `renderPath` ya
// viene del render de Gemini; si el render falló, renderStatus='failed' y el
// clóset cae al swatch de color. Spec: docs/designs/import-carrete-multiprenda.md
export async function addPhotoItems(
  items: {
    attrs: PrendaAnalisis & {
      /**
       * La descripción VISUAL que escribió la visión al leer la foto (cuello,
       * mangas, botones, suela, textura…). Se tiraba: 0 de 325 prendas la
       * conservan.
       *
       * Y era la pieza cara del alta. Es lo que hace fiel al PRIMER render — el
       * prompt de extracción la usa para señalar qué prenda sacar de la foto —
       * y al no guardarse, cualquier render posterior partía sólo del nombre.
       * O sea que la imagen del clóset sólo podía empeorar con el tiempo.
       *
       * Se guarda como `visual`, que es el nombre que garmentRenderDesc ya lee
       * (la "Capa 2" del render) — así el dato entra a un camino que existe en
       * vez de estrenar uno.
       */
      descripcion?: string;
      /** Los campos que la persona TOCÓ en la confirmación. Ver abajo. */
      confirmados?: string[];
    };
    renderPath: string | null;
    /**
     * `null` = todavía no se ha intentado dibujarla, y NO es lo mismo que
     * "falló". El auto-sanado del clóset sólo recoge las que están en `none`
     * (render_status nulo): marcarlas 'failed' las deja sin imagen para
     * siempre. Lo usa el espejo, que suma prendas sin pararse a dibujarlas —
     * cinco renders son ~85s y ahí la persona está saliendo de su casa.
     */
    renderStatus: "done" | "failed" | null;
    /**
     * La foto ORIGINAL de donde salió la prenda.
     *
     * Se tiraba: de 325 prendas dadas de alta por foto, sólo 5 conservaban el
     * original. Lo que quedaba era el dibujo generado a partir de ella, y eso
     * cierra tres puertas a la vez — no se puede comprobar de qué foto salió un
     * render raro, no se puede volver a leer la prenda con un modelo mejor
     * (midiendo la deriva de visión hubo que usar renders como sustituto
     * porque los originales no existen), y si el render sale mal no hay a dónde
     * regresar: rehacerlo parte del texto, no de la prenda.
     *
     * NO cambia lo que se ve: pickItemImage prefiere el render sobre la foto,
     * así que la miniatura sigue siendo el dibujo limpio.
     */
    photoPath?: string | null;
  }[]
): Promise<{ ok: boolean; added: number; dejadas?: number; ids?: string[] }> {
  // EL TOPE SE DICE, NO SE ESCONDE. Antes esto era `slice(0, 30)` a secas y la
  // acción devolvía `ok: true`: si alguien subía 12 fotos con 8 prendas cada
  // una, el botón decía "sumar 45 al clóset", 15 se perdían y nadie se enteraba
  // nunca. Un tope está bien; un tope callado es pérdida de datos silenciosa.
  const MAX_LOTE = 60;
  const clean = items.slice(0, MAX_LOTE);
  const dejadas = items.length - clean.length;
  if (clean.length === 0) return { ok: true, added: 0, dejadas };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, added: 0 };

  // Las rutas deben estar dentro de la carpeta del usuario (defensa además de
  // la RLS del Storage). Vale igual para el render y para la foto original.
  for (const it of clean) {
    if (it.renderPath && !it.renderPath.startsWith(`${user.id}/`)) {
      return { ok: false, added: 0 };
    }
    if (it.photoPath && !it.photoPath.startsWith(`${user.id}/`)) {
      return { ok: false, added: 0 };
    }
  }

  // Devuelve los ids: el espejo los necesita para colgar las prendas del look
  // que acaba de guardar en el diario.
  const { data: creadas, error } = await supabase
    .from("items")
    .insert(
    clean.map((it) => ({
      user_id: user.id,
      source: "photo",
      // Su foto, leída por la visión: dato duro.
      certeza: "exacta",
      attrs: {
        nombre: it.attrs.nombre,
        categoria: it.attrs.categoria,
        color: it.attrs.color,
        color_hex: it.attrs.color_hex,
        formalidad: it.attrs.formalidad,
        temporada: it.attrs.temporada,
        largo: it.attrs.largo,
        corte: it.attrs.corte,
        manga: it.attrs.manga,
        // El lazo del traje, si la persona dijo que saco y pantalón son uno.
        ...(it.attrs.conjunto ? { conjunto: it.attrs.conjunto } : {}),
        // La descripción visual, para que el render se pueda rehacer fiel.
        ...(cleanTextAttr(it.attrs.descripcion, MAX_VISUAL_LEN)
          ? { visual: cleanTextAttr(it.attrs.descripcion, MAX_VISUAL_LEN) }
          : {}),
        // LO QUE LA PERSONA CORRIGIÓ A MANO, marcado como suyo.
        //
        // Aquí se toca cada campo de cada prenda —tipo, color, formalidad,
        // corte, largo, material, patrón— y nada de eso se registraba: una
        // prenda revisada campo por campo le llegaba al motor exactamente igual
        // que una que nadie miró. Sólo cuentan los campos TOCADOS, por la misma
        // razón que en la ficha: todo viene preseleccionado, así que "no
        // tocarlo" no es confirmar, es no haber mirado.
        ...(confirmadosLimpios(it.attrs.confirmados).length
          ? { confirmados: confirmadosLimpios(it.attrs.confirmados) }
          : {}),
        ...cleanAtributosRicos(it.attrs),
      },
      render_status: it.renderStatus,
      render_path: it.renderPath,
      photo_path: it.photoPath ?? null,
    }))
    )
    .select("id");
  if (error) return { ok: false, added: 0 };

  revalidatePath("/closet");
  return {
    ok: true,
    added: clean.length,
    dejadas,
    ids: (creadas ?? []).map((r) => r.id as string),
  };
}

// Render rechazado en la confirmación visual ("no es mi prenda" pero la imagen
// es válida): no se borra, va a staging para que el admin decida si entra a la
// biblioteca compartida. Nunca se publica solo.
export async function addLibraryCandidates(
  candidates: { attrs: PrendaAnalisis; imagePath: string }[]
): Promise<{ ok: boolean; added: number }> {
  const clean = candidates.slice(0, 30);
  if (clean.length === 0) return { ok: true, added: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, added: 0 };

  for (const c of clean) {
    if (!c.imagePath.startsWith(`${user.id}/`)) return { ok: false, added: 0 };
  }

  const { error } = await supabase.from("library_candidates").insert(
    clean.map((c) => ({
      user_id: user.id,
      attrs: {
        nombre: c.attrs.nombre,
        categoria: c.attrs.categoria,
        color: c.attrs.color,
        color_hex: c.attrs.color_hex,
        formalidad: c.attrs.formalidad,
        temporada: c.attrs.temporada,
      },
      image_path: c.imagePath,
      source_kind: "rejected_render",
    }))
  );
  if (error) return { ok: false, added: 0 };

  return { ok: true, added: clean.length };
}


/**
 * Confirma el CORTE de una prenda que solo estaba marcada en el checklist.
 *
 * Guarda el atributo en `attrs.confirmados`, NO un nivel global de certeza. La
 * primera versión subía la prenda a "generica" y Roberto lo cazó al leerlo:
 * "esta certeza genérica, no entiendo eso". Tenía razón, porque estaba mal —
 * `certeza` dice de DÓNDE vino la prenda (foto / catálogo / checklist) y eso no
 * cambia porque confirme un detalle.
 *
 * Lo que sí cambia, y es lo que importa: si confirma el CORTE de unos jeans del
 * checklist, el motor debe saber que el corte es suyo y que el LARGO sigue
 * siendo del catálogo. Un nivel global no puede decir eso — o toda la prenda es
 * confiable o ninguna.
 */
export async function confirmarCorte(
  itemId: string,
  corte: "entallado" | "recto" | "holgado"
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "sin sesión" };
  if (!["entallado", "recto", "holgado"].includes(corte)) {
    return { ok: false, error: "corte inválido" };
  }

  // El .eq del user_id no es decorativo: sin él, un id ajeno editaría la prenda
  // de otra persona. El RLS es la segunda red, no la primera.
  const { data: fila } = await supabase
    .from("items")
    .select("attrs")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!fila) return { ok: false, error: "no existe esa prenda" };

  const attrs = (fila.attrs as Record<string, unknown>) ?? {};
  const confirmados = new Set(
    Array.isArray(attrs.confirmados) ? (attrs.confirmados as string[]) : []
  );
  confirmados.add("corte");

  const { error } = await supabase
    .from("items")
    .update({ attrs: { ...attrs, corte, confirmados: [...confirmados] } })
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/closet");
  return { ok: true };
}

/**
 * El clóset, reducido a lo justo para preguntar "¿ya la tienes?".
 *
 * Se lee al entrar a la pantalla de confirmación del carrete, no antes: es una
 * consulta por tanda de fotos, no por prenda leída.
 *
 * VA CON IMAGEN porque el aviso sin foto no se puede contestar. "Creo que ya
 * tienes unos Mocasines café" no le dice a nadie si son ESOS mocasines; las dos
 * imágenes lado a lado, sí. Es la misma lección de la card de afinar.
 */
export async function prendasParaComparar(): Promise<PrendaExistente[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from("items")
    .select(ITEM_IMAGE_SELECT)
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (!rows) return [];

  const privadas = Array.from(new Set(rows.flatMap((r) => itemPrivatePaths(r as ItemImageRow))));
  const firmadas = new Map<string, string>();
  if (privadas.length > 0) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls(privadas, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) firmadas.set(s.path, s.signedUrl);
    });
  }

  return rows.map((r, i) => {
    const fila = r as ItemImageRow & { id?: string };
    const attrs = (fila.attrs ?? {}) as Record<string, string | undefined>;
    const arch = fila.archetypes as { name?: string | null } | null;
    return {
      id: fila.id ?? String(i),
      nombre: attrs.nombre ?? arch?.name ?? "",
      categoria: categoriaDeItem(fila),
      colorHex: attrs.color_hex ?? null,
      material: attrs.material ?? null,
      corte: attrs.corte ?? null,
      marca: attrs.marca ?? null,
      // Sólo el corte leído de su foto o confirmado a mano puede descartar un
      // aviso — ver el comentario de `corteDeFiar`.
      corteDeFiar:
        fila.certeza === "exacta" ||
        (Array.isArray((fila.attrs as { confirmados?: unknown })?.confirmados) &&
          (fila.attrs as { confirmados: string[] }).confirmados.includes("corte")),
      imagen: itemImageUrlSync(fila, (p) => firmadas.get(p)),
    };
  });
}

/**
 * Ata (o desata) el saco y el pantalón de UN traje.
 *
 * Existía sólo al dar de alta desde una foto, y era un hueco: quien pasara de
 * la casilla —o quien tuviera el traje de antes— no podía atarlo nunca. Los 4
 * "Traje …" que hay en la base guardados como una sola pieza son justo eso.
 *
 * NO SE DUPLICA LA PRENDA, y ésa es la decisión de fondo. Roberto lo propuso —
 * "que cuando es traje se guarde doble, para usarlo suelto o junto"— y suena
 * inocente: el motor contaría el saco dos veces y podría meter los dos en un
 * look, los conteos del clóset mentirían, y las dos copias se separarían en
 * cuanto alguien editara una. Un traje son dos prendas con un lazo, no tres
 * filas.
 *
 * `parejaId` en null desata: limpia el lazo de las dos piezas.
 */
export async function atarConjunto(
  itemId: string,
  parejaId: string | null
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (itemId === parejaId) return { ok: false };

  // Todas las prendas del usuario que hoy tienen lazo, para poder limpiar el
  // anterior: atar el saco a OTRO pantalón debe soltar el primero, o quedarían
  // tres piezas en el mismo "traje".
  const { data: filas } = await supabase
    .from("items")
    .select("id, attrs")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (!filas) return { ok: false };

  const attrsDe = (id: string) =>
    (filas.find((f) => f.id === id)?.attrs ?? {}) as Record<string, unknown>;
  const item = filas.find((f) => f.id === itemId);
  if (!item) return { ok: false };
  if (parejaId && !filas.find((f) => f.id === parejaId)) return { ok: false };

  const viejos = new Set(
    [itemId, parejaId]
      .filter((x): x is string => !!x)
      .map((id) => attrsDe(id).conjunto)
      .filter((c): c is string => typeof c === "string")
  );
  const aLimpiar = filas.filter((f) => {
    const c = (f.attrs as Record<string, unknown>)?.conjunto;
    return typeof c === "string" && viejos.has(c);
  });

  for (const f of aLimpiar) {
    const attrs = { ...((f.attrs ?? {}) as Record<string, unknown>) };
    delete attrs.conjunto;
    await supabase.from("items").update({ attrs }).eq("id", f.id).eq("user_id", user.id);
  }

  if (parejaId) {
    const nuevo = crypto.randomUUID();
    for (const id of [itemId, parejaId]) {
      const base = { ...attrsDe(id) };
      delete base.conjunto;
      await supabase
        .from("items")
        .update({ attrs: { ...base, conjunto: nuevo } })
        .eq("id", id)
        .eq("user_id", user.id);
    }
  }

  revalidatePath("/closet");
  return { ok: true };
}

/**
 * Crea el pantalón que le falta a un saco de traje, y los ata.
 *
 * Roberto, sobre los cuatro "Traje …" que quedaron a medias: "si tengo el
 * traje, tengo el pantalón y tengo el saco… está raro si no hay imagen del
 * pantalón". En la migración no lo creé porque no sabía si existía —crear ropa
 * que nadie tiene es el problema que llevamos días persiguiendo—, pero que la
 * persona lo declare cambia las cosas: deja de ser invención y pasa a ser un
 * dato suyo.
 *
 * SE DERIVA DEL SACO (color, material, temporada) en vez de rellenarse a ojo:
 * ver lib/pantalon-del-traje. La certeza queda en 'generica' — la prenda es
 * suya a propósito, pero nadie la ha fotografiado.
 *
 * La imagen NO se genera aquí: el cliente pide el render después, para no
 * amarrar esta acción a una llamada de 30s que puede fallar sola.
 */
export async function crearPantalonDelTraje(
  sacoId: string
): Promise<{ ok: boolean; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: saco } = await supabase
    .from("items")
    .select("attrs, archetypes(name)")
    .eq("id", sacoId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (!saco) return { ok: false };

  const a = (saco.attrs ?? {}) as Record<string, string | undefined>;
  const arch = saco.archetypes as { name?: string } | null;
  const attrs = attrsDelPantalon({
    nombre: a.nombre ?? arch?.name ?? "Saco",
    color: a.color ?? null,
    colorHex: a.color_hex ?? null,
    material: a.material ?? null,
    temporada: a.temporada ?? null,
  });

  const conjunto = crypto.randomUUID();
  const { data: creado, error } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      source: "archetype",
      // GENERICA: la eligió a propósito (dijo "sí lo tengo"), pero no hay foto
      // suya y los detalles finos se heredaron del saco.
      certeza: "generica",
      attrs: { ...attrs, conjunto },
    })
    .select("id")
    .single();
  if (error || !creado) return { ok: false };

  // El saco pierde cualquier lazo viejo y se queda con éste.
  await supabase
    .from("items")
    .update({ attrs: { ...a, conjunto } })
    .eq("id", sacoId)
    .eq("user_id", user.id);

  revalidatePath("/closet");
  return { ok: true, id: creado.id as string };
}

/**
 * Cuelga las prendas de una entrada del espejo, para que se vea como un look.
 *
 * Idea de Roberto: *"cuando se extraigan las prendas, independientemente de que
 * las tenga o no las tenga, que repliquemos el UI del generador de outfit — la
 * foto de la persona con el outfit y junto los thumbnails"*. Y el porqué que da
 * después es el bueno: *"si yo quiero ver mi historial, pues hay cosas que yo me
 * puse y hay cosas que hice y no me puse"*. Las dos clases de entrada tienen que
 * poder mirarse igual, o el diario es dos diarios.
 *
 * LO QUE CUELGA SON DOS COSAS: las prendas suyas que la foto reconoció (el
 * empate ya se calculaba y sólo se tiraba el id) y las que acaba de dar de alta
 * desde esa misma foto.
 *
 * Y ESTO ES LO QUE DE VERDAD COMPRA, más allá de lo visual: hoy "me lo puse" es
 * por OUTFIT y se usó 12 veces en la historia del proyecto. Con esto, cada foto
 * dice qué PRENDAS se puso de verdad — la señal de oro, por prenda, sin pedirle
 * que vote nada.
 *
 * Un empate equivocado aquí cuesta una miniatura mal puesta en una entrada del
 * diario; auto-crear una prenda equivocada cuesta ropa fantasma en el clóset
 * para siempre. Por eso esto sí se hace solo y aquello no.
 */
export async function ligarPrendasAlEspejo(
  outfitId: string,
  itemIds: string[]
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const ids = [...new Set(itemIds)].filter((x) => typeof x === "string" && x).slice(0, 20);
  if (ids.length === 0) return { ok: true };

  // Sólo prendas SUYAS y vivas: un id ajeno o borrado no puede colarse a la
  // entrada (la RLS es la segunda red, no la primera).
  const { data: suyas } = await supabase
    .from("items")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .in("id", ids);
  const limpios = (suyas ?? []).map((r) => r.id as string);
  if (limpios.length === 0) return { ok: true };

  const { error } = await supabase
    .from("outfits")
    .update({ item_ids: limpios })
    .eq("id", outfitId)
    .eq("user_id", user.id)
    // Sólo entradas del espejo: esto NO puede reescribir un look generado.
    .eq("source", "espejo");
  if (error) return { ok: false };

  revalidatePath("/historial");
  return { ok: true };
}
