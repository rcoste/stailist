import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import {
  ordenDelPar,
  type BriefMotor,
  type LadoMotor,
  type LookMotor,
  type ParMotor,
  type TamanoCorrida,
  type VarianteMotor,
} from "./motor";

// Cargar una corrida de motor de la base. Aparte de motor.ts porque toca
// Supabase del servidor (misma razón que servidor.ts en el de visión).

/** Una prenda como la pantalla la pinta: nombre + swatch + imagen firmada. */
export type PrendaUI = {
  id: string;
  nombre: string;
  swatch: string;
  imagen: string | null;
};

export type CorridaMotorCargada = {
  id: string;
  tamano: TamanoCorrida;
  variantes: VarianteMotor[];
  promptVersion: string;
  /** El pool de briefs con el que se midió (v1 en las corridas anteriores). */
  poolVersion: string;
  regla: string | null;
  estado: string;
  nota: string | null;
  closetUserId: string;
  pares: ParMotor[];
  /**
   * El orden del CIEGO por par: las claves de variante en el orden en que la
   * pantalla las muestra como "Look A / Look B". Los espejos van SIEMPRE
   * invertidos respecto a su original — esa inversión es lo que miden.
   */
  ordenPorPar: Record<string, [string, string]>;
  prendas: Record<string, PrendaUI>;
};

export async function cargarCorridaMotor(
  corridaId: string
): Promise<CorridaMotorCargada | null> {
  const supabase = await createClient();

  const { data: corrida } = await supabase
    .from("comparador_motor_corridas")
    .select("*")
    .eq("id", corridaId)
    .maybeSingle();
  if (!corrida) return null;

  const [paresRes, ladosRes] = await Promise.all([
    supabase
      .from("comparador_motor_pares")
      .select("*")
      .eq("corrida_id", corridaId)
      .order("n"),
    supabase.from("comparador_motor_lados").select("*").eq("corrida_id", corridaId),
  ]);

  type FilaLado = {
    par_id: string;
    variante: string;
    looks: LookMotor[] | null;
    reviews: unknown;
    error: string | null;
    costo_usd: string | number | null;
    ms: number | null;
  };
  const porPar = new Map<string, LadoMotor[]>();
  for (const l of (ladosRes.data ?? []) as unknown as FilaLado[]) {
    const lado: LadoMotor = {
      variante: l.variante,
      looks: l.looks,
      reviews: l.reviews,
      error: l.error,
      costoUsd: l.costo_usd != null ? Number(l.costo_usd) : null,
      ms: l.ms,
    };
    if (!porPar.has(l.par_id)) porPar.set(l.par_id, []);
    porPar.get(l.par_id)!.push(lado);
  }

  const pares: ParMotor[] = (paresRes.data ?? []).map((p) => ({
    id: p.id as string,
    n: p.n as number,
    brief: p.brief as BriefMotor,
    repiteDe: (p.repite_de as string | null) ?? null,
    voto: (p.voto as string | null) ?? null,
    defectos: (p.defectos as Record<string, string[]> | null) ?? null,
    marcasLook: (p.marcas_look as Record<string, Record<string, string>> | null) ?? null,
    defectosLook:
      (p.defectos_look as Record<string, Record<string, string[]>> | null) ?? null,
    comentariosLook:
      (p.comentarios_look as Record<string, Record<string, string>> | null) ?? null,
    prefsLook: (p.prefs_look as Record<string, Record<string, string>> | null) ?? null,
    nota: (p.nota as string | null) ?? null,
    lados: porPar.get(p.id as string) ?? [],
  }));

  // Los espejos no tienen lados propios: heredan los del original.
  const porId = new Map(pares.map((p) => [p.id, p]));
  for (const p of pares) {
    if (p.repiteDe && p.lados.length === 0) {
      p.lados = porId.get(p.repiteDe)?.lados ?? [];
    }
  }

  const variantes = corrida.variantes as VarianteMotor[];
  const claves: [string, string] = [variantes[0]?.clave, variantes[1]?.clave] as [
    string,
    string,
  ];
  // El MISMO helper que usa votarParMotor para deshacer el ciego: si pantalla
  // y voto calcularan el orden por separado, una deriva atribuiría votos a la
  // variante equivocada sin tronar nada.
  const ordenPorPar: Record<string, [string, string]> = {};
  for (const p of pares) {
    ordenPorPar[p.id] = ordenDelPar(p.id, p.repiteDe, claves);
  }

  // Todas las prendas que aparecen en algún look, con imagen firmada. La misma
  // resolución que el producto (arquetipo → render → foto → swatch): calificar
  // looks con las prendas en swatch gris sería calificar otra cosa.
  const itemIds = Array.from(
    new Set(
      pares.flatMap((p) =>
        p.lados.flatMap((l) => (l.looks ?? []).flatMap((o) => o.item_ids))
      )
    )
  );
  const prendas: Record<string, PrendaUI> = {};
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("items")
      .select("id, photo_path, render_status, render_path, attrs, archetypes(name, image_path)")
      .in("id", itemIds);
    const list = items ?? [];

    const paths = list
      .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
      .filter((p): p is string => !!p);
    const firmadas = new Map<string, string>();
    if (paths.length > 0) {
      const { data } = await supabase.storage
        .from("prendas")
        .createSignedUrls(Array.from(new Set(paths)), 3600);
      data?.forEach((s) => {
        if (s.path && s.signedUrl) firmadas.set(s.path, s.signedUrl);
      });
    }
    for (const i of list) {
      const arch = i.archetypes as { name?: string; image_path?: string | null } | null;
      const attrs = (i.attrs ?? {}) as { nombre?: string; color_hex?: string };
      prendas[i.id as string] = {
        id: i.id as string,
        nombre: arch?.name ?? attrs.nombre ?? "Prenda",
        swatch: attrs.color_hex ?? "#E5E1DD",
        imagen: itemImageUrlSync(i as unknown as ItemImageRow, (p) => firmadas.get(p)),
      };
    }
  }

  return {
    id: corrida.id as string,
    tamano: corrida.tamano as TamanoCorrida,
    variantes,
    promptVersion: corrida.prompt_version as string,
    poolVersion: (corrida.pool_version as string | null) ?? "v1",
    regla: (corrida.regla as string | null) ?? null,
    estado: corrida.estado as string,
    nota: (corrida.nota as string | null) ?? null,
    closetUserId: corrida.closet_user_id as string,
    pares,
    ordenPorPar,
    prendas,
  };
}
