import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { leerPrenda } from "@/lib/vision-prenda";
import { leerPrendas } from "@/lib/vision-prendas";
import { modeloPorId } from "@/lib/proveedores/catalogo";
import { ErrorProveedor } from "@/lib/proveedores";

export const maxDuration = 60;

// UNA lectura: un modelo mirando una foto. La pantalla las va pidiendo de a poco
// desde el navegador.
//
// POR QUÉ DE UNA EN UNA
// Vercel corta cualquier función a los 60 segundos. Ocho fotos por cinco
// modelos son 40 lecturas de hasta 15s cada una: en una sola petición se muere
// a la cuarta. Pidiéndolas por separado, el navegador manda varias en paralelo,
// se ve el avance en vivo, y si algo truena se reintenta sólo eso.
//
// Y hay un efecto de lado que importa: cerrar la pestaña deja de gastar. Lo que
// no se pide, no se cobra.

export async function POST(request: NextRequest) {
  await requireAdmin();
  const supabase = await createClient();

  let body: { corridaId?: string; fotoId?: string; modeloId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { corridaId, fotoId, modeloId } = body;
  if (!corridaId || !fotoId || !modeloId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const modelo = modeloPorId(modeloId);
  if (!modelo) return NextResponse.json({ error: "modelo_desconocido" }, { status: 400 });

  // Si ya se leyó, no se vuelve a cobrar. Hace la corrida reintentable: si se
  // cae la conexión a la mitad, recargar sigue desde donde iba.
  const { data: previa } = await supabase
    .from("comparador_lecturas")
    .select("id")
    .eq("foto_id", fotoId)
    .eq("modelo_id", modeloId)
    .maybeSingle();
  if (previa) return NextResponse.json({ ok: true, yaEstaba: true });

  const [{ data: corrida }, { data: foto }] = await Promise.all([
    supabase.from("comparador_corridas").select("modo").eq("id", corridaId).single(),
    supabase.from("comparador_fotos").select("path").eq("id", fotoId).single(),
  ]);
  if (!corrida || !foto) return NextResponse.json({ error: "sin_corrida" }, { status: 404 });

  const { data: firmada } = await supabase.storage
    .from("prendas")
    .createSignedUrl(foto.path as string, 600);
  if (!firmada?.signedUrl) return NextResponse.json({ error: "sin_imagen" }, { status: 422 });

  const img = await fetch(firmada.signedUrl);
  if (!img.ok) return NextResponse.json({ error: "imagen_no_baja" }, { status: 502 });
  const base64 = Buffer.from(await img.arrayBuffer()).toString("base64");
  const mediaType = img.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";

  // Un fallo de UN modelo no tumba la corrida: se guarda como error y la
  // comparación sigue. Que un modelo truene con cierta foto ES un resultado —
  // y hoy uno de los Gemini truena si le apagas el pensamiento.
  try {
    const imagen = { mediaType, base64 };
    // `null` EXPLÍCITO: esto es el comparador de modelos. La misma foto se lee
    // con cinco modelos seguidos y el recibo de cada lectura ya se guarda donde
    // toca (comparador_lecturas, justo abajo). Meterlas además en ai_calls
    // multiplicaría por cinco el volumen de "vision-prenda" con lecturas que
    // ningún clóset recibió.
    const { salida, recibo } =
      corrida.modo === "varias"
        ? await leerPrendas(imagen, modelo, null).then((r) => ({
            salida: r.prendas,
            recibo: r.recibo,
          }))
        : await leerPrenda(imagen, modelo, null).then((r) => ({
            salida: r.analisis,
            recibo: r.recibo,
          }));

    await supabase.from("comparador_lecturas").insert({
      corrida_id: corridaId,
      foto_id: fotoId,
      modelo_id: modeloId,
      salida,
      tokens_entrada: recibo.tokens.entrada,
      tokens_salida: recibo.tokens.salida,
      costo_usd: recibo.costoUsd,
      ms: recibo.ms,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detalle =
      e instanceof ErrorProveedor ? e.message : e instanceof Error ? e.message : "falló";
    await supabase.from("comparador_lecturas").insert({
      corrida_id: corridaId,
      foto_id: fotoId,
      modelo_id: modeloId,
      error: detalle.slice(0, 500),
    });
    return NextResponse.json({ ok: true, fallo: detalle.slice(0, 200) });
  }
}
