"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import {
  briefsPara,
  nRepetidos,
  ordenDelPar,
  variantePorClave,
  DEFECTOS_MOTOR,
  MIN_VEREDICTO,
  MAX_VEREDICTO,
  type TamanoCorrida,
  type VarianteMotor,
} from "@/lib/comparador/motor";

// Abrir una corrida de motor, votar un par, cerrarla.

/**
 * Abre la corrida COMPLETA: corrida + todos sus pares (briefs) + los espejos.
 * A diferencia del comparador de visión (donde las fotos entran una por una),
 * aquí todo el plan cabe en una llamada: los briefs son texto, no imágenes.
 *
 * La generación NO pasa por aquí: la pantalla pide lado por lado a
 * /api/admin/comparador/generar-lado, para caber en los 60s de Vercel y para
 * que cerrar la pestaña deje de gastar.
 */
export async function abrirCorridaMotor(input: {
  tamano: TamanoCorrida;
  nPares: number;
  varianteA: string;
  varianteB: string;
  regla?: string;
}): Promise<{ id: string } | { error: string }> {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  const va = variantePorClave(input.varianteA);
  const vb = variantePorClave(input.varianteB);
  if (!va || !vb) return { error: "Elige dos variantes de la lista." };
  if (va.clave === vb.clave) return { error: "Las dos variantes son la misma." };

  const regla = input.regla?.trim() ?? "";
  let n = input.nPares;
  if (input.tamano === "veredicto") {
    if (n < MIN_VEREDICTO || n > MAX_VEREDICTO) {
      return { error: `Un veredicto va de ${MIN_VEREDICTO} a ${MAX_VEREDICTO} pares.` };
    }
    // La regla se escribe ANTES de votar o no hay veredicto. Explicar la
    // derrota después de verla es exactamente lo que el pre-registro mata.
    if (!regla) {
      return { error: "Escribe la regla ANTES de correr: qué cuenta como ganar y qué haces si no gana." };
    }
  } else {
    n = 6; // el vistazo es chico a propósito: defectos y reglas, nunca ganador
  }

  // Las variantes se CONGELAN en la corrida: editar el catálogo mañana no debe
  // reescribir lo que significó una corrida de hoy.
  const variantes: VarianteMotor[] = [va, vb];

  const { data: corrida, error } = await supabase
    .from("comparador_motor_corridas")
    .insert({
      user_id: perfil.id,
      closet_user_id: perfil.id,
      tamano: input.tamano,
      variantes,
      prompt_version: PROMPT_VERSION,
      regla: regla || null,
    })
    .select("id")
    .single();
  if (error || !corrida) return { error: error?.message ?? "no se pudo crear" };

  // Si los pares no se pueden crear, la corrida NO puede quedar viva a medias:
  // una corrida "corriendo" sin pares es un cascarón que confunde la lista.
  const borrarCorrida = () =>
    supabase.from("comparador_motor_corridas").delete().eq("id", corrida.id);

  const briefs = briefsPara(input.tamano, n);
  const { data: pares, error: eParas } = await supabase
    .from("comparador_motor_pares")
    .insert(briefs.map((brief, i) => ({ corrida_id: corrida.id, n: i + 1, brief })))
    .select("id, n");
  if (eParas || !pares) {
    await borrarCorrida();
    return { error: eParas?.message ?? "no se pudieron crear los pares" };
  }

  // Los espejos (~10% en veredicto): repiten un par con el orden invertido y
  // SIN volver a generar. Van al final, lo más lejos posible de su original,
  // y con el mismo brief — etiquetarlos "espejo" rompería el ciego.
  const reps = nRepetidos(input.tamano, n);
  if (reps > 0) {
    const ordenados = [...pares].sort((a, b) => (a.n as number) - (b.n as number));
    const espejos = Array.from({ length: reps }, (_, k) => {
      const original = ordenados[Math.floor(((k + 0.5) * n) / reps)];
      return {
        corrida_id: corrida.id,
        n: n + k + 1,
        brief: briefs[(original.n as number) - 1],
        repite_de: original.id,
      };
    });
    const { error: eEspejos } = await supabase
      .from("comparador_motor_pares")
      .insert(espejos);
    if (eEspejos) {
      // Un veredicto sin espejos perdería la métrica de consistencia sin que
      // nadie lo note: mejor no dejar nacer la corrida (el cascade limpia los pares).
      await borrarCorrida();
      return { error: eEspejos.message };
    }
  }

  revalidatePath("/admin/comparador");
  return { id: corrida.id as string };
}

