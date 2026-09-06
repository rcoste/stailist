import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { imagenCatalogo, primeraParada, slugDestino } from "@/lib/destino-imagen";
import { elegirMotivo, promptDestino } from "@/lib/destino-gen";
import { pedirImagen } from "@/lib/gemini-imagen";
import { revisarGasto } from "@/lib/cuotas";

// LA FOTO DE UN DESTINO NUEVO, generada en background durante el wizard.
//
// Se dispara fire-and-forget al pasar del paso 1 (ruta + fechas ya puestas):
// los ~30-60s que la persona tarda en contestar actividades y maleta tapan los
// ~15s de Gemini, así que la foto "aparece gratis" — idea de Roberto para el
// fit check, reusada aquí.
//
// SOLO LA COLA LARGA: si el catálogo estático conoce el lugar (Tokio, París…),
// aquí no se genera nada — esa foto ya existe, está curada, y es mejor que
// cualquier tirada nueva. Esta ruta es para el Osaka/Kioto/Querétaro que una
// lista a mano no puede enumerar.
//
// UNA GENERACIÓN POR DESTINO EN LA VIDA DEL PRODUCTO. La fila de
// destino_imagenes es el candado: el insert con llave (slug) hace que dos
// usuarios creando "Osaka" a la vez choquen ahí y solo uno pague la
// generación. NUNCA se genera desde una vista (abrir la lista con 5 viajes
// dispararía 5 generaciones): solo desde aquí, y aquí solo llama el wizard.
export const maxDuration = 60;

/** Un 'generando' más viejo que esto se considera una función muerta a media
 *  generación, y otro request puede reclamar el destino. */
const GENERANDO_VIEJO_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Sin cuota propia: sólo el interruptor y el tope de gasto (lib/cuotas.ts).
  const gasto = await revisarGasto(supabase, user.id);
  if (!gasto.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: gasto.motivo, mensaje: gasto.mensaje },
      { status: 429 }
    );
  }

  let body: { lugar?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const lugar = primeraParada(body.lugar ?? "");
  if (!lugar || lugar.length > 80) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // El catálogo estático gana siempre: para estos destinos no hay nada que hacer.
  if (imagenCatalogo(lugar)) return NextResponse.json({ ok: true, via: "catalogo" });

  const slug = slugDestino(lugar);

  // EL CANDADO. Insert primero: si la fila ya existe, el conflict nos dice que
  // alguien más ya la tiene (lista, en curso, o fallida) y se decide con calma.
  const { error: insertErr } = await supabase
    .from("destino_imagenes")
    .insert({ slug, lugar, status: "generando" });

  if (insertErr) {
    const { data: fila } = await supabase
      .from("destino_imagenes")
      .select("status, updated_at")
      .eq("slug", slug)
      .single();
    if (!fila) return NextResponse.json({ error: "candado" }, { status: 500 });
    if (fila.status === "listo") return NextResponse.json({ ok: true, via: "cache" });

    const edadMs = Date.now() - new Date(fila.updated_at as string).getTime();
    const muerto = fila.status === "generando" && edadMs > GENERANDO_VIEJO_MS;
    if (fila.status === "generando" && !muerto) {
      // Alguien más lo está generando ahorita mismo. No se compite.
      return NextResponse.json({ ok: true, via: "en_curso" });
    }
    // 'fallo' o un 'generando' muerto: se reclama. El WHERE re-verifica el
    // MISMO estado que se leyó — no una lista amplia. Con ["fallo","generando"]
    // a secas, dos requests que leyeran 'fallo' a la vez se robaban el turno:
    // el primero lo pone en 'generando' con updated_at fresco, y el segundo lo
    // casaría igual (cualquier updated_at ya es "menor que ahora"). El costo
    // era solo una generación duplicada con upsert — pero cerrado es cerrado.
    const { data: reclamada } = await supabase
      .from("destino_imagenes")
      .update({ status: "generando", updated_at: new Date().toISOString() })
      .eq("slug", slug)
      .eq("status", muerto ? "generando" : "fallo")
      .lt("updated_at", new Date(Date.now() - (muerto ? GENERANDO_VIEJO_MS : 0)).toISOString())
      .select("slug");
    if (!reclamada || reclamada.length === 0) {
      return NextResponse.json({ ok: true, via: "en_curso" });
    }
  }

  // De aquí en adelante este request ES el dueño de la generación. Cualquier
  // fallo marca la fila 'fallo' (no se borra: guarda el motivo del intento y
  // el próximo viaje a este destino lo reintenta).
  try {
    // El recibo lo deja `elegirMotivo` (por `medir`). Antes se guardaba aquí a
    // mano y sólo el éxito: si la llamada tronaba no quedaba ni el intento, y
    // este camino falla en silencio a propósito (la foto genérica es el
    // fallback), así que era justo el que más falta hacía medir.
    const { sujeto: motivo } = await elegirMotivo(lugar, { supabase, userId: user.id });

    const img = await pedirImagen([{ text: promptDestino(motivo) }], {
      aspecto: "4:3",
      ctx: { supabase, userId: user.id, tarea: "destino-imagen" },
    });
    if ("motivo" in img) throw new Error(img.motivo);

    // A webp como el catálogo estático (~40 KB contra ~700 del PNG crudo, para
    // una foto que se ve a 140px). sharp llega como dependencia transitiva de
    // Next; si algún día falta, se sube el PNG tal cual — pesado pero funcional.
    let buffer: Buffer = Buffer.from(img.data, "base64");
    let contentType = "image/png";
    let ext = "png";
    try {
      const sharp = (await import("sharp")).default;
      buffer = await sharp(buffer).resize(900).webp({ quality: 80 }).toBuffer();
      contentType = "image/webp";
      ext = "webp";
    } catch {
      // sin sharp: PNG crudo
    }

    const path = `${slug}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("destinos")
      .upload(path, buffer, { contentType, upsert: true });
    if (upErr) throw new Error(`storage: ${upErr.message}`);

    await supabase
      .from("destino_imagenes")
      .update({ status: "listo", path, motivo, updated_at: new Date().toISOString() })
      .eq("slug", slug);

    return NextResponse.json({ ok: true, via: "generada", motivo });
  } catch (e) {
    await supabase
      .from("destino_imagenes")
      .update({
        status: "fallo",
        motivo: `error: ${e instanceof Error ? e.message.slice(0, 200) : "?"}`,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", slug);
    // 200 a propósito: el cliente disparó y se fue (fire-and-forget); el viaje
    // nunca depende de esta foto — la genérica lo cubre.
    return NextResponse.json({ ok: false, via: "fallo" });
  }
}
