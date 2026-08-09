import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { VISION_MODEL } from "@/lib/models";
import { leerPrendas } from "@/lib/vision-prendas";
import { yaLaTienes, type PrendaExistente } from "@/lib/ya-la-tienes";
import {
  ITEM_IMAGE_SELECT,
  categoriaDeItem,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";

// ¿QUÉ DE LO QUE TRAES PUESTO NO ESTÁ EN TU CLÓSET?
//
// POR QUÉ ES UNA LLAMADA APARTE Y NO UN CAMPO MÁS DEL ESPEJO: medido el
// 2026-08-08 sobre 425 prendas releídas con control de ruido, añadir un campo
// al schema de un lector mueve OTRAS lecturas con z = 3.05 — y seguía
// moviéndolas sin tocar una palabra del prompt: era el schema en sí. Pedirle al
// espejo que además liste prendas degradaría el consejo, que es su trabajo.
//
// POR QUÉ NO CORRE SOLO: sería una llamada de visión diaria por persona para
// algo que la mayoría de los días no aporta nada — te pones lo que ya tienes.
// Se ofrece DESPUÉS del consejo y sólo si lo pide.
//
// POR QUÉ AQUÍ NO SE GUARDA NADA: una foto de espejo es el PEOR insumo para
// catalogar (oclusión, luz de ambiente, prendas fuera de cuadro), y a diario,
// con la misma camisa tres veces por semana, auto-sumar llenaría el clóset de
// duplicados en un mes. Esta ruta sólo PROPONE; el alta la confirma la persona
// y la hace addPhotoItems, igual que en el carrete.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  let body: { image?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;

  // El clóset y la lectura, en paralelo: el filtro necesita las dos.
  //
  // EL ERROR SE REGISTRA, NO SE TRAGA. Antes era `.catch(() => null)` a secas, y
  // el cliente pintaba "no pude distinguir las prendas en esta foto" para
  // CUALQUIER fallo. Roberto vio ese mensaje sobre una foto donde el propio
  // consejo acababa de nombrar cuatro prendas — o sea que el mensaje era falso
  // y encima escondía la causa (un 503 de Gemini, un timeout, lo que fuera).
  // Confundir "esta foto no se deja leer" con "el servicio falló" quita lo
  // único accionable: volver a intentar.
  const [lectura, { closet, filas }] = await Promise.all([
    leerPrendas({ mediaType, base64: b64 }, VISION_MODEL).catch((e) => {
      console.error("[espejo/prendas] no se pudo leer:", e?.message ?? e);
      return null;
    }),
    closetParaComparar(supabase, user.id),
  ]);
  if (!lectura) return NextResponse.json({ error: "fallo_temporal" }, { status: 502 });

  // SE PARTE EN DOS Y SE DEVUELVEN LAS DOS. El aviso de "creo que ya la tienes"
  // está calibrado contra la base real; aquí se usa al revés —para separar en
  // vez de para avisar— porque el caso es otro: en el carrete estás catalogando
  // y quieres verlo todo; aquí ya te vestiste y tienes prisa, y proponerte sumar
  // la camisa blanca que llevas desde junio es ruido.
  //
  // PERO LO DESCARTADO SE DICE, con el nombre de la prenda tuya con la que lo
  // emparejé. Roberto: "no sé si las cosas que no detectó es porque ya las tengo
  // o porque no las detectó". Filtrando en silencio, tres cosas muy distintas
  // —ya la tienes, no la vi, la vi mal— se ven exactamente igual desde su lado,
  // y encima un empate equivocado se vuelve invisible: si le digo que ya tiene
  // "Pantalón de lino" y éste es otro, sin decirlo nunca se entera.
  const nuevas: typeof lectura.prendas = [];
  // Con el ID, no sólo el nombre: es lo que deja que la entrada del diario
  // enseñe las prendas como un look generado. El empate YA se estaba
  // calculando y sólo se tiraba el id.
  const yaEstan: { id: string; nombre: string; comoEsta: string; imagen: string | null }[] = [];
  for (const p of lectura.prendas) {
    const match = yaLaTienes(
      {
        nombre: p.nombre,
        categoria: p.categoria,
        colorHex: p.color_hex,
        material: p.material,
        corte: p.corte,
      },
      closet
    );
    if (match) yaEstan.push({ id: match.id, nombre: p.nombre, comoEsta: match.nombre, imagen: null });
    else nuevas.push(p);
  }

  // LA FOTO DE LA PRENDA QUE CREO QUE ES — y sólo de ésas.
  //
  // Roberto: "sería bueno que también ponga el thumbnail de las prendas que
  // asume que ya tengo". Tiene razón, y es el mismo argumento que ya vale en el
  // carrete: "creo que ya tienes unos Mocasines café" no le dice a nadie si son
  // ESOS mocasines; las dos imágenes lado a lado, sí. Sin la foto, un empate
  // equivocado no se puede ver, y esa prenda no entra a su clóset nunca.
  //
  // Se firman DESPUÉS de emparejar y sólo las emparejadas —dos o tres— en vez
  // de las 138 del clóset entero, que era el motivo de no traerlas antes.
  // ItemImageRow no declara `id` (el select lo pide aparte), así que se lee con
  // el tipo ensanchado en vez de castear la fila entera.
  const porId = new Map(
    filas.map((f) => [(f as ItemImageRow & { id: string }).id, f])
  );
  const aFirmar = [
    ...new Set(
      yaEstan.flatMap((y) => {
        const fila = porId.get(y.id);
        return fila ? itemPrivatePaths(fila) : [];
      })
    ),
  ];
  const firmadas = new Map<string, string>();
  if (aFirmar.length > 0) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls(aFirmar, 3600);
    data?.forEach((x) => {
      if (x.path && x.signedUrl) firmadas.set(x.path, x.signedUrl);
    });
  }
  for (const y of yaEstan) {
    const fila = porId.get(y.id);
    y.imagen = fila ? itemImageUrlSync(fila, (ruta) => firmadas.get(ruta)) : null;
  }

  return NextResponse.json({
    vistas: lectura.prendas.length,
    prendas: nuevas,
    yaEstan,
  });
}