/**
 * Guarda el voto de un par, YA RESUELTO al nombre real de la variante: el
 * cliente manda "izq"/"der"/"empate" y aquí se deshace el barajeo del ciego.
 * Guardar izquierda/derecha a secas dejaría el resultado dependiente de cómo
 * se pintó la pantalla ese día.
 *
 * Se guarda a cada voto, sin botón de guardar: son decenas seguidas y un botón
 * es una oportunidad más de perderlos.
 */
export async function votarParMotor(
  parId: string,
  eleccion: "izq" | "der" | "empate",
  defectos: { izq?: string[]; der?: string[] },
  nota?: string,
  /**
   * Diagnóstico por look: qué look de cada lado sirve y cuál no, por posición.
   * NO es la unidad del veredicto (los looks de un lado salen de una sola
   * llamada, no son independientes) — es lo que dice cuál arrastró el voto.
   */
  marcas?: { izq?: Record<number, "arriba" | "abajo">; der?: Record<number, "arriba" | "abajo"> }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  // Las server actions son endpoints: el payload se valida aquí, no se confía
  // en que la pantalla mande bien.
  if (eleccion !== "izq" && eleccion !== "der" && eleccion !== "empate") {
    return { ok: false, error: "elección inválida" };
  }
  const TAGS_VALIDOS = new Set<string>(DEFECTOS_MOTOR.map((d) => d.clave));
  const limpiar = (xs?: string[]) => (xs ?? []).filter((x) => TAGS_VALIDOS.has(x));

  const { data: par } = await supabase
    .from("comparador_motor_pares")
    .select("id, corrida_id, repite_de")
    .eq("id", parId)
    .maybeSingle();
  if (!par) return { ok: false, error: "no existe ese par" };

  const { data: corrida } = await supabase
    .from("comparador_motor_corridas")
    .select("variantes, estado")
    .eq("id", par.corrida_id)
    .single();
  if (!corrida) return { ok: false, error: "no existe la corrida" };
  if (corrida.estado === "cerrada") {
    return { ok: false, error: "la corrida ya está cerrada" };
  }

  const variantes = corrida.variantes as VarianteMotor[];

  // Un voto solo vale si el par de verdad tiene DOS lados comparables (con
  // looks). La pantalla ya lo filtra, pero las server actions son endpoints:
  // sin este check, un voto directo sobre un par con un lado tronado contaría
  // como victoria real en el marcador.
  const ladosDe = (par.repite_de as string | null) ?? (par.id as string);
  const { data: lados } = await supabase
    .from("comparador_motor_lados")
    .select("variante, looks")
    .eq("par_id", ladosDe);
  const completos = new Set(
    (lados ?? [])
      .filter((l) => Array.isArray(l.looks) && l.looks.length > 0)
      .map((l) => l.variante as string)
  );
  if (!variantes.every((v) => completos.has(v.clave))) {
    return { ok: false, error: "ese par no tiene los dos lados completos" };
  }

  // El MISMO helper que usó la pantalla para pintar (ordenDelPar): aquí se
  // deshace el ciego y el voto se guarda ya resuelto a la variante.
  const [izq, der] = ordenDelPar(
    par.id as string,
    (par.repite_de as string | null) ?? null,
    [variantes[0].clave, variantes[1].clave]
  );

  const voto = eleccion === "empate" ? "empate" : eleccion === "izq" ? izq : der;
  const porVariante: Record<string, string[]> = {};
  const dIzq = limpiar(defectos.izq);
  const dDer = limpiar(defectos.der);
  if (dIzq.length) porVariante[izq] = dIzq;
  if (dDer.length) porVariante[der] = dDer;

  // Las marcas por look se guardan resueltas a la variante, igual que el voto.
  const marcasPorVariante: Record<string, Record<string, string>> = {};
  const limpiarMarcas = (m?: Record<number, "arriba" | "abajo">) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(m ?? {})) {
      if ((v === "arriba" || v === "abajo") && Number.isInteger(Number(k))) out[k] = v;
    }
    return out;
  };
  const mIzq = limpiarMarcas(marcas?.izq);
  const mDer = limpiarMarcas(marcas?.der);
  if (Object.keys(mIzq).length) marcasPorVariante[izq] = mIzq;
  if (Object.keys(mDer).length) marcasPorVariante[der] = mDer;

  // `.is("voto", null)`: un par votado NO se re-vota. Sin esto, se podría
  // cambiar un voto después de ver el reveal — exactamente lo que el
  // pre-registro existe para impedir.
  const { data: filas, error } = await supabase
    .from("comparador_motor_pares")
    .update({
      voto,
      defectos: Object.keys(porVariante).length ? porVariante : null,
      marcas_look: Object.keys(marcasPorVariante).length ? marcasPorVariante : null,
      // 1500 y no 500: el porqué del voto es el dato más valioso de la
      // corrida — es lo que convierte "ganó A" en una regla. Cortarlo a dos
      // líneas invitaba a no escribirlo.
      nota: nota?.trim().slice(0, 1500) || null,
    })
    .eq("id", parId)
    .is("voto", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!filas?.length) return { ok: false, error: "ese par ya tenía voto — no se cambia" };
  return { ok: true };
}

