import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "@/lib/engine/contexto";
import { armarLooks } from "@/lib/engine/pipeline";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { MODELO_MOTOR, MODELO_JUEZ } from "@/lib/models";
import { modeloPorId } from "@/lib/proveedores/catalogo";
import { ErrorProveedor } from "@/lib/proveedores";
import {
  opcionesDeVariante,
  peticionDeBrief,
  type BriefMotor,
  type VarianteMotor,
} from "./motor";

// Generar UN lado (una variante resolviendo un brief) y guardarlo con su
// recibo. Vivía dentro de la ruta admin; se extrajo para que también lo pueda
// llamar un script —dejar una corrida generada de madrugada para que Roberto
// solo llegue a votar— sin volver a escribir el mismo camino.
//
// Es la misma regla de siempre: la ruta pone HTTP y sesión, el script pone el
// cliente de servicio, y el trabajo real vive en un solo archivo.
//
// LO QUE NO SE ACUMULA, Y ES A PROPÓSITO
// Cada lado carga el contexto DESDE CERO, así que los 6 briefs de una corrida
// ven el MISMO historial de 14 días: el brief 4 no sabe que existió el 1. En la
// vida real la rotación sí se acumula día con día.
//
// No acumular es lo correcto AQUÍ: si el historial creciera, habría que decidir
// el de quién —el de la variante A o el de la B, que generan looks distintos— y
// para el tercer brief estarían en estados diferentes. Dejarían de compararse
// bajo condiciones idénticas, que es lo único que hace válido el experimento.
//
// El costo de esa decisión: dentro de una corrida se ve más repetición de
// prendas entre pares de la que se vería en 6 días seguidos de uso real.

export type ResultadoLado =
  | { ok: true; yaEstaba?: true; espejo?: true }
  | { ok: true; fallo: string }
  | { error: string; status: number; detalle?: string };

