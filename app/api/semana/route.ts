import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { revisarCuota } from "@/lib/cuotas";
import { STALE_MS, fechaLocalDe, generateInto, shape } from "@/lib/look-del-dia/nucleo";
import {
  EN_FILA,
  FILA_MUERTA_MS,
  MIN_PRENDAS_SEMANA,
  diasOfrecidos,
  estadoDelDia,
  ocupaLaFecha,
  validarPeticion,
  type DiaPedido,
  type EstadoDia,
} from "@/lib/semana";

// "ARMA MI SEMANA" (lib/semana.ts explica el porqué).
//
// POST crea TODAS las filas de una vez y responde al instante; después, en
// background, genera los días UNO TRAS OTRO con el mismo núcleo que el look
// planeado de /api/look-of-day (generateInto). En fila y no en paralelo a
// propósito: cada día recarga el clóset y sus "combos recientes", así que el
// jueves ve el look del miércoles y no repite el conjunto — sin tocar el
// prompt del motor. La prenda sí se puede repetir (unos jeans tres veces en
// la semana es normal); el conjunto idéntico no.
//
// 300 s y no los 120 del look del día: son hasta 7 generaciones seguidas de
// ~20-30 s. CLAUDE.md pide verificar el techo midiendo UNA ruta antes de
// pelear contra él; ésta es esa ruta.
export const maxDuration = 300;

// Las filas nacen `generating` con la marca EN_FILA en gen_error (para que un
// doble toque no duplique la semana y el reloj de muerto de 150 s no mate al
// quinto día mientras espera). Al llegar su turno se limpia la marca y se
// reinicia created_at. Ver estadoDelDia en lib/semana.ts.

type Body = {
  dias?: unknown;
  fechaLocal?: string;
  lat?: number;
  lon?: number;
};

async function contarPrendas(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);
  return count ?? 0;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const hoy = fechaLocalDe({ fechaLocal: body.fechaLocal });
  const v = validarPeticion(body.dias, hoy);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const prendas = await contarPrendas(supabase, user.id);
  if (prendas < MIN_PRENDAS_SEMANA) {
    return NextResponse.json(
      { error: "pocas_prendas", tienes: prendas, minimo: MIN_PRENDAS_SEMANA },
      { status: 400 }
    );
  }

  // La cuota se revisa aquí (para decir que no antes de crear nada) y otra vez
  // antes de CADA día: siete días pueden cruzar el tope a media semana.
  const cuota = await revisarCuota(supabase, user.id, "looks");
  if (!cuota.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: cuota.motivo, mensaje: cuota.mensaje },
      { status: 429 }
    );
  }

  // Días que ya tienen un look planeado vivo (listo o generándose) no se
  // vuelven a armar: un doble toque o volver a la pantalla no duplica nada.
  const fechas = v.dias.map((d) => d.fecha);
  const { data: existentes } = await supabase
    .from("outfits")
    .select("planned_for, gen_status, gen_error, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .in("planned_for", fechas);
  const ahora = Date.now();
  const ocupadas = new Set(
    (existentes ?? [])
      .filter((o) =>
        ocupaLaFecha(
          estadoDelDia(
            {
              gen_status: o.gen_status as string | null,
              gen_error: o.gen_error as string | null,
              created_at: o.created_at as string,
            },
            ahora,
            STALE_MS
          )
        )
      )
      .map((o) => o.planned_for as string)
  );
  const porArmar = v.dias.filter((d) => !ocupadas.has(d.fecha));
  if (porArmar.length === 0) return NextResponse.json({ encolados: [] });

  const { data: filas, error: insErr } = await supabase
    .from("outfits")
    .insert(
      porArmar.map((d) => ({
        user_id: user.id,
        item_ids: [],
        occasion: d.ocasion,
        explanation: "",
        prompt_version: PROMPT_VERSION,
        is_look_of_day: false,
        look_date: null,
        planned_for: d.fecha,
        gen_status: "generating",
        gen_error: EN_FILA,
      }))
    )
    .select("id, planned_for");
  if (insErr || !filas) {
    return NextResponse.json({ error: "no_pude_guardar" }, { status: 500 });
  }
  const idPorFecha = new Map(filas.map((f) => [f.planned_for as string, f.id as string]));
  const fila = porArmar
    .map((d) => ({ ...d, outfitId: idPorFecha.get(d.fecha) }))
    .filter((d): d is DiaPedido & { outfitId: string } => !!d.outfitId);

  // Sin evento propio: cada día ya deja su generation_timing con planned_for
  // (lo escribe generateInto), que es lo que dirá si la semana se usa.

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const correr = async (db: SupabaseClient) => {
    for (const d of fila) {
      const sigue = await revisarCuota(db, user.id, "looks");
      if (!sigue.permitido) {
        await db
          .from("outfits")
          .update({ gen_status: "error", gen_error: "cuota" })
          .eq("id", d.outfitId)
          .eq("user_id", user.id);
        continue;
      }
      // Le toca: deja de estar en fila y su reloj de muerto arranca AHORA.
      await db
        .from("outfits")
        .update({ gen_error: null, created_at: new Date().toISOString() })
        .eq("id", d.outfitId)
        .eq("user_id", user.id);
      await generateInto(db, user.id, d.outfitId, {
        objective: d.ocasion,
        plannedFor: d.fecha,
        fechaLocal: hoy,
        lat: body.lat,
        lon: body.lon,
      });
    }
  };
  if (token) {
    after(async () => {
      await correr(createTokenClient(token));
    });
  } else {
    await correr(supabase);
  }

  return NextResponse.json({ encolados: fila.map((d) => d.fecha) });
}

// GET ?fechaLocal=YYYY-MM-DD: el estado de los 7 días que se ofrecen. Para
// cada fecha, el look planeado más reciente que no esté borrado.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  const hoy = fechaLocalDe({ fechaLocal: request.nextUrl.searchParams.get("fechaLocal") ?? undefined });
  const fechas = diasOfrecidos(hoy).map((d) => d.fecha);
  const { data: filas } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation, tip, occasion, gen_status, gen_error, created_at, planned_for")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .in("planned_for", fechas)
    .order("created_at", { ascending: false });

  const ahora = Date.now();
  const dias: Record<string, { estado: EstadoDia; ocasion: string | null; look?: unknown }> = {};
  for (const o of filas ?? []) {
    const fecha = o.planned_for as string;
    if (dias[fecha]) continue; // ya quedó el más reciente
    const estado = estadoDelDia(
      {
        gen_status: o.gen_status as string | null,
        gen_error: o.gen_error as string | null,
        created_at: o.created_at as string,
      },
      ahora,
      STALE_MS
    );
    // Un error viejo no se pinta: la fecha vuelve a estar libre para pedirla.
    if (estado === "error" && ahora - new Date(o.created_at as string).getTime() > FILA_MUERTA_MS * 3) {
      continue;
    }
    dias[fecha] = {
      estado,
      ocasion: (o.occasion as string | null) ?? null,
      ...(estado === "listo" ? { look: await shape(supabase, o as Parameters<typeof shape>[1]) } : {}),
    };
  }
  return NextResponse.json({ dias });
}
