import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generarTryon } from "@/lib/tryon";

export const maxDuration = 60;

// UN look del eval, puesto en el avatar del dueño del clóset.
//
// Roberto, calibrando: "sin el render no estoy seguro". La cuadrícula de
// prendas mide la COMPOSICIÓN —que es lo que el motor decide— y por eso sigue
// siendo el default; pero hay looks donde el juicio necesita ver el conjunto
// puesto, y negarle eso a quien califica es pedirle que adivine.
//
// BAJO DEMANDA Y CACHEADO. Cuesta ~$0.13 y ~16s por look: renderear los 40 de
// una corrida costaría más que la corrida entera. Se guarda el path en
// eval_briefs.tryons para que reabrir la misma corrida no vuelva a pagar.
//
// Llama a lib/tryon.ts, el MISMO núcleo que /api/tryon de producción: el
// prompt, las referencias de identidad y el guard de prendas sin imagen son
// los de verdad, no una copia.
export async function POST(request: NextRequest) {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  let body: { briefId?: string; indice?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { briefId } = body;
  const indice = Number.isInteger(body.indice) ? (body.indice as number) : 0;
  if (!briefId || indice < 0) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const { data: fila } = await supabase
    .from("eval_briefs")
    .select("id, corrida_id, looks, tryons")
    .eq("id", briefId)
    .maybeSingle();
  if (!fila) return NextResponse.json({ error: "sin_brief" }, { status: 404 });

  // El avatar es el del DUEÑO DEL CLÓSET, no el del admin que mira: son SUS
  // prendas, y vestir a otra persona con ellas sería otra imagen y otra
  // pregunta. Además el avatar vive en su bucket privado — firmarlo desde otra
  // sesión fallaría a medias y produciría un render mentiroso.
  const { data: corrida } = await supabase
    .from("eval_corridas")
    .select("closet_user_id")
    .eq("id", fila.corrida_id as string)
    .single();
  if (!corrida) return NextResponse.json({ error: "sin_corrida" }, { status: 404 });
  const duenoId = corrida.closet_user_id as string;
  if (duenoId !== perfil.id) {
    return NextResponse.json({ error: "closet_ajeno" }, { status: 400 });
  }

  type Look = { item_ids: string[]; tip?: string | null };
  const look = ((fila.looks as Look[] | null) ?? [])[indice];
  if (!look?.item_ids?.length) {
    return NextResponse.json({ error: "sin_look" }, { status: 404 });
  }

  const previos = (fila.tryons as Record<string, string> | null) ?? {};
  const r = await generarTryon({
    supabase,
    userId: duenoId,
    itemIds: look.item_ids,
    tip: look.tip ?? null,
    cachePath: `${duenoId}/tryons/eval-${fila.id}-${indice}.jpg`,
    yaGenerado: previos[String(indice)] ?? null,
    origin: request.nextUrl.origin,
  });
  if ("error" in r) {
    // El motivo real (500 de Google, timeout, filtro…): sin él, "está fallando
    // el render" no se diagnostica sin salir a interrogar la API a mano.
    return NextResponse.json({ error: r.error, detalle: r.detalle });
  }
  if (!r.cached) {
    await supabase
      .from("eval_briefs")
      .update({
        tryons: { ...previos, [String(indice)]: `${duenoId}/tryons/eval-${fila.id}-${indice}.jpg` },
      })
      .eq("id", fila.id as string);
  }
  return NextResponse.json({ image: r.image });
}
