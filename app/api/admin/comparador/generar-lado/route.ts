import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cargarBaseDelMotor, construirContexto } from "@/lib/engine/contexto";
import { armarLooks } from "@/lib/engine/pipeline";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { MODELO_MOTOR, MODELO_JUEZ } from "@/lib/models";
import { modeloPorId } from "@/lib/proveedores/catalogo";
import { ErrorProveedor } from "@/lib/proveedores";
import {
  opcionesDeVariante,
  type BriefMotor,
  type VarianteMotor,
} from "@/lib/comparador/motor";

export const maxDuration = 60;

// UN lado: una variante del motor resolviendo un brief. La pantalla los pide
// de a poco desde el navegador, igual que las lecturas del comparador de
// visión, y por las mismas dos razones: Vercel corta a los 60s (un lado cabe,
// una corrida entera no), y cerrar la pestaña deja de gastar.
//
// LO QUE CORRE AQUÍ ES EL PIPELINE DE PRODUCCIÓN — cargarBaseDelMotor +
// construirContexto + armarLooks, los mismos archivos que /api/generate — con
// dos diferencias deliberadas: el brief FIJA clima/ocasión (en producción
// vienen del día real), y no se guarda nada en outfits ni en events (correr un
// experimento no debe ensuciar el historial ni el flywheel de nadie).

export async function POST(request: NextRequest) {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  let body: { corridaId?: string; parId?: string; variante?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { corridaId, parId, variante } = body;
  if (!corridaId || !parId || !variante) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  // Si ya se generó, no se vuelve a cobrar: la corrida es reintentable (si se
  // cae la conexión a la mitad, recargar sigue desde donde iba).
  const { data: previo } = await supabase
    .from("comparador_motor_lados")
    .select("id")
    .eq("par_id", parId)
    .eq("variante", variante)
    .maybeSingle();
  if (previo) return NextResponse.json({ ok: true, yaEstaba: true });

  const [{ data: corrida }, { data: par }] = await Promise.all([
    supabase
      .from("comparador_motor_corridas")
      .select("variantes, prompt_version, closet_user_id, estado")
      .eq("id", corridaId)
      .single(),
    supabase
      .from("comparador_motor_pares")
      // El par se pide CON su corrida y se verifica abajo: sin eso, un parId de
      // otra corrida escribiría un lado huérfano (invisible para las dos) y el
      // unique(par_id, variante) bloquearía regenerar el correcto para siempre.
      .select("id, corrida_id, brief, repite_de")
      .eq("id", parId)
      .single(),
  ]);
  if (!corrida || !par) return NextResponse.json({ error: "sin_corrida" }, { status: 404 });
  if (par.corrida_id !== corridaId) {
    return NextResponse.json({ error: "par_de_otra_corrida" }, { status: 400 });
  }

  // El freno de mano es de verdad: una corrida abortada o cerrada no acepta
  // más generación (que cuesta dinero) aunque el cliente re-mande el POST.
  if (corrida.estado !== "corriendo") {
    return NextResponse.json({ error: "corrida_no_corriendo" }, { status: 409 });
  }

  // Los espejos no generan: heredan los looks de su original. Generarles lados
  // propios mediría varianza del motor, no consistencia del juez.
  if (par.repite_de) return NextResponse.json({ ok: true, espejo: true });

  // Si el prompt cambió a mitad de la corrida, los pares nuevos medirían OTRO
  // motor que los viejos y el marcador sumaría peras con manzanas. Mejor
  // pararse aquí con un error que se entiende.
  if (corrida.prompt_version !== PROMPT_VERSION) {
    return NextResponse.json(
      { error: "prompt_cambio", detalle: `la corrida es de ${corrida.prompt_version} y el código ya va en ${PROMPT_VERSION} — abre una corrida nueva` },
      { status: 409 }
    );
  }

  const v = (corrida.variantes as VarianteMotor[]).find((x) => x.clave === variante);
  if (!v) return NextResponse.json({ error: "variante_desconocida" }, { status: 400 });

  // El MISMO traductor variante→opciones que usa el smoke (opcionesDeVariante):
  // null = su modeloId ya no existe en el catálogo.
  const opciones = opcionesDeVariante(v, modeloPorId);
  if (!opciones) {
    return NextResponse.json({ error: "modelo_desconocido" }, { status: 400 });
  }

  // V1: el clóset es el del admin que corre (closet_user_id se guarda ya
  // pensando en corridas sobre otros clósets, pero firmar imágenes ajenas y el
  // RLS de storage son otra conversación).
  const closetUserId = corrida.closet_user_id as string;
  if (closetUserId !== perfil.id) {
    return NextResponse.json({ error: "closet_ajeno" }, { status: 400 });
  }

  const brief = par.brief as BriefMotor;

  // Un fallo de UNA variante no tumba la corrida: se guarda como error y la
  // comparación sigue — que una variante truene ES un resultado.
  try {
    const carga = await cargarBaseDelMotor(supabase, closetUserId);
    if ("error" in carga) {
      throw new Error("closet_vacio");
    }
    const ctx = construirContexto(carga.base, {
      objective: brief.objective,
      momento: brief.momento,
      weather: brief.weather,
    });

    const t0 = Date.now();
    const { finalized, reviews, recibos } = await armarLooks(ctx, opciones);
    const ms = Date.now() - t0;

    const tokens = recibos.reduce(
      (a, r) => ({ entrada: a.entrada + r.tokens.entrada, salida: a.salida + r.tokens.salida }),
      { entrada: 0, salida: 0 }
    );
    const costo = recibos.reduce<number | null>(
      (a, r) => (r.costoUsd == null ? a : (a ?? 0) + r.costoUsd),
      null
    );

    // El insert SE VERIFICA: aquí adentro va una generación ya pagada
    // (~$0.25). Tragarse un fallo de escritura la tiraría en silencio y el
    // reintento pagaría OTRA. El choque con unique(par_id, variante) —dos
    // clicks, dos pestañas— sí es benigno: el lado ya existe, no se recobra.
    const { error: eInsert } = await supabase.from("comparador_motor_lados").insert({
      corrida_id: corridaId,
      par_id: parId,
      variante,
      looks: finalized,
      reviews,
      // El modelo RESUELTO de cada llamada, congelado en la fila: sin esto, un
      // cambio a lib/models.ts a media corrida (pueden pasar días entre
      // bloques) mezclaría dos motores en el mismo marcador sin dejar rastro.
      modelo_generador: opciones.modelo?.id ?? MODELO_MOTOR.id,
      modelo_juez: MODELO_JUEZ.id,
      tokens_entrada: tokens.entrada,
      tokens_salida: tokens.salida,
      costo_usd: costo,
      ms,
    });
    if (eInsert) {
      if (eInsert.code === "23505") return NextResponse.json({ ok: true, yaEstaba: true });
      return NextResponse.json(
        { error: "no_se_guardo", detalle: eInsert.message.slice(0, 200) },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
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
      // Ni el error se pudo anotar: que el cliente lo vea y el lado siga
      // pendiente para reintentar.
      return NextResponse.json(
        { error: "no_se_guardo", detalle: detalle.slice(0, 200) },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, fallo: detalle.slice(0, 200) });
  }
}
