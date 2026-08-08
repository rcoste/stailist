import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { VISION_MODEL } from "@/lib/models";
import { leerPrendas } from "@/lib/vision-prendas";
import { yaLaTienes, type PrendaExistente } from "@/lib/ya-la-tienes";
import { ITEM_IMAGE_SELECT, categoriaDeItem, type ItemImageRow } from "@/lib/item-image";

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
  const [lectura, closet] = await Promise.all([
    leerPrendas({ mediaType, base64: b64 }, VISION_MODEL).catch(() => null),
    closetParaComparar(supabase, user.id),
  ]);
  if (!lectura) return NextResponse.json({ error: "no_pude_leer" }, { status: 502 });

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
  const yaEstan: { nombre: string; comoEsta: string }[] = [];
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
    if (match) yaEstan.push({ nombre: p.nombre, comoEsta: match.nombre });
    else nuevas.push(p);
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
): Promise<PrendaExistente[]> {
  const { data: rows } = await supabase
    .from("items")
    .select(ITEM_IMAGE_SELECT)
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (!rows) return [];

  return rows.map((r, i) => {
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
      corteDeFiar:
        fila.certeza === "exacta" ||
        (Array.isArray(confirmados) && (confirmados as string[]).includes("corte")),
      imagen: null,
    };
  });
}