/** El clóset reducido a lo justo para el filtro.
 *
 *  SIN IMÁGENES, y por eso no reusa `prendasParaComparar` del clóset: aquélla
 *  firma una URL por prenda porque el carrete SÍ enseña la prenda repetida
 *  ("creo que ya tienes estos mocasines", con foto). Aquí las viejas no se
 *  enseñan nunca —sólo sirven para descartar—, así que firmar cientos de URLs
 *  sería pagar por imágenes que nadie va a ver. */
async function closetParaComparar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ closet: PrendaExistente[]; filas: ItemImageRow[] }> {
  const { data: rows } = await supabase
    .from("items")
    // `id, ` DELANTE: ITEM_IMAGE_SELECT no lo trae, y sin él supabase devuelve
    // filas sin id — los "ids" acababan siendo el índice del arreglo ("66",
    // "7"). En el espejo eso significaba que las prendas reconocidas NUNCA se
    // podían colgar del look: ligarPrendasAlEspejo las descartaba por no existir.
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (!rows) return { closet: [], filas: [] };

  const closet = rows.map((r, i) => {
    const fila = r as ItemImageRow & { id?: string };
    const attrs = (fila.attrs ?? {}) as Record<string, string | undefined>;
    const arch = fila.archetypes as { name?: string | null } | null;
    const confirmados = (fila.attrs as { confirmados?: unknown })?.confirmados;
    return {
      id: fila.id ?? String(i),
      nombre: attrs.nombre ?? arch?.name ?? "",
      categoria: categoriaDeItem(fila),
      colorHex: attrs.color_hex ?? null,
      material: attrs.material ?? null,
      corte: attrs.corte ?? null,
      marca: attrs.marca ?? null,
      corteDeFiar:
        fila.certeza === "exacta" ||
        (Array.isArray(confirmados) && (confirmados as string[]).includes("corte")),
      // La imagen se resuelve DESPUÉS y sólo para las emparejadas.
      imagen: null,
    };
  });
  return { closet, filas: rows as unknown as ItemImageRow[] };
}
