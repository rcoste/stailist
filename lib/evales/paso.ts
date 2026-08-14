import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "@/lib/engine/contexto";
import { armarLooks } from "@/lib/engine/pipeline";
import { PROMPT_VERSION, type EngineItem } from "@/lib/engine/prompt";
import { revisarEjecucion } from "@/lib/engine/reglas-ejecucion";
import { bandaDeClima } from "@/lib/engine/recetario";
import { evaluarLook, type BriefRubrica } from "@/lib/engine/rubrica";
import { evaluarLookConVision } from "@/lib/engine/rubrica-vision";
import { ErrorProveedor } from "@/lib/proveedores";
import { peticionDeBrief, type BriefMotor, type LookMotor } from "@/lib/comparador/motor";
import { ITEM_IMAGE_SELECT, itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { estiloDelPerfil, colorDelPerfil, type NotaDeLook } from "./evales";
import { hayLluvia } from "@/lib/weather";

// UN PASO del eval: generar un brief (motor de producción completo) o
// calificarlo (los tres jueces sobre cada look). Mismo patrón que
// generar-lado.ts del comparador: la ruta pone HTTP y sesión, el trabajo real
// vive aquí, y cada paso cabe dentro de los 60s de Vercel.
//
// La fase se decide por los DATOS de la fila: sin looks → generar; con looks y
// sin notas completas → calificar. Reintentable en los dos sentidos: un juez
// que falló deja null SOLO en su casilla y el siguiente paso rellena lo que
// falta sin re-pagar lo que ya está.

export type ResultadoPaso =
  | { ok: true; hizo: "genero" | "califico" | "nada" }
  | { ok: true; fallo: string }
  | { error: string; status: number; detalle?: string };

export async function pasoEval(opciones: {
  supabase: SupabaseClient;
  corridaId: string;
  briefId: string;
  actorId: string;
}): Promise<ResultadoPaso> {
  const { supabase, corridaId, briefId, actorId } = opciones;

  const [{ data: corrida }, { data: fila }] = await Promise.all([
    supabase
      .from("eval_corridas")
      .select("id, closet_user_id, estado, prompt_version, con_estilo, con_color")
      .eq("id", corridaId)
      .maybeSingle(),
    supabase
      .from("eval_briefs")
      .select("*")
      .eq("id", briefId)
      .maybeSingle(),
  ]);
  if (!corrida || !fila) return { error: "sin_corrida", status: 404 };
  if (fila.corrida_id !== corridaId) return { error: "brief_de_otra_corrida", status: 400 };
  if (corrida.estado === "cerrada") return { error: "corrida_cerrada", status: 409 };
  if ((corrida.closet_user_id as string) !== actorId) {
    return { error: "closet_ajeno", status: 400 };
  }
  // Si el prompt cambió a media corrida, los briefs nuevos medirían OTRO motor:
  // la curva sumaría peras con manzanas sin dejar rastro.
  if (corrida.prompt_version !== PROMPT_VERSION) {
    return {
      error: "prompt_cambio",
      status: 409,
      detalle: `la corrida es de ${corrida.prompt_version} y el código ya va en ${PROMPT_VERSION} — abre una corrida nueva`,
    };
  }

  const brief = fila.brief as BriefMotor;

  // ── Fase 1: generar (el pipeline de producción COMPLETO) ──
  if (!fila.looks && !fila.error) {
    try {
      const carga = await cargarBaseDelMotor(supabase, actorId);
      if ("error" in carga) throw new Error("closet_vacio");
      const ctx = construirContexto(carga.base, peticionDeBrief(brief));

      const t0 = Date.now();
      // SIN RECIBO EN ai_calls, y a propósito (el `null` del final). Un eval
      // dispara decenas de generaciones seguidas contra el clóset de otra
      // persona: contarlas como uso real inflaría el costo y el volumen de la
      // tarea "motor" justo en la tabla que existe para vigilarlos. El costo de
      // la corrida sí se guarda — en `eval_briefs`, que es su sitio.
      const { finalized, reviews, recibos } = await armarLooks(ctx, {}, {}, null);
      const ms = Date.now() - t0;
      const costo = recibos.reduce<number | null>(
        (a, r) => (r.costoUsd == null ? a : (a ?? 0) + r.costoUsd),
        null
      );

      const { error: eUpd } = await supabase
        .from("eval_briefs")
        .update({ looks: finalized, reviews, costo_gen_usd: costo, ms_gen: ms })
        .eq("id", briefId)
        .is("looks", null); // dos pestañas no deben pagar el mismo brief dos veces
      if (eUpd) return { error: "no_se_guardo", status: 500, detalle: eUpd.message.slice(0, 200) };
      return { ok: true, hizo: "genero" };
    } catch (e) {
      const detalle =
        e instanceof ErrorProveedor ? e.message : e instanceof Error ? e.message : "falló";
      await supabase
        .from("eval_briefs")
        .update({ error: detalle.slice(0, 500) })
        .eq("id", briefId)
        .is("looks", null);
      return { ok: true, fallo: detalle.slice(0, 200) };
    }
  }

  // ── Fase 2: calificar cada look con los tres jueces ──
  const looks = (fila.looks as LookMotor[] | null) ?? [];
  if (looks.length === 0) return { ok: true, hizo: "nada" };

  const previas = (fila.notas as NotaDeLook[] | null) ?? [];
  const faltaAlgo = looks.some((_, i) => !previas[i]?.texto || !previas[i]?.vision);
  if (!faltaAlgo) return { ok: true, hizo: "nada" };

  // El clóset y el perfil: para las reglas de código (que necesitan el clóset
  // completo) y para el brief de la rúbrica (dress code + estilo declarado).
  const carga = await cargarBaseDelMotor(supabase, actorId);
  if ("error" in carga) return { error: "closet_vacio", status: 400 };
  const { profile, items: closet } = carga.base;
  const estilo = estiloDelPerfil(profile);
  const color = colorDelPerfil(profile);
  // Coherencia con lo CONGELADO: si la corrida se abrió sin señal y el perfil
  // ya la tiene (o al revés), la dimensión mediría a medias. Se manda lo que la
  // corrida declaró, no lo que el perfil tenga hoy.
  const conEstilo = corrida.con_estilo === true;
  const conColor = corrida.con_color === true;

  const briefRubrica: BriefRubrica = {
    objective: brief.objective,
    workDressCode: (profile.work_dress_code as string | null) ?? null,
    veCliente: typeof brief.veCliente === "boolean" ? brief.veCliente : null,
    plan: brief.plan ?? null,
    // El MISMO tipo que recibió el motor. Sin esto el juez calificaría la boda
    // y la graduación con la misma vara — que es exactamente el hueco que el
    // catálogo vino a cerrar.
    tipoEvento: brief.tipoEvento ?? null,
    formality: brief.formality ?? null,
    momento: brief.momento,
    weather: brief.weather,
    paraguas: brief.paraguas === true,
    estilo: conEstilo ? estilo : null,
    color: conColor ? color : null,
  };

  const imagenes = await imagenesDeLooks(supabase, looks);
  const porId = new Map(closet.map((i) => [i.id, i]));

  const notas: NotaDeLook[] = [];
  let costoNotas = Number(fila.costo_notas_usd ?? 0);
  let fallo: string | null = null;

  for (let i = 0; i < looks.length; i++) {
    const look = looks[i];
    const previa = previas[i] ?? null;
    const its = look.item_ids
      .map((id) => porId.get(id))
      .filter((x): x is EngineItem => !!x);

    // Las reglas de código son gratis: se recalculan siempre (si una regla
    // nueva entró desde la corrida, mejor que la fila lo refleje).
    const violaciones = revisarEjecucion(its, {
      clima: bandaDeClima(brief.weather ?? null),
      closet,
      lluvia: hayLluvia(brief.weather?.condition),
      paraguas: brief.paraguas === true,
      formality: brief.formality ?? null,
      gender: (profile.gender as string | null) ?? null,
    });

    let texto = previa?.texto ?? null;
    let vision = previa?.vision ?? null;

    if (!texto) {
      try {
        const r = await evaluarLook(
          briefRubrica,
          {
            nombre: look.nombre,
            explicacion: look.explicacion,
            tip: look.tip ?? null,
            prendas: its.map((it) => ({
              nombre: it.attrs.nombre ?? "Prenda",
              color: it.attrs.color ?? null,
              material: (it.attrs as { material?: string }).material ?? null,
            })),
          },
          // Laboratorio: no se registra (ver arriba).
          null
        );
        texto = r.nota;
        costoNotas += r.recibo.costoUsd ?? 0;
      } catch (e) {
        fallo = e instanceof Error ? e.message : "juez de texto falló";
      }
    }

    if (!vision) {
      try {
        const r = await evaluarLookConVision(
          briefRubrica,
          {
            nombre: look.nombre,
            explicacion: look.explicacion,
            tip: look.tip ?? null,
            prendas: look.item_ids.map((id) => ({
              nombre: porId.get(id)?.attrs.nombre ?? "Prenda",
              imagen: imagenes.get(id) ?? null,
            })),
          },
          // Laboratorio: no se registra (ver arriba).
          null
        );
        vision = r.nota;
        costoNotas += r.recibo.costoUsd ?? 0;
      } catch (e) {
        fallo = e instanceof Error ? e.message : "juez visual falló";
      }
    }

    notas.push({ violaciones, texto, vision });
  }

  const { error: eUpd } = await supabase
    .from("eval_briefs")
    .update({
      notas,
      costo_notas_usd: Math.round(costoNotas * 1000000) / 1000000,
    })
    .eq("id", briefId);
  if (eUpd) return { error: "no_se_guardo", status: 500, detalle: eUpd.message.slice(0, 200) };

  // Guardar lo que sí salió Y reportar lo que no: el siguiente paso rellena.
  if (fallo) return { ok: true, fallo: fallo.slice(0, 200) };
  return { ok: true, hizo: "califico" };
}

/**
 * Las fotos de las prendas de estos looks, como base64 para el juez visual.
 * La MISMA resolución de imagen que ve el humano (arquetipo → render → foto),
 * firmando el bucket privado donde toque.
 */
async function imagenesDeLooks(
  supabase: SupabaseClient,
  looks: LookMotor[]
): Promise<Map<string, { mediaType: string; base64: string } | null>> {
  const ids = Array.from(new Set(looks.flatMap((l) => l.item_ids)));
  const out = new Map<string, { mediaType: string; base64: string } | null>();
  if (ids.length === 0) return out;

  const { data: items } = await supabase
    .from("items")
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .in("id", ids);
  const filas = (items ?? []) as unknown as (ItemImageRow & { id: string })[];

  const paths = filas
    .flatMap((f) => [f.photo_path, f.render_path])
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

  await Promise.all(
    filas.map(async (f) => {
      const url = itemImageUrlSync(f, (p) => firmadas.get(p), "https://stailist.co");
      out.set(f.id, url ? await comoBase64(url) : null);
    })
  );
  return out;
}

async function comoBase64(url: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mediaType = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!/^image\//.test(mediaType)) return null;
    return { mediaType, base64: buf.toString("base64") };
  } catch {
    return null;
  }
}
