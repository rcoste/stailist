// LA PUERTA COMÚN DE LA GENERACIÓN DE IMÁGENES.
//
// La usan el try-on ("verme con este") y el avatar. Vivían con una copia cada
// uno del mismo fetch a Gemini, y la copia del avatar se quedó sin el
// reintento y sin el timeout que el try-on sí tenía — la misma clase de deriva
// silenciosa que lib/engine/contexto.ts existe para matar: dos caminos que
// hacen lo mismo hasta que uno mejora y el otro no.
//
// El modelo NO está en lib/models.ts a propósito: ahí viven las decisiones
// por tarea (qué modelo LEE, qué modelo decide) y aquí no hay tal decisión,
// hay un modelo de imagen y ya. El guard de modelos lo exceptúa explícitamente.
export const GEMINI_MODEL = "gemini-3-pro-image";

/**
 * El rápido. Ya se usaba para los arquetipos del catálogo y para el fallback
 * texto→imagen del render de prenda; se nombra aquí para que las dos puertas
 * salgan del mismo lugar. Medido el 2026-08-06 sobre la MISMA foto y el MISMO
 * prompt de extracción: pro 17.3s de promedio, flash 7.7s.
 */
export const GEMINI_MODEL_RAPIDO = "gemini-3.1-flash-image";

// EL SERVICIO DE IMÁGENES FALLA SOLO, Y HAY QUE CONTARLO CON ESO.
//
// Medido el 2026-08-06 contra gemini-3-pro-image con una llave y un prompt
// sanos: de 8 llamadas idénticas, 2 volvieron `500 INTERNAL` en ~200ms (tan
// rápido que ni lo intentó) y otra corrida murió con ETIMEDOUT de red. Las
// buenas tardan 13-18s. O sea: el fallo es intermitente y del lado de Google,
// no del prompt ni de las prendas.
//
// Antes, CUALQUIERA de esos tres finales —500, timeout de red, o excepción—
// salía como el mismo "generacion" sin leer siquiera el cuerpo de la
// respuesta. Por eso "está fallando el render" no se podía diagnosticar sin
// salir a interrogar la API a mano: el motivo se tiraba a la basura en la
// línea del `if (!gemRes.ok)`.
//
// Tres cosas, entonces: se lee el motivo, se reintenta lo que es reintentable,
// y ninguna espera puede comerse el presupuesto de la función.
const INTENTOS = 2;
/** Por intento. Las buenas tardan 13-18s; a los 30 ya no viene. */
const TIMEOUT_MS = 30_000;
/** Presupuesto total. Vercel corta la función a los 60s. */
const PRESUPUESTO_MS = 52_000;

/** 5xx y 429 son de ellos y suelen pasarse solos; un 400 es nuestro y no. */
function vaLaPena(status: number): boolean {
  return status === 429 || status >= 500;
}

type Parte = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * Le pide UNA imagen a Gemini, reintentando lo que es reintentable y sin
 * pasarse del presupuesto de la función.
 *
 * Está aparte de generarTryon —que necesita Supabase, avatar y prendas— para
 * que esta lógica sí se pueda probar: `fetchImpl` y `ahora` se inyectan en los
 * tests. Antes no había nada que probar porque no había lógica: un `if (!ok)`
 * devolvía "generacion" y se acabó.
 */
export async function pedirImagen(
  parts: Parte[],
  opciones: {
    /** 3:4 retrato y cuerpo · 16:9 el sheet de 3 vistas · 1:1 la prenda. */
    aspecto?: "3:4" | "16:9" | "1:1";
    /** Por default el bueno. El render de prenda y el catálogo pueden pedir otro. */
    modelo?: string;
    fetchImpl?: typeof fetch;
    ahora?: () => number;
  } = {}
): Promise<{ data: string } | { motivo: string }> {
  const hacerFetch = opciones.fetchImpl ?? fetch;
  const modelo = opciones.modelo ?? GEMINI_MODEL;
  const ahora = opciones.ahora ?? (() => Date.now());
  const t0 = ahora();
  const cuerpo = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: opciones.aspecto ?? "3:4" },
    },
  });

  let motivo = "sin intentos";
  for (let intento = 1; intento <= INTENTOS; intento++) {
    // Nunca se arranca un intento que no cabe: uno colgado se comería los 60s
    // de Vercel y la persona no vería ni el error.
    const restante = PRESUPUESTO_MS - (ahora() - t0);
    if (intento > 1 && restante < 8_000) {
      motivo = `${motivo} (sin tiempo para reintentar)`;
      break;
    }
    try {
      const res = await hacerFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: cuerpo,
          signal: AbortSignal.timeout(Math.min(TIMEOUT_MS, Math.max(restante, 1))),
        }
      );
      if (!res.ok) {
        // El cuerpo SÍ se lee: es la única forma de distinguir "se cayó su
        // servicio" de "la llave no sirve" o "el prompt no pasó el filtro".
        const txt = await res.text().catch(() => "");
        let mensaje = txt.slice(0, 300);
        try {
          mensaje = (JSON.parse(txt)?.error?.message as string) ?? mensaje;
        } catch {}
        motivo = `HTTP ${res.status}: ${mensaje}`;
        console.error(`[imagen] ${modelo} ${intento}/${INTENTOS} — ${motivo}`);
        if (!vaLaPena(res.status)) break;
        continue;
      }
      const data = await res.json();
      const img = data?.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string } }) => p.inlineData?.data
      );
      if (img) return { data: img.inlineData.data as string };
      // 200 sin imagen: casi siempre el filtro de seguridad. No se reintenta
      // —la misma entrada da lo mismo— pero sí se deja dicho por qué.
      const razon =
        data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason;
      motivo = `respondió sin imagen${razon ? ` (${razon})` : ""}`;
      console.error(`[imagen] ${modelo} — ${motivo}`);
      break;
    } catch (e) {
      // Timeout de red o corte de conexión: los dos son reintentables y los dos
      // salían antes como "generacion" a secas.
      motivo =
        e instanceof Error && e.name === "TimeoutError"
          ? `sin respuesta en ${Math.round(TIMEOUT_MS / 1000)}s`
          : `red: ${e instanceof Error ? e.message : "falló"}`;
      console.error(`[imagen] ${modelo} ${intento}/${INTENTOS} — ${motivo}`);
    }
  }
  return { motivo };
}

