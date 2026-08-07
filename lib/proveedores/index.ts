import Anthropic from "@anthropic-ai/sdk";
import { costoUsd } from "./precios";

// Hablar con CUALQUIER modelo por la misma puerta, y salir siempre con el mismo
// recibo: respuesta, tokens, costo y tiempo.
//
// POR QUÉ
// Dos razones, y la segunda es la importante.
//
// 1. Roberto quiere comparar Claude contra Gemini, Kimi y quien caiga, para
//    decidir con evidencia cuál usar en cada tarea. Sin una puerta común, cada
//    proveedor mete su propio dialecto (el schema se llama distinto, los tokens
//    vienen en otro campo) y la comparación se llena de asteriscos.
//
// 2. LA MEDICIÓN. Cada llamada devuelve su costo real. Hasta hoy el proyecto
//    llevaba dos meses sin saber cuánto cuesta armar un look contra leer una
//    prenda: la factura llega por día y por modelo, y todo lo demás era
//    sospecha. Un recibo por llamada convierte "creo que la visión pesa más"
//    en un número.
//
// LA TRAMPA QUE HAY QUE TENER PRESENTE AL LEER RESULTADOS
// Nuestro prompt del motor lleva 37 versiones afinadas contra Claude. Dárselo
// tal cual a otro modelo y verlo perder NO prueba que el modelo sea peor —
// prueba que el traje no es suyo. Por eso la primera comparación que vale la
// pena es la de VISIÓN: "¿de qué color es esta camisa?" no tiene 37 versiones
// de afinación, la respuesta está en la foto, y encima es donde está el gasto
// (436 prendas leídas en julio contra ~34 generaciones de looks).

export type Proveedor = "anthropic" | "gemini" | "openrouter";

export type Modelo = {
  proveedor: Proveedor;
  /** El id exacto que espera la API del proveedor. */
  id: string;
  /** Cómo se llama en pantalla. */
  etiqueta: string;
};

export type Peticion = {
  modelo: Modelo;
  system: string;
  texto: string;
  /** UNA imagen (leer una prenda, juzgar un avatar). */
  imagen?: { mediaType: string; base64: string };
  /**
   * VARIAS imágenes, en orden. Nació con la rúbrica visual: juzgar un look es
   * ver TODAS sus prendas juntas —la misma cuadrícula que ve el humano al
   * votar— y con una sola imagen eso no se puede. `imagen` sigue funcionando;
   * las dos se concatenan.
   */
  imagenes?: { mediaType: string; base64: string }[];
  /** JSON Schema. Cada proveedor lo pide a su manera; aquí se traduce. */
  schema?: Record<string, unknown>;
  maxTokens?: number;
};

export type Recibo = {
  /** El texto crudo de la respuesta (JSON si se pidió schema). */
  texto: string;
  tokens: { entrada: number; salida: number };
  /** null si no conocemos el precio del modelo. */
  costoUsd: number | null;
  ms: number;
  /**
   * La respuesta se cortó por tope de tokens. Quien pidió JSON tiene que
   * tratarlo como fallo distinguible ANTES de parsear: un JSON incompleto
   * truena con un error opaco de sintaxis que no dice qué pasó.
   */
  truncada: boolean;
};

/** Todas las imágenes de la petición, en orden: la suelta y luego la lista. */
function imagenesDe(p: Peticion): { mediaType: string; base64: string }[] {
  return [...(p.imagen ? [p.imagen] : []), ...(p.imagenes ?? [])];
}

export class ErrorProveedor extends Error {
  constructor(
    public proveedor: Proveedor,
    public detalle: string
  ) {
    super(`${proveedor}: ${detalle}`);
  }
}

/** La puerta común. */
export async function llamar(p: Peticion): Promise<Recibo> {
  const t0 = Date.now();
  const r = await despachar(p);
  return { ...r, ms: Date.now() - t0 };
}

/**
 * JSON.parse con tolerancia a UN defecto concreto: caracteres de control
 * CRUDOS dentro de los strings (saltos de línea sin escapar). Lo emite Kimi
 * K2.6 con schema — el JSON es correcto salvo por eso, y tirarlo entero
 * castigaría al modelo por un bug de serialización, no de criterio.
 *
 * Primero el parse estricto (Claude y Gemini jamás entran al fallback). Si
 * truena, se reemplaza todo carácter de control por un espacio: dentro de un
 * string, un salto de línea→espacio conserva el sentido; entre tokens, un
 * espacio sigue siendo whitespace legal. Si aún así no parsea, el error
 * original de verdad era otro y se relanza.
 */
