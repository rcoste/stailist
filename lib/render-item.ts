import type { SupabaseClient } from "@supabase/supabase-js";
import { generateArchetypeImage } from "@/lib/archetype-image";
import { extraerPrendaDeFoto } from "@/lib/extraer-prenda";
import { garmentDescPlain, garmentRenderDesc } from "@/lib/garment-desc";

// Render limpio (tipo catálogo) de una prenda del clóset SIN imagen, desde sus
// atributos (texto→imagen con Gemini), subido a Storage y cacheado en el item
// (render_path + render_status='done'). Idempotente: si ya tiene de dónde sacar
// imagen o ya se está renderizando, no hace nada. Compartido por el endpoint
// /api/render-item (auto-sanado del clóset) y por "ya lo tengo" (cápsula/viaje).
export type RenderItemResult = {
  ok: boolean;
  skipped?: boolean;
  path?: string;
  error?: string;
};

export async function renderItemImage(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  /**
   * Rehacer la imagen aunque ya tenga una.
   *
   * Nace de un caso real: el "Esmoquin negro" de Roberto entró por una foto del
   * traje ENTERO, así que su render —hecho a partir de esa foto— enseña saco y
   * pantalón juntos. Como prenda es un saco, y su miniatura miente. La
   * idempotencia de abajo existe para no gastar dinero regenerando lo que ya
   * está; cuando la imagen es la equivocada, esa protección estorba. Sólo se
   * pide desde la ficha, con un tap explícito.
   */
  forzar = false
): Promise<RenderItemResult> {
  const { data: item } = await supabase
    .from("items")
    .select("id, archetype_id, photo_path, render_status, render_path, attrs")
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) return { ok: false, error: "not_found" };

  const attrs = (item.attrs ?? {}) as {
    nombre?: string;
    color?: string;
    categoria?: string;
    tipo?: string;
    image_path?: string;
    formalidad?: string;
    temporada?: string;
    largo?: string;
    corte?: string;
    manga?: string;
    visual?: string;
    /** De qué foto salió (espejo): permite dibujarla igual que en el carrete. */
    origen_foto?: string;
  };

  // Idempotencia: ya tiene imagen (arquetipo, render previo, foto, o prestada) o
  // ya hay un render en curso → no regeneres.
  const yaTieneImagen =
    !!item.archetype_id ||
    (item.render_status === "done" && !!item.render_path) ||
    !!item.photo_path ||
    !!attrs.image_path;
  if ((yaTieneImagen && !forzar) || item.render_status === "pending") {
    return { ok: true, skipped: true };
  }

  const nombre = (attrs.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "sin_atributos" };
  const categoria = attrs.categoria ?? attrs.tipo ?? "";

  // Marca "en curso" antes del trabajo pesado (guard anti doble-generación).
  await supabase
    .from("items")
    .update({ render_status: "pending" })
    .eq("id", itemId)
    .eq("user_id", userId);

  // Descripción rica: detalle visual del estilista si lo hay, o los atributos que
  // la prenda ya carga (categoría, formalidad, largo/corte/manga de la visión).
  const rasgos = {
    nombre,
    color: attrs.color,
    categoria: attrs.categoria,
    formalidad: attrs.formalidad,
    temporada: attrs.temporada,
    largo: attrs.largo,
    corte: attrs.corte,
    manga: attrs.manga,
    visual: attrs.visual,
  };
  const conColor = garmentRenderDesc(rasgos);
  const type = categoria === "calzado" ? "shoes" : "flat";

  // Género del usuario: sin esto, prendas ambiguas (traje de baño, sandalias)
  // se renderizan de mujer por default. Lo pasamos al prompt para desambiguar.
  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", userId)
    .single();
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  // SI HAY FOTO ORIGINAL, SE VUELVE A ELLA. Éste era el hueco: desde ayer la
  // foto de origen se guarda —y el commit que lo hizo prometía justo esto,
  // "regresar a la fuente cuando el dibujo sale mal"— pero el botón que arregla
  // un dibujo equivocado seguía yendo por texto→imagen. O sea que el dato nuevo
  // no tenía ni un solo consumidor.
  //
  // Y no es un matiz: describir la prenda en palabras pierde la prenda (hay mil
  // cortes de saco negro). Con la foto delante, el modelo copia el corte, el
  // color y los detalles REALES, que es exactamente lo que el caso del esmoquin
  // necesita — su foto trae el traje entero y aquí se le pide sólo el saco.
  //
  // Falla hacia texto→imagen: si la foto no se puede bajar o la extracción
  // truena, sigue el camino de siempre en vez de dejar la prenda sin imagen.
  // LA FOTO DE ORIGEN VALE IGUAL QUE `photo_path`. Las prendas que entran por
  // el espejo la guardan en attrs porque la columna decide la miniatura (ver
  // addPhotoItems): sin esto, dibujarlas aquí caía a texto→imagen y la misma
  // prenda salía fiel o genérica según quién la dibujara.
  const fuente = item.photo_path ?? attrs.origen_foto ?? null;
  let bytes: Buffer | null = null;
  if (fuente) {
    try {
      const { data: blob } = await supabase.storage.from("prendas").download(fuente);
      if (blob) {
        bytes = await extraerPrendaDeFoto(
          {
            base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
            mediaType: blob.type || "image/jpeg",
          },
          {
            // El texto sólo señala CUÁL prenda sacar de la foto; el parecido lo
            // pone la imagen. Por eso va la descripción SIN la orden de
            // renderizar — ver garmentDescPlain.
            // Sin `color` aparte: garmentDescPlain ya lo mete cuando el nombre
            // no lo trae, y repetirlo sólo duplicaría el color en el prompt.
            quePrenda: garmentDescPlain(rasgos),
            categoria,
            aspecto: "3:4",
          }
        );
      }
    } catch {
      // sin foto utilizable → texto→imagen
    }
  }
  if (!bytes) bytes = await generateArchetypeImage(conColor, type, gender, "3:4");
  if (!bytes) {
    await supabase
      .from("items")
      .update({ render_status: "failed" })
      .eq("id", itemId)
      .eq("user_id", userId);
    return { ok: false, error: "render_fallo" };
  }

  const path = `${userId}/render-${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (up.error) {
    await supabase
      .from("items")
      .update({ render_status: "failed" })
      .eq("id", itemId)
      .eq("user_id", userId);
    return { ok: false, error: "upload_fallo" };
  }

  await supabase
    .from("items")
    .update({ render_path: path, render_status: "done" })
    .eq("id", itemId)
    .eq("user_id", userId);

  return { ok: true, path };
}
