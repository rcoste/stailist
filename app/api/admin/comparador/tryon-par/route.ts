import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generarTryon } from "@/lib/tryon";

export const maxDuration = 60;

// Los DOS lados de un par en el MISMO índice de look, puestos en tu avatar.
// Nunca un lado suelto: renderear uno solo dejaría al otro compitiendo con una
// cuadrícula de prendas, y el juicio mediría el formato en vez del look. Por
// eso se pide {parId, indice} y salen los dos.
//
// Bajo demanda, no automático. El render puede decidir el voto en lugar del
// outfit —uno correcto se ve mal con un render pobre— así que el default sigue
// siendo la cuadrícula (que mide la composición, lo que el motor decide) y
// esto se pide cuando la cuadrícula no alcanza.
//
// Llama a lib/tryon.ts, el MISMO núcleo que /api/tryon de producción: el
// prompt, las referencias de identidad y el guard de prendas sin imagen son
// los de verdad, no una copia.

export async function POST(request: NextRequest) {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  let body: { parId?: string; indice?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { parId } = body;
  // El look dentro del lado. Sin índice, el primero (compatibilidad).
  const indice = Number.isInteger(body.indice) ? (body.indice as number) : 0;
  if (!parId || indice < 0) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const { data: par } = await supabase
    .from("comparador_motor_pares")
    .select("id, corrida_id, repite_de")
    .eq("id", parId)
    .maybeSingle();
  if (!par) return NextResponse.json({ error: "sin_par" }, { status: 404 });

  // El avatar es el del DUEÑO DEL CLÓSET, no el del admin que está mirando:
  // son SUS prendas, y vestir a otra persona con ellas sería otra imagen y
  // otra pregunta. Hoy siempre coinciden (la generación exige que el clóset
  // sea del admin que corre), pero atarlo a la corrida evita que un segundo
  // admin abriendo la pantalla renderee con su propia cara.
  const { data: corrida } = await supabase
    .from("comparador_motor_corridas")
    .select("closet_user_id")
    .eq("id", par.corrida_id)
    .single();
  if (!corrida) return NextResponse.json({ error: "sin_corrida" }, { status: 404 });
  const duenoId = corrida.closet_user_id as string;
  if (duenoId !== perfil.id) {
    // El avatar y sus prendas viven en el bucket privado del dueño: firmarlas
    // desde otra sesión fallaría a medias y produciría un render mentiroso.
    return NextResponse.json({ error: "closet_ajeno" }, { status: 400 });
  }

  // Los espejos no tienen lados propios: heredan los de su original, y por lo
  // tanto también su try-on (son los MISMOS looks).
  const ladosDe = (par.repite_de as string | null) ?? (par.id as string);

  const { data: lados } = await supabase
    .from("comparador_motor_lados")
    .select("id, variante, looks, tryons")
    .eq("par_id", ladosDe);
  if (!lados?.length) return NextResponse.json({ error: "sin_lados" }, { status: 404 });

  type Look = { item_ids: string[]; tip?: string | null };
  const resultados = await Promise.all(
    lados.map(async (l) => {
      const look = ((l.looks as Look[] | null) ?? [])[indice];
      if (!look?.item_ids?.length) {
        return { variante: l.variante as string, error: "sin_looks" };
      }
      const previos = (l.tryons as Record<string, string> | null) ?? {};
      const cachePath = `${duenoId}/tryons/comparador-${l.id}-${indice}.jpg`;
      const r = await generarTryon({
        supabase,
        userId: duenoId,
        itemIds: look.item_ids,
        tip: look.tip ?? null,
        cachePath,
        yaGenerado: previos[String(indice)] ?? null,
        origin: request.nextUrl.origin,
      });
      if ("error" in r)
        return {
          variante: l.variante as string,
          error: r.error,
          // El motivo real (HTTP 500 de Google, timeout, filtro…). Sin esto,
          // "está fallando el render" no se puede diagnosticar sin salir a
          // interrogar la API a mano.
          detalle: r.detalle,
        };
      if (!r.cached) {
        await supabase
          .from("comparador_motor_lados")
          .update({ tryons: { ...previos, [String(indice)]: cachePath } })
          .eq("id", l.id);
      }
      return { variante: l.variante as string, image: r.image };
    })
  );

  // La respuesta va por VARIANTE; la pantalla la mapea a izquierda/derecha con
  // el mismo orden del ciego (ordenDelPar). Así el try-on no puede delatar
  // cuál lado es cuál.
  const porVariante: Record<
    string,
    { image?: string; error?: string; detalle?: string }
  > = {};
  for (const r of resultados) {
    porVariante[r.variante] =
      "image" in r ? { image: r.image } : { error: r.error, detalle: r.detalle };
  }
  return NextResponse.json({ ok: true, indice, porVariante });
}