export async function generarLadoYGuardar(opciones: {
  supabase: SupabaseClient;
  corridaId: string;
  parId: string;
  variante: string;
  /** Quién pide. Debe ser el dueño del clóset de la corrida. */
  actorId: string;
}): Promise<ResultadoLado> {
  const { supabase, corridaId, parId, variante, actorId } = opciones;

  // Si ya se generó, no se vuelve a cobrar: la corrida es reintentable.
  const { data: previo } = await supabase
    .from("comparador_motor_lados")
    .select("id")
    .eq("par_id", parId)
    .eq("variante", variante)
    .maybeSingle();
  if (previo) return { ok: true, yaEstaba: true };

  const [{ data: corrida }, { data: par }] = await Promise.all([
    supabase
      .from("comparador_motor_corridas")
      .select("variantes, prompt_version, closet_user_id, estado")
      .eq("id", corridaId)
      .single(),
    supabase
      // El par se pide CON su corrida y se verifica: sin eso, un parId de otra
      // corrida escribiría un lado huérfano (invisible para las dos) y el
      // unique(par_id, variante) bloquearía regenerar el correcto para siempre.
      .from("comparador_motor_pares")
      .select("id, corrida_id, brief, repite_de")
      .eq("id", parId)
      .single(),
  ]);
  if (!corrida || !par) return { error: "sin_corrida", status: 404 };
  if (par.corrida_id !== corridaId) return { error: "par_de_otra_corrida", status: 400 };

  // El freno de mano es de verdad: una corrida abortada o cerrada no acepta
  // más generación (que cuesta dinero) aunque el cliente re-mande la petición.
  if (corrida.estado !== "corriendo") {
    return { error: "corrida_no_corriendo", status: 409 };
  }

  // Los espejos no generan: heredan los looks de su original. Generarles lados
  // propios mediría varianza del motor, no consistencia del juez.
  if (par.repite_de) return { ok: true, espejo: true };

  // Si el prompt cambió a mitad de la corrida, los pares nuevos medirían OTRO
  // motor que los viejos y el marcador sumaría peras con manzanas.
  if (corrida.prompt_version !== PROMPT_VERSION) {
    return {
      error: "prompt_cambio",
      status: 409,
      detalle: `la corrida es de ${corrida.prompt_version} y el código ya va en ${PROMPT_VERSION} — abre una corrida nueva`,
    };
  }

  const v = (corrida.variantes as VarianteMotor[]).find((x) => x.clave === variante);
  if (!v) return { error: "variante_desconocida", status: 400 };

  const opcionesGen = opcionesDeVariante(v, modeloPorId);
  if (!opcionesGen) return { error: "modelo_desconocido", status: 400 };

  const closetUserId = corrida.closet_user_id as string;
  if (closetUserId !== actorId) return { error: "closet_ajeno", status: 400 };

  const brief = par.brief as BriefMotor;

  // Un fallo de UNA variante no tumba la corrida: se guarda como error y la
  // comparación sigue — que una variante truene ES un resultado.
  try {
    const carga = await cargarBaseDelMotor(supabase, closetUserId);
    if ("error" in carga) throw new Error("closet_vacio");

    // El brief traducido por el ÚNICO traductor (peticionDeBrief): plan,
    // formalidad y paraguas viajan por los mismos campos que usa producción.
    const ctx = construirContexto(carga.base, peticionDeBrief(brief));

    const t0 = Date.now();
    // El `null` del final NO es descuido: el comparador corre el pipeline de
    // producción a propósito, pero sus llamadas no son de nadie. Registrarlas
    // en ai_calls mezclaría corridas de laboratorio —modelos raros, prompts
    // viejos, variantes que perdieron— con lo que la gente pide de verdad, y la
    // tabla existe justo para contestar cuánto cuesta y tarda ESO.
    const { finalized, reviews, recibos } = await armarLooks(ctx, opcionesGen, {}, null);
    const ms = Date.now() - t0;

    const tokens = recibos.reduce(
      (a, r) => ({ entrada: a.entrada + r.tokens.entrada, salida: a.salida + r.tokens.salida }),
      { entrada: 0, salida: 0 }
    );
    const costo = recibos.reduce<number | null>(
      (a, r) => (r.costoUsd == null ? a : (a ?? 0) + r.costoUsd),
      null
    );

    // El insert SE VERIFICA: aquí adentro va una generación ya pagada. Tragarse
    // un fallo de escritura la tiraría en silencio y el reintento pagaría OTRA.
    // El choque con unique(par_id, variante) sí es benigno: el lado ya existe.
    const { error: eInsert } = await supabase.from("comparador_motor_lados").insert({
      corrida_id: corridaId,
      par_id: parId,
      variante,
      looks: conNombres(finalized, ctx.items),
      reviews,
      // El modelo RESUELTO, congelado en la fila: sin esto, un cambio a
      // lib/models.ts a media corrida mezclaría dos motores sin dejar rastro.
      modelo_generador: opcionesGen.modelo?.id ?? MODELO_MOTOR.id,
      modelo_juez: MODELO_JUEZ.id,
      tokens_entrada: tokens.entrada,
      tokens_salida: tokens.salida,
      costo_usd: costo,
      ms,
    });
    if (eInsert) {
      if (eInsert.code === "23505") return { ok: true, yaEstaba: true };
      return { error: "no_se_guardo", status: 500, detalle: eInsert.message.slice(0, 200) };
    }
    return { ok: true };
  } catch (e) {
    const detalle =
      e instanceof ErrorProveedor ? e.message : e instanceof Error ? e.message : "falló";
    const { error: eInsert } = await supabase.from("comparador_motor_lados").insert({
      corrida_id: corridaId,
      par_id: parId,
      variante,
      error: detalle.slice(0, 500),
    });
    if (eInsert && eInsert.code !== "23505") {
      // Ni el error se pudo anotar: que quien llama lo vea y el lado siga
      // pendiente para reintentar.
      return { error: "no_se_guardo", status: 500, detalle: detalle.slice(0, 200) };
    }
    return { ok: true, fallo: detalle.slice(0, 200) };
  }
}

/**
 * Congela el nombre de cada prenda dentro del look guardado. Ver
 * LookMotor.prendas: sin esto, el histórico del comparador muere con el
 * siguiente reseteo de clóset (pasó el 2026-08-18: 393 votos huérfanos).
 */
export function conNombres<L extends { item_ids: string[] }>(
  looks: L[],
  items: { id: string; attrs: { nombre?: string | null } }[]
): (L & { prendas: { id: string; nombre: string }[] })[] {
  const porId = new Map(items.map((i) => [i.id, i.attrs.nombre ?? "Prenda"]));
  return looks.map((l) => ({
    ...l,
    prendas: l.item_ids.map((id) => ({ id, nombre: porId.get(id) ?? "Prenda" })),
  }));
}