/**
 * Añade las marcas 👍/👎 por look a un par YA VOTADO, sin tocar su voto.
 *
 * Existe porque las marcas por look llegaron a mitad de una corrida: los
 * primeros pares se votaron sin ellas y esa mitad quedó ciega. El voto sigue
 * siendo inmutable —eso es lo que protege el pre-registro—; lo que se completa
 * es el DIAGNÓSTICO, que nunca fue la unidad del veredicto.
 *
 * Funciona con la corrida cerrada a propósito: cerrar sella el resultado, no
 * las notas al margen.
 */
export async function completarMarcas(
  parId: string,
  marcas: { izq?: Record<number, "arriba" | "abajo">; der?: Record<number, "arriba" | "abajo"> }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: par } = await supabase
    .from("comparador_motor_pares")
    .select("id, corrida_id, repite_de, voto")
    .eq("id", parId)
    .maybeSingle();
  if (!par) return { ok: false, error: "no existe ese par" };
  if (!par.voto) {
    return { ok: false, error: "ese par no se ha votado — usa la pantalla de votación" };
  }

  const { data: corrida } = await supabase
    .from("comparador_motor_corridas")
    .select("variantes")
    .eq("id", par.corrida_id)
    .single();
  if (!corrida) return { ok: false, error: "no existe la corrida" };

  const variantes = corrida.variantes as VarianteMotor[];
  const [izq, der] = ordenDelPar(
    par.id as string,
    (par.repite_de as string | null) ?? null,
    [variantes[0].clave, variantes[1].clave]
  );

  const limpiar = (m?: Record<number, "arriba" | "abajo">) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(m ?? {})) {
      if ((v === "arriba" || v === "abajo") && Number.isInteger(Number(k))) out[k] = v;
    }
    return out;
  };
  const porVariante: Record<string, Record<string, string>> = {};
  const mIzq = limpiar(marcas.izq);
  const mDer = limpiar(marcas.der);
  if (Object.keys(mIzq).length) porVariante[izq] = mIzq;
  if (Object.keys(mDer).length) porVariante[der] = mDer;

  const { error } = await supabase
    .from("comparador_motor_pares")
    .update({ marcas_look: Object.keys(porVariante).length ? porVariante : null })
    .eq("id", parId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/comparador/motor/${par.corrida_id}`);
  return { ok: true };
}

export async function cambiarEstadoMotor(
  corridaId: string,
  estado: "corriendo" | "juzgando" | "cerrada",
  nota?: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  // "cerrada" es TERMINAL: reabrir una corrida después de ver el reveal es la
  // puerta que el pre-registro necesita tener cerrada. El .neq lo garantiza a
  // nivel de query, no de pantalla.
  const { data: filas, error } = await supabase
    .from("comparador_motor_corridas")
    .update({ estado, ...(nota !== undefined ? { nota } : {}) })
    .eq("id", corridaId)
    .neq("estado", "cerrada")
    .select("id");
  if (!error && !filas?.length) {
    return { ok: false, error: "la corrida ya está cerrada — no se reabre" };
  }
  // Revalidar solo si de verdad cambió: refrescar sobre un update fallido
  // pintaría la pantalla como si hubiera funcionado.
  if (!error) {
    revalidatePath("/admin/comparador");
    revalidatePath(`/admin/comparador/motor/${corridaId}`);
  }
  return { ok: !error, error: error?.message };
}

/**
 * Retoma una corrida para generar los pares que quedaron SIN generar.
 *
 * Solo para VISTAZOS, y la restricción es el punto: un vistazo por diseño no
 * declara ganador, así que ver su marcador antes de terminar no corrompe
 * ningún resultado pre-registrado. En un veredicto sí lo haría —seguir
 * generando después de ver quién va ganando contamina los votos que faltan—,
 * y por eso ahí "cerrada" sigue siendo terminal.
 *
 * Existe porque la pantalla de generación se cortó a media corrida sin dejar
 * claro cuántos pares faltaban (decía "6 de 12 lados" con el botón de parar
 * debajo), y los tres briefs restantes —frío, calor y lluvia, justo los que
 * más mueven el clóset— quedaron sin medir.
 */
export async function retomarGeneracion(
  corridaId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: corrida } = await supabase
    .from("comparador_motor_corridas")
    .select("tamano")
    .eq("id", corridaId)
    .maybeSingle();
  if (!corrida) return { ok: false, error: "no existe la corrida" };
  if (corrida.tamano !== "vistazo") {
    return {
      ok: false,
      error: "solo un vistazo se retoma: en un veredicto, generar después de ver el marcador contamina los votos que faltan",
    };
  }

  const { error } = await supabase
    .from("comparador_motor_corridas")
    .update({ estado: "corriendo" })
    .eq("id", corridaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/comparador/motor/${corridaId}`);
  return { ok: true };
}