export function parsearJson<T>(texto: string): T {
  try {
    return JSON.parse(texto) as T;
  } catch (e) {
    try {
      return JSON.parse(texto.replace(/[\u0000-\u001F]+/g, " ")) as T;
    } catch {
      throw e;
    }
  }
}

function despachar(p: Peticion): Promise<Omit<Recibo, "ms">> {
  switch (p.modelo.proveedor) {
    case "anthropic":
      return conAnthropic(p);
    case "gemini":
      return conGemini(p);
    case "openrouter":
      return conOpenRouter(p);
  }
}

// ── Anthropic ──────────────────────────────────────────────────────────────
// El SDK nativo, igual que en producción. No se reimplementa nada: si el motor
// cambia cómo llama, esto cambia con él.

async function conAnthropic(p: Peticion): Promise<Omit<Recibo, "ms">> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErrorProveedor("anthropic", "falta ANTHROPIC_API_KEY");
  }
  const client = new Anthropic();
  const res = await client.messages.create({
    model: p.modelo.id,
    max_tokens: p.maxTokens ?? 1024,
    // Apagado a propósito: en los modelos 5 viene encendido por default y
    // cuesta ~50% de latencia. Producción también lo apaga; si aquí quedara
    // encendido, la comparación mediría dos cosas a la vez.
    thinking: { type: "disabled" },
    system: p.system,
    messages: [
      {
        role: "user",
        content: [
          ...imagenesDe(p).map((im) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: im.mediaType as "image/jpeg" | "image/png",
              data: im.base64,
            },
          })),
          { type: "text" as const, text: p.texto },
        ],
      },
    ],
    ...(p.schema
      ? { output_config: { format: { type: "json_schema" as const, schema: p.schema } } }
      : {}),
  });

  const texto = res.content.find((b) => b.type === "text")?.text;
  if (!texto) throw new ErrorProveedor("anthropic", "respuesta vacía");
  const tokens = {
    entrada: res.usage.input_tokens,
    salida: res.usage.output_tokens,
  };
  return {
    texto,
    tokens,
    costoUsd: costoUsd(p.modelo.id, tokens),
    truncada: res.stop_reason === "max_tokens",
  };
}

// ── Gemini ─────────────────────────────────────────────────────────────────
// Por fetch, igual que las imágenes del try-on (lib/archetype-image.ts) — no
// hay SDK instalado y no hace falta uno para esto.

/**
 * Gemini acepta un subconjunto de JSON Schema y RECHAZA la petición entera si
 * ve una llave que no conoce. Quitar las de más es más seguro que mantener una
 * lista de las permitidas: si mañana agregamos un campo nuevo al schema del
 * clóset, esto no se rompe en silencio.
 */
function schemaParaGemini(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(schemaParaGemini);
  if (!s || typeof s !== "object") return s;
  const fuera = new Set(["additionalProperties", "$schema", "default", "examples"]);
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (fuera.has(k)) continue;
    salida[k] = schemaParaGemini(v);
  }
  return salida;
}

async function conGemini(p: Peticion): Promise<Omit<Recibo, "ms">> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new ErrorProveedor("gemini", "falta GOOGLE_GENERATIVE_AI_API_KEY");

  // Los modelos de Gemini NO coinciden en si aceptan que se les apague el
  // pensamiento: 3.1 Flash-Lite y 3.5 Flash lo aceptan, 3.5 Flash-Lite y 3.6
  // Flash devuelven 400. Se intenta apagarlo y, si lo rechaza, se reintenta sin
  // eso — mantener a mano una lista de quién acepta qué se pudre sola en cuanto
  // sale un modelo nuevo, y falla justo cuando queremos medirlo.
  let res = await pedirAGemini(p, key, true);
  if (res.status === 400) res = await pedirAGemini(p, key, false);
  return leerRespuestaGemini(p, res);
}

async function pedirAGemini(p: Peticion, key: string, sinPensar: boolean) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${p.modelo.id}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Gemini no tiene campo "system" en el cuerpo del mensaje: va aparte.
        systemInstruction: { parts: [{ text: p.system }] },
        contents: [
          {
            role: "user",
            parts: [
              ...imagenesDe(p).map((im) => ({
                inlineData: { mimeType: im.mediaType, data: im.base64 },
              })),
              { text: p.texto },
            ],
          },
        ],
        generationConfig: {
          // Con holgura: cuando el modelo insiste en pensar, los tokens de
          // pensamiento salen de este mismo presupuesto y el JSON llegaba
          // cortado a la mitad — la lectura entera se perdía por tacaños.
          maxOutputTokens: (p.maxTokens ?? 1024) * 4,
          // Pensamiento APAGADO donde se pueda. En Claude también lo está, y si
          // un lado piensa y el otro no, la comparación mide dos cosas a la vez.
          ...(sinPensar ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          ...(p.schema
            ? {
                responseMimeType: "application/json",
                responseSchema: schemaParaGemini(p.schema),
              }
            : {}),
        },
      }),
    }
  );
}

