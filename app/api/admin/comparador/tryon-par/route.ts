import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generarTryon } from "@/lib/tryon";

export const maxDuration = 60;

// Los DOS lados de un par, puestos en tu avatar. Por par y nunca por lado
// suelto: renderear uno solo dejaría al otro compitiendo con una cuadrícula de
// prendas, y el voto mediría el formato de presentación en vez del look.
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

  let body: { parId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { parId } = body;
  if (!parId) return NextResponse.json({ error: "faltan_datos" }, { status: 400 });

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
    .select("id, variante, looks, tryon_path")
    .eq("par_id", ladosDe);
  if (!lados?.length) return NextResponse.json({ error: "sin_lados" }, { status: 404 });

  // Se renderea el PRIMER look de cada lado: es el que la usuaria vería
  // arriba, y rendear los tres multiplicaría costo y espera por nada.
  type Look = { item_ids: string[]; tip?: string | null };
  const resultados = await Promise.all(
    lados.map(async (l) => {
      const primero = ((l.looks as Look[] | null) ?? [])[0];
      if (!primero?.item_ids?.length) {
        return { variante: l.variante as string, error: "sin_looks" };
      }
      const cachePath = `${duenoId}/tryons/comparador-${l.id}.jpg`;
      const r = await generarTryon({
        supabase,
        userId: duenoId,
        itemIds: primero.item_ids,
        tip: primero.tip ?? null,
        cachePath,
        yaGenerado: (l.tryon_path as string | null) ?? null,
        origin: request.nextUrl.origin,
      });
      if ("error" in r) return { variante: l.variante as string, error: r.error };
      if (!r.cached) {
        await supabase
          .from("comparador_motor_lados")
          .update({ tryon_path: cachePath })
          .eq("id", l.id);
      }
      return { variante: l.variante as string, image: r.image };
    })
  );

  // La respuesta va por VARIANTE; la pantalla la mapea a izquierda/derecha con
  // el mismo orden del ciego (ordenDelPar). Así el try-on no puede delatar
  // cuál lado es cuál.
  const porVariante: Record<string, { image?: string; error?: string }> = {};
  for (const r of resultados) {
    porVariante[r.variante] = "image" in r ? { image: r.image } : { error: r.error };
  }
  return NextResponse.json({ ok: true, porVariante });
}