/**
 * Reabre la generación para los lados que FALLARON (fila con error): borra
 * esas filas y regresa la corrida a "corriendo" para que la pantalla de
 * generación los reintente. Existe porque un 529 transitorio del proveedor no
 * es un resultado del motor — congelarlo para siempre convertiría una hora
 * mala de API en datos del experimento. Es una acción EXPLÍCITA del admin:
 * reintentar en automático podría re-pagar por una variante rota de verdad.
 */
export async function reintentarFallidos(
  corridaId: string
): Promise<{ ok: boolean; borrados?: number; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: corrida } = await supabase
    .from("comparador_motor_corridas")
    .select("estado")
    .eq("id", corridaId)
    .maybeSingle();
  if (!corrida) return { ok: false, error: "no existe la corrida" };
  if (corrida.estado === "cerrada") {
    return { ok: false, error: "la corrida ya está cerrada" };
  }

  const { data: borrados, error } = await supabase
    .from("comparador_motor_lados")
    .delete()
    .eq("corrida_id", corridaId)
    .not("error", "is", null)
    .select("id");
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("comparador_motor_corridas")
    .update({ estado: "corriendo" })
    .eq("id", corridaId)
    .neq("estado", "cerrada");

  revalidatePath(`/admin/comparador/motor/${corridaId}`);
  return { ok: true, borrados: borrados?.length ?? 0 };
}