async function leerRespuestaGemini(
  p: Peticion,
  res: Response
): Promise<Omit<Recibo, "ms">> {
  if (!res.ok) {
    throw new ErrorProveedor("gemini", `${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const texto = json.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("");
  if (!texto) throw new ErrorProveedor("gemini", "respuesta vacía");
  const tokens = {
    entrada: json.usageMetadata?.promptTokenCount ?? 0,
    salida: json.usageMetadata?.candidatesTokenCount ?? 0,
  };
  return {
    texto,
    tokens,
    costoUsd: costoUsd(p.modelo.id, tokens),
    truncada: json.candidates?.[0]?.finishReason === "MAX_TOKENS",
  };
}

// ── OpenRouter ─────────────────────────────────────────────────────────────
// Una sola llave para decenas de modelos (Kimi K2, DeepSeek, Qwen, Llama…) en
// vez de abrir cuenta con cada fabricante. Habla el dialecto de OpenAI.

/**
 * Traduce los fallos de OpenRouter a algo que se entienda en la pantalla.
 *
 * El error crudo llega como un bloque de JSON de 300 caracteres, y este es el
 * único proveedor de PREPAGO que usamos: sin saldo devuelve 402 y todas las
 * lecturas fallan igual. Un mensaje claro ahí ahorra ir a leer logs para
 * enterarse de que sólo faltaba comprar créditos.
 */
function explicarOpenRouter(status: number, cuerpo: string): string {
  if (status === 402) return "OpenRouter sin saldo — compra créditos en openrouter.ai/settings/credits";
  if (status === 401) return "la llave de OpenRouter no es válida";
  if (status === 429) return "OpenRouter pidió esperar (demasiadas peticiones seguidas)";
  if (status === 404) return "ese modelo ya no existe en OpenRouter";
  return `${status} ${cuerpo.slice(0, 200)}`;
}

async function conOpenRouter(p: Peticion): Promise<Omit<Recibo, "ms">> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ErrorProveedor("openrouter", "falta OPENROUTER_API_KEY");

  const contenido: unknown[] = [];
  for (const im of imagenesDe(p)) {
    contenido.push({
      type: "image_url",
      image_url: { url: `data:${im.mediaType};base64,${im.base64}` },
    });
  }
  contenido.push({ type: "text", text: p.texto });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: p.modelo.id,
      // Con holgura, y por la misma razón que en Gemini: cuando el modelo
      // razona, esos tokens salen de este presupuesto y el JSON llega cortado
      // a la mitad. Kimi K2.6 fallaba así — "Unterminated string in JSON".
      max_tokens: (p.maxTokens ?? 1024) * 4,
      // Razonamiento apagado donde el modelo lo permita. En Claude y en Gemini
      // también lo está: si un lado razona y el otro no, la comparación mide
      // dos cosas a la vez. Los modelos que no lo soportan ignoran el campo.
      reasoning: { enabled: false },
      // Pide el costo real ya calculado por OpenRouter: cada modelo de ahí
      // tiene su propio precio y mantenerlos a mano en PRECIOS sería una lista
      // desactualizándose sola.
      usage: { include: true },
      messages: [
        { role: "system", content: p.system },
        { role: "user", content: contenido },
      ],
      ...(p.schema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: "respuesta", strict: true, schema: p.schema },
            },
          }
        : {}),
    }),
  });

  if (!res.ok) {
    throw new ErrorProveedor("openrouter", explicarOpenRouter(res.status, await res.text()));
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };
  const texto = json.choices?.[0]?.message?.content;
  if (!texto) throw new ErrorProveedor("openrouter", "respuesta vacía");
  const tokens = {
    entrada: json.usage?.prompt_tokens ?? 0,
    salida: json.usage?.completion_tokens ?? 0,
  };
  return {
    texto,
    tokens,
    costoUsd: json.usage?.cost ?? costoUsd(p.modelo.id, tokens),
    truncada: json.choices?.[0]?.finish_reason === "length",
  };
}
