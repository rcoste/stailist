// Elige, de una cosecha cruda de Pinterest, las 3 mejores alternativas de outfit
// para una carta del deck.
//
// POR QUÉ FILTRAR ANTES DE ENSEÑAR
// Pinterest devuelve ~60% de basura para estas búsquedas: collages de varias
// fotos, portadas de blog con texto encima ("40 Y2K OUTFITS FOR 2025"), flat
// lays de prendas sin persona, y renders de IA. Enseñarle 18 fotos crudas a
// Roberto por cada una de 17 cartas son 300 imágenes de las que 180 no se
// pueden usar — eso no es darle opciones, es darle trabajo.
//
// El filtro corre en dos pasos dentro de la misma llamada: primero descarta lo
// inservible por FORMATO, y de lo que queda elige por qué tan bien lee el
// estilo, usando la receta destilada de su familia como criterio (no el gusto
// del modelo).
//
// Devuelve hasta 3 y puede devolver menos —incluso ninguna— si la cosecha no
// trae nada mejor que la carta actual. Rellenar hasta 3 con opciones flojas
// haría que la comparación se sienta como que hay mejora cuando no la hay.
//
// Uso: node scripts/alternativas-carta.mjs
// Lee las carpetas del scratchpad y escribe alternativas.json

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const S = process.env.COSECHA;
if (!S) throw new Error("falta COSECHA=<carpeta>");
const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("ANTHROPIC_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const client = new Anthropic({ apiKey: key });

// carta → [familia con receta, qué tiene que leerse]
const CARTAS = {
  sastre: ["sastre", "traje o saco sastre bien cortado llevado con soltura moderna, no de oficina rígida"],
  "clasico-elegante": ["clasico-arreglado", "elegancia discreta y atemporal: pantalón de caída, punto fino o camisa, calzado de piel; sin corbata ni traje completo"],
  "smart-casual": ["clasico-arreglado", "de la junta al after: una prenda pulida (saco, overshirt, punto) sobre algo relajado, pantalón de tela o jean limpio"],
  academia: ["clasico-arreglado", "intelectual: tweed, chaleco de punto, camisa con cuello, pantalón de lana; joven, no de profesor viejo"],
  "casual-effortless": ["casual-limpio", "diario sin esfuerzo pero armado: capa abierta ligera sobre playera lisa, jean o pantalón recto, tenis limpios"],
  coreano: ["casual-limpio", "K-fashion: abrigo o capa larga sin estructura, pantalón muy amplio y fluido, paleta neutra y monocroma; oversize pero intencional"],
  monocromatico: ["casual-limpio", "UN solo tono de arriba abajo, jugando con texturas distintas del mismo color; no tiene que ser negro"],
  preppy: ["preppy", "campus: suéter de ochos o rugby sobre camisa oxford con el cuello asomando, chino o pantalón recto, mocasín o tenis blanco"],
  nautico: ["preppy", "marinero: rayas breton, azul marino y blanco, saco o punto ligero; fresco, no disfraz de capitán"],
  edgy: ["edgy", "cuero negro y actitud: chamarra biker o similar, negro dominante, botín; sin caer en disfraz de rockero"],
  grunge: ["edgy", "noventas: franela a cuadros abierta sobre playera, jean holgado o roto, bota; suelto y sin pose"],
  utility: ["utilitario", "workwear: chore jacket o similar con bolsas de parche, cargo o pantalón de trabajo, bota; funcional de verdad"],
  vintage: ["thrift-vintage", "de segunda mano con historia: mezclilla, prenda retro, tenis viejos; con carácter y sin disfraz de época"],
  coastal: ["resort-boho", "lino y blancos de costa: camisa fluida, pantalón ligero, sandalia o tenis; luz de mar"],
  "tonos-tierra": [null, "gama tierra completa (camel, café, olivo, crema) mezclando TEXTURAS —pana, ante, punto—, no un conjunto liso"],
  "color-protagonista": [null, "UNA sola prenda de color fuerte como protagonista, todo lo demás neutro; el color es la historia"],
  romantico: [null, "suave y ligero: paleta clara o pastel, tejidos finos, aire gentil; masculino sin ser rudo"],
};

const RECETAS = Object.fromEntries(
  readdirSync("lib/engine/recetas").map((f) => {
    const j = JSON.parse(readFileSync(`lib/engine/recetas/${f}`, "utf8"));
    return [j.familia, j.receta];
  })
);

const schema = {
  type: "object",
  properties: {
    descartadas: {
      type: "array",
      description: "Números de las fotos inservibles por FORMATO (collage de varias fotos, texto o titular encima, flat lay sin persona, cuerpo incompleto, render de IA).",
      items: { type: "string" },
    },
    elegidas: {
      type: "array",
      description: "Hasta 3, de mejor a peor. Menos de 3 —o ninguna— si la cosecha no trae nada bueno.",
      items: {
        type: "object",
        properties: {
          foto: { type: "string", description: "El número tal cual aparece bajo la foto." },
          outfit: { type: "string", description: "El outfit prenda por prenda con su color, en español." },
          porque: { type: "string", description: "Una frase: por qué lee bien este estilo." },
        },
        required: ["foto", "outfit", "porque"],
        additionalProperties: false,
      },
    },
  },
  required: ["descartadas", "elegidas"],
  additionalProperties: false,
};

// Reanudable: 17 llamadas de visión son caras y una sola respuesta truncada
// tumbaba la corrida entera y repetía las que ya estaban bien.
const destino = `${S}/alternativas.json`;
const out = existsSync(destino) ? JSON.parse(readFileSync(destino, "utf8")) : {};
for (const [carta, [familia, sello]] of Object.entries(CARTAS)) {
  if (out[carta]) { console.log(`${carta.padEnd(20)} ya estaba`); continue; }
  const hoja = `${S}/hoja-${carta}.jpg`;
  if (!existsSync(hoja)) { console.error(`sin hoja: ${carta}`); continue; }
  const r = familia ? RECETAS[familia] : null;
  const criterio = r
    ? `Como criterio de EJECUCIÓN usa la receta destilada de su familia:\nSILUETA: ${r.silueta}\nPALETA: ${r.paleta}\nLO QUE LA ARRUINA: ${r.evitar.join(" ")}`
    : `No hay receta para esta carta (es un atributo, no una familia). Juzga solo por el sello.`;

  let v = null;
  for (let intento = 1; intento <= 3 && !v; intento++) {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      // 3000 no alcanzaba: con 18 descartes y 3 outfits descritos prenda por
      // prenda, la respuesta se cortaba a media cadena y el JSON quedaba roto.
      max_tokens: 6000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: readFileSync(hoja).toString("base64") } },
            {
              type: "text",
              text:
                `Cosecha cruda de Pinterest para la carta "${carta}" de un swipe de estilos masculinos. Cada foto tiene su número debajo.\n\n` +
                `PASO 1 — descarta por FORMATO: collages de varias fotos en una, portadas de blog con texto o titular encima, flat lays de prendas sin persona, fotos donde no se ve el outfit completo de pies a cabeza, y renders de IA.\n\n` +
                `PASO 2 — de las que sobrevivan, elige hasta 3 que mejor lean esto:\n${sello}\n\n${criterio}\n\n` +
                `La foto va a servir de referencia para vestir a NUESTRO modelo con ese outfit, así que juzga LA ROPA y cómo está puesta, no la cara ni el lugar.\n\n` +
                `Devuelve MENOS de 3 —o ninguna— si la cosecha no trae nada realmente bueno. Rellenar con opciones flojas es peor que devolver dos.`,
            },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });
    const txt = res.content.find((c) => c.type === "text")?.text;
    // Una respuesta cortada deja el JSON a medias: se reintenta, no se muere.
    try {
      if (txt) v = JSON.parse(txt);
      else console.warn(`  ${carta}: sin texto (${res.stop_reason}), reintento ${intento}`);
    } catch {
      console.warn(`  ${carta}: JSON truncado (${res.stop_reason}), reintento ${intento}`);
    }
  }
  if (!v) { console.error(`${carta}: sin veredicto`); continue; }
  out[carta] = v;
  console.log(`${carta.padEnd(20)} descarta ${String(v.descartadas.length).padStart(2)}  elige ${v.elegidas.map((e) => e.foto).join(",") || "—"}`);
  writeFileSync(`${S}/alternativas.json`, JSON.stringify(out, null, 2));
}
console.log(`\n→ ${S}/alternativas.json`);
