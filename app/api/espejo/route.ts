import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { MODELO_ESPEJO } from "@/lib/models";
import { resolveWeather } from "@/lib/weather";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import { esRegistro } from "@/lib/registro";
import { guardarFallo, guardarRecibo } from "@/lib/recibos";
import {
  contextoEspejo,
  mirarEspejo,
  ESPEJO_VERSION,
  type LecturaEspejo,
} from "@/lib/espejo";

// "¿ME VEO BIEN?" — recibe la foto de cómo se vistió y contesta.
//
// El porqué del módulo, y por qué NO es una evaluación, viven en lib/espejo.
//
// GUARDA Y CONTESTA EN LA MISMA LLAMADA. Podría devolver el consejo y dejar el
// guardado para un segundo paso, pero entonces "ya quedó en tu diario" sería
// mentira mientras lee la respuesta — y el diario es media promesa del módulo.
// Si el guardado falla, el consejo se entrega igual: la respuesta es el
// trabajo, el diario es el registro.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Mismo gate de menores que el resto de lo que mira fotos.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  let body: {
    image?: string;
    photoPath?: string;
    lat?: number;
    lon?: number;
    weather?: { temp_c?: number; condition?: string };
    paraguas?: boolean;
    momento?: string;
    registro?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;

  // La ruta de la foto viene del cliente (la subió con su RLS). Defensa extra:
  // tiene que estar dentro de su propia carpeta.
  const photoPath =
    body.photoPath && body.photoPath.startsWith(`${user.id}/`) ? body.photoPath : null;

  const [{ data: profile }, weather] = await Promise.all([
    supabase
      .from("profiles")
      .select("gender, palette_season, palette_flow, style_vetoes")
      .eq("id", user.id)
      .single(),
    resolveWeather(body),
  ]);

  // A DÓNDE VA. Se valida contra el catálogo, y lo que no lo pase entra como
  // null —que no es "sin dato" sino una instrucción explícita de NO adivinar la
  // ocasión— en vez de viajar crudo al prompt.
  const registro = esRegistro(body.registro) ? body.registro : null;

  const contexto = contextoEspejo({
    gender: (profile?.gender as "hombre" | "mujer" | null) ?? null,
    season: (profile?.palette_season as string | null) ?? null,
    flow: (profile?.palette_flow as string | null) ?? null,
    weather,
    // Solo cuenta si de verdad llueve — mismo criterio que el look de hoy: un
    // "sí llevo paraguas" con sol no debe cambiar nada.
    paraguas: body.paraguas === true && !!weather,
    vetos: vetoLabels((profile?.style_vetoes as StyleVetoes | null) ?? null),
    momento: body.momento === "noche" ? "noche" : body.momento === "dia" ? "dia" : null,
    registro,
  });

  let lectura: LecturaEspejo;
  const t0 = Date.now();
  try {
    const r = await mirarEspejo({ mediaType, base64: b64 }, contexto, MODELO_ESPEJO);
    lectura = r.lectura;
    // SE ESPERA, aunque la tentación sea no hacerlo.
    //
    // La primera versión lo dejó como promesa suelta ("la persona está en la
    // puerta"). Está mal en serverless: una vez que la ruta devuelve, la
    // función se puede congelar y la promesa pendiente muere — o sea que el
    // recibo se perdería justo en producción, que es donde importa, y en local
    // funcionaría siempre. Un insert son decenas de milisegundos sobre una
    // llamada que ya tardó seis mil.
    await guardarRecibo(supabase, {
      userId: user.id,
      tarea: "espejo",
      modelo: MODELO_ESPEJO,
      version: ESPEJO_VERSION,
      recibo: r.recibo,
    });
  } catch {
    // El fallo también se registra: un promedio que sólo cuenta los éxitos
    // miente hacia el lado optimista, y cuánto tarda en tronar es la mitad de
    // la respuesta a "¿cuánto tarda esto?".
    await guardarFallo(supabase, {
      userId: user.id,
      tarea: "espejo",
      modelo: MODELO_ESPEJO,
      version: ESPEJO_VERSION,
      ms: Date.now() - t0,
    });
    return NextResponse.json({ error: "no_pude_mirar" }, { status: 502 });
  }

  // FALLA HACIA ADELANTE: si el guardado truena, el consejo sale igual.
  let outfitId: string | null = null;
  try {
    const { data } = await supabase
      .from("outfits")
      .insert({
        user_id: user.id,
        // Sin empatar contra el clóset todavía — a propósito (ver lib/espejo).
        item_ids: [],
        source: "espejo",
        // EL REGISTRO SE GUARDA AQUÍ, en la columna que ya existe. Nada lee
        // `occasion === 'espejo'` (lo que distingue un fit check es `source`),
        // así que la columna estaba desperdiciada en una constante.
        //
        // Guardarlo no es cosmético: es la única forma de contestar después si
        // la vara mejoró el consejo, y de saber a qué va la gente de verdad. Sin
        // esto, la próxima discusión sobre el espejo vuelve a ser de opiniones.
        // "espejo" queda de respaldo para un request sin registro válido.
        occasion: registro ?? "espejo",
        // El TÍTULO, no el resumen: el resumen es un párrafo y el diario lo
        // pinta en la serif grande.
        title: lectura.titulo,
        // LO QUE TRAÍA PUESTO, en palabras. Es lo único que cubre las prendas
        // que se leyeron pero no existen como fila en su clóset: sin esto la
        // entrada del diario enseña menos de lo que la app vio (ver 0129).
        resumen: lectura.resumen,
        explanation: lectura.colorimetria,
        tip: lectura.ajuste,
        prompt_version: ESPEJO_VERSION,
        weather,
        photo_path: photoPath,
        // Es lo que SE PUSO, no una propuesta: nace marcado como usado, que es
        // justo la señal de oro que el resto del producto persigue a duras penas.
        favorited_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    outfitId = (data?.id as string) ?? null;

    // DOS eventos, no uno. `espejo_subido` mide el uso del fit check; `worn` es
    // la señal de comportamiento que el resto del producto ya consumía.
    //
    // El `worn` lo escribe AQUÍ desde el rediseño del home (2026-08-11), porque
    // ahí murió la card "¿te lo pusiste ayer?" — que era su único escritor. Sin
    // esto la señal se secaba en silencio y con ella tres lecturas: la línea más
    // fuerte del prompt del motor ("SE LO PUSO de verdad", lib/engine/prompt),
    // el orden del clóset por prendas usadas (lib/loved-items) y el KPI del
    // admin. Y el fit check es MEJOR fuente que la card: la persona no contesta
    // un favor, manda la foto de lo que trae puesto.
    await supabase.from("events").insert([
      {
        user_id: user.id,
        type: "espejo_subido",
        data: { outfit_id: outfitId, con_clima: !!weather },
      },
      // Sin fila de outfit no hay `worn`: el evento existe para colgarse de un
      // look concreto (así lo leen el motor y el clóset) y uno suelto sería
      // ruido que infla el KPI sin enseñarle nada a nadie.
      ...(outfitId
        ? [
            {
              user_id: user.id,
              type: "worn",
              outfit_id: outfitId,
              data: { via: "espejo" },
            },
          ]
        : []),
    ]);
  } catch {
    // el consejo ya está; el registro se pierde
  }

  return NextResponse.json({ ...lectura, outfitId });
}
