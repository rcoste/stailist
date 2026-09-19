// LOS LOOKS QUE ROBERTO VOTÓ, reconstruidos desde el comparador.
//
// POR QUÉ VIVE AQUÍ Y NO DENTRO DE UN SCRIPT. Nació dentro de
// `scripts/examen-juez.ts` y era suyo mientras hubo UN examen. En el momento en
// que un segundo examen necesita exactamente los mismos casos —el retador de
// Jev— copiarlo sería garantizar que los dos exámenes midan sobre universos
// que se separan en silencio: basta que uno filtre distinto para que "js7 caza
// más" signifique "js7 vio looks más fáciles".
//
// EL UNIVERSO es 83% positivo, así que el acierto global engaña: un juez que
// dijera "todo bien" acertaría 72%. La cifra que manda es siempre cuántos 👎
// caza, con su falsa alarma al lado.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CriticaStylist } from "@/lib/engine/juez-stylist";
import type { BriefMotor, LookMotor } from "@/lib/comparador/motor";

export type CasoVotado = {
  ladoId: string;
  /** El par y la variante: para medir si el juez prefiere el MISMO lado que Roberto. */
  parId: string;
  variante: string;
  indice: number;
  ronda: string;
  /** Cuándo se creó la ronda: separa lo que el juez vio al afinarse de lo que no. */
  creada: string;
  brief: BriefMotor;
  look: LookMotor;
  marca: "arriba" | "abajo";
  comentario: string | null;
  /** La crítica de js7 que quedó guardada en su ronda. `null` si esa ronda corrió sin juez. */
  critica: CriticaStylist | null;
};

/** Último día de votos que se usaron para afinar el juez vigente (js5). */
export const FIN_DEL_AFINADO = "2026-08-23T00:00:00Z";

export type CorridaVotada = { id: string; closet_user_id: string; creada: string };

/**
 * Devuelve los casos y las corridas de donde salieron (el dueño del clóset vive
 * ahí, y los dos exámenes lo necesitan para reconstruir el perfil).
 */
export async function cargarCasosVotados(
  s: SupabaseClient
): Promise<{ casos: CasoVotado[]; corridas: CorridaVotada[] }> {
  const { data } = await s
    .from("comparador_motor_corridas")
    .select("id, closet_user_id, creada")
    .order("creada");
  const corridas = (data ?? []) as CorridaVotada[];
  const casos: CasoVotado[] = [];

  for (const c of corridas) {
    const [{ data: pares }, { data: lados }] = await Promise.all([
      s.from("comparador_motor_pares").select("id, brief, marcas_look, comentarios_look").eq("corrida_id", c.id),
      s.from("comparador_motor_lados").select("id, par_id, variante, looks, criticas").eq("corrida_id", c.id),
    ]);
    for (const p of pares ?? [])
      for (const l of (lados ?? []).filter((x) => x.par_id === p.id)) {
        const looks = (l.looks as LookMotor[] | null) ?? [];
        const criticas = (l.criticas as CriticaStylist[] | null) ?? [];
        const marcas = (p.marcas_look as Record<string, Record<string, string>> | null)?.[l.variante as string] ?? {};
        const coms = (p.comentarios_look as Record<string, Record<string, string>> | null)?.[l.variante as string] ?? {};
        looks.forEach((look, i) => {
          const marca = marcas[String(i)];
          if (marca !== "arriba" && marca !== "abajo") return;
          // Sin nombres congelados no hay cómo reconstruir el look (los ids
          // murieron con el clóset del 08-18): fuera del examen, y se dice.
          if (!look.prendas) return;
          casos.push({
            ladoId: l.id as string,
            parId: p.id as string,
            variante: l.variante as string,
            indice: i,
            ronda: c.id.slice(0, 8),
            creada: c.creada,
            brief: p.brief as BriefMotor,
            look,
            marca,
            comentario: coms[String(i)] ?? null,
            critica: criticas[i] ?? null,
          });
        });
      }
  }
  return { casos, corridas };
}

/**
 * LA MUESTRA DE UN EXAMEN, en un solo lugar y por la misma razón que el
 * cargador: dos exámenes que muestrean distinto no se pueden comparar, y la
 * diferencia no se ve en ninguna tabla.
 *
 * Sale de las rondas POSTERIORES al afinado (las que ningún juez vio al
 * calibrarse) y se toma a paso fijo, no al azar: dos corridas del mismo N miden
 * los MISMOS looks, que es lo que permite comparar una versión con otra.
 */
export function muestrearParaExamen(casos: CasoVotado[], limite: number): CasoVotado[] {
  if (limite <= 0) return casos;
  const universo = casos.filter((c) => c.creada > FIN_DEL_AFINADO);
  const paso = Math.max(1, Math.floor(universo.length / limite));
  return universo.filter((_, i) => i % paso === 0).slice(0, limite);
}
