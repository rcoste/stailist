// Elige, entre las fotos YA APROBADAS de una familia, cuál sirve de referencia
// visual para una carta del deck.
//
// POR QUÉ UNA FOTO Y NO SOLO TEXTO
// La lección del deck de mujer v4: donde el outfit se describía con palabras, el
// generador rellenaba con lo más promedio que sabe y la carta salía sin punto de
// vista. Una foto fija proporción, textura y cómo cae la ropa — cosas que la
// receta describe pero que un párrafo no transmite.
//
// POR QUÉ DEL MATERIAL PROPIO Y NO DE PINTEREST
// Ya hay 616 fotos curadas a mano y etiquetadas por familia. Ir a cosechar de
// nuevo antes de agotarlas es trabajo tirado. Solo lo que aquí no aparezca
// —los sub-sabores como Y2K, que no son el centro de su familia— se busca fuera.
//
// El modelo puede contestar "ninguna": una elección floja es peor que ninguna,
// porque manda a generar la carta contra una foto que no es lo que se pidió.
//
// Uso: node scripts/elegir-ref-carta.mjs
// Lee las hojas de contacto del scratchpad y escribe el veredicto en JSON.

import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const S = process.env.HOJAS ?? ".";
const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("ANTHROPIC_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const client = new Anthropic({ apiKey: key });

// [carta, familia, qué tiene que leerse en la foto]
const CARTAS = [
  ["glam-noche", "sastre", "ropa de SALIR de noche: registro de traje pero con brillo o satén, camisa oscura abierta, botín pulido. Que se lea 'voy a cenar/a un bar', no 'voy a la oficina'."],
  ["minimalista", "casual-limpio", "minimalismo con INTENCIÓN: dos colores, superficie lisa, proporción cuidada (una zona con volumen). Que se lea decidido, no 'me puse lo primero'."],
  ["streetwear", "street-urbano", "streetwear de verdad: volumen oversize claro, sudadera o playera gráfica, pantalón ancho, tenis con presencia, gorra o bolsa cruzada. Con actitud, no tímido."],
  ["y2k", "street-urbano", "años 2000: talle BAJO, jean muy ancho o carpintero, playera corta o ceñida gráfica, gorra de camionero, tenis voluminosos. Si nada se ve de los 2000, contesta ninguna."],
  ["athleisure", "deportivo", "deportivo bien puesto para diario: conjunto o piezas técnicas limpias, sudadera o playera deportiva con jogger o short bien cortado. Nada de mallas debajo del short."],
  ["gorpcore", "deportivo", "técnico de montaña en la ciudad: chamarra shell con cordones, color técnico (no todo negro), pantalón nylon, bolsa cruzada apretada, tenis de trail."],
  ["hipster", "thrift-vintage", "thrift con personalidad: mezcla de prendas de segunda mano con carácter — estampado, punto grueso, lentes. Que se lea joven y curado, no ropa de señor."],
  ["boho", "resort-boho", "boho: estampado o textura como protagonista, camisa abierta fluida, joyería en capas. Paleta natural SIN naranja ni terracota."],
];

const schema = {
  type: "object",
  properties: {
    elegida: { type: "string", description: "El número de la foto tal cual aparece bajo ella (ej. \"014\"), o \"ninguna\"." },
    porque: { type: "string", description: "Una frase: qué de esa foto cumple lo pedido." },
    outfit: { type: "string", description: "El outfit de la foto elegida, prenda por prenda con su color, en español. Vacío si ninguna." },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
  },
  required: ["elegida", "porque", "outfit", "confianza"],
  additionalProperties: false,
};

const out = {};
for (const [carta, familia, sello] of CARTAS) {
  const hoja = readFileSync(`${S}/hoja-${familia}.jpg`).toString("base64");
  // Reintento: una respuesta sin bloque de texto (se acabaron los tokens a
  // media estructura) tumbaba la corrida entera y perdía lo ya elegido.
  let v = null;
  for (let intento = 1; intento <= 3 && !v; intento++) {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: hoja } },
            {
              type: "text",
              text:
                `Esta hoja son fotos de calle aprobadas de la familia "${familia}". Cada foto tiene su número debajo.\n\n` +
                `Busco UNA que sirva de referencia para la carta "${carta}" del swipe de estilos. Tiene que leerse así:\n${sello}\n\n` +
                `Elige la que MEJOR lo cumpla. Si ninguna lo cumple de verdad, contesta "ninguna" — una elección floja es peor que ninguna, porque manda a generar la carta contra una foto que no es lo que se pidió.`,
            },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });
    const txt = res.content.find((c) => c.type === "text")?.text;
    if (txt) v = JSON.parse(txt);
    else console.warn(`  ${carta}: respuesta sin texto (${res.stop_reason}), reintento ${intento}`);
  }
  if (!v) { console.error(`${carta}: sin veredicto tras 3 intentos`); continue; }
  out[carta] = { familia, ...v };
  console.log(`${carta.padEnd(16)} ${v.elegida.padEnd(8)} ${v.confianza.padEnd(6)} ${v.porque}`);
  writeFileSync(`${S}/refs-elegidas.json`, JSON.stringify(out, null, 2));
}

writeFileSync(`${S}/refs-elegidas.json`, JSON.stringify(out, null, 2));
console.log(`\n→ ${S}/refs-elegidas.json`);
