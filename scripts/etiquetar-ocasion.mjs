// Etiqueta cada foto de la biblioteca con la OCASIÓN para la que sirve.
//
// POR QUÉ
// Roberto pidió que la inspiración fuera "acorde a la ocasión" y no lo era: la
// biblioteca se destiló con estilo, clima, paleta y silueta, y nadie anotó si un
// look es de oficina, de diario o de salir de noche. Resultado: para un evento
// de noche se le enseñaron al motor fotos de looks casuales, y en 4 de los 12
// casos la referencia no podía ayudar.
//
// ES EL TALACHE ACOTADO, no el grande. La idea de Roberto era etiquetar cada
// foto pieza por pieza; esto es una sola pregunta por foto y desbloquea lo mismo
// para la prueba. Si la prueba funciona, el desglose de prendas viene después.
//
// MULTI-OCASIÓN A PROPÓSITO
// Un look no sirve para una sola cosa: unos chinos con camisa oxford valen para
// oficina y para diario. Forzar una sola etiqueta tiraría la mitad de la
// biblioteca en cada consulta.
//
// SOLO LAS FAMILIAS QUE HAGAN FALTA (--familias=a,b)
// Roberto: "en vez de hacer las 616, un subuniverso de las que aplican para mí;
// para qué ponemos todos los estilos". Correcto: para probar la idea con su
// perfil bastan casual-limpio y preppy — 150 fotos en vez de 616. Si la prueba
// funciona, el resto se etiqueta después y ya sabiendo que vale la pena.
//
// Uso: node scripts/etiquetar-ocasion.mjs [--limite=10] [--familias=a,b] [--aplicar]
//      sin --aplicar solo muestra qué haría (para revisar el criterio antes de
//      gastar la corrida).

import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const arg = (k, d) =>
  Number((process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1]);
const LIMITE = arg("limite", 10);
const CONC = arg("conc", 5);
const APLICAR = process.argv.includes("--aplicar");
/** Etiquetar las que AÚN NO se curan, para que se curen con la ocasión a la vista. */
const PENDIENTES = process.argv.includes("--pendientes");
const FAMILIAS = (process.argv.find((a) => a.startsWith("--familias=")) ?? "")
  .replace("--familias=", "")
  .split(",")
  .filter(Boolean);

// Las mismas claves que usa el producto (app/onboarding/objetivo/objectives.ts),
// para que el filtro del selector sea una comparación directa y no una tabla de
// equivalencias que se desincroniza.
const ESQUEMA = {
  type: "object",
  properties: {
    ocasiones: {
      type: "array",
      description: "TODAS las ocasiones para las que este look sirve tal cual.",
      items: { type: "string", enum: ["diario", "oficina", "evento", "viaje"] },
    },
    registro: {
      type: "string",
      description: "Qué tan arreglado va el look.",
      enum: ["relajado", "cuidado", "arreglado", "formal"],
    },
    de_noche: {
      type: "boolean",
      description: "Si el look funciona para salir de noche (oscuro, con intención).",
    },
  },
  required: ["ocasiones", "registro", "de_noche"],
  additionalProperties: false,
};

const SYSTEM = `Miras la foto de un look de calle y dices PARA QUÉ SIRVE. No opinas de gusto ni de estilo: solo clasificas.

OCASIONES (marca todas las que apliquen, no solo una — un look de chinos y camisa sirve para oficina Y para diario):
- "diario": día a día, salir a la calle, café, mandados.
- "oficina": trabajo de oficina. HOY las oficinas van de la corporativa (traje) a la creativa (hoodie con pantalón de tela y tenis limpios): si el look se ve presentable y no es de gimnasio ni de playa, cuenta. Lo que NO entra: short, ropa deportiva de entrenar, chanclas, playera de tirantes.
- "evento": una cena, una boda, un coctel, algo donde la gente se arregla. Pide saco, camisa de vestir o calzado de piel.
- "viaje": aeropuerto y traslados largos. Cómodo pero presentable, con capas.

REGISTRO — qué tan arreglado:
- "relajado": camiseta, sudadera, tenis deportivos, shorts.
- "cuidado": vaqueros o chinos con camisa o punto, tenis limpios o botín.
- "arreglado": saco o blazer, camisa, calzado de piel.
- "formal": traje completo, corbata, zapato de vestir.

EL ENTORNO DE LA FOTO ES UNA PISTA, úsalo: si está en una oficina, en un evento, en un aeropuerto o en la playa, eso dice para qué es el look mejor que cualquier regla. Una foto tomada en una oficina, con un look presentable, ES de oficina aunque lleve tenis.

Ante la duda, MARCA de más en ocasiones (mejor una foto de referencia de sobra que ninguna) y de MENOS en registro (no llames "formal" a un blazer con jeans).`;

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const client = new Anthropic();

  // ANTES de curar, no después (--pendientes).
  //
  // Etiquetar solo lo ya aprobado ahorraba visión sobre fotos que quizá se
  // rechazan, pero dejaba a la ocasión SIN NADIE QUE LA VERIFIQUE: el humano
  // juzga el estilo a ciegas de la ocasión, la máquina la pone después y ahí
  // muere el asunto. Es justo lo que perdió el A/B de las fotos de inspiración
  // — la máquina marcó "oficina" en looks casuales (215 "cuidado" contra 77
  // "arreglado") y no había quién la corrigiera. Roberto: "una cosa es sastre y
  // otra para qué ocasión; no puedo decir qué tan bien está algo con info
  // incompleta". Tiene razón, y el ahorro no compensa: son centavos de visión
  // contra la única señal humana que tenemos.
  let q = s
    .from("referencias")
    .select("id, path, estilo, clima")
    .is("ocasiones", null);
  q = PENDIENTES ? q.is("sirve", null) : q.eq("sirve", true);
  if (FAMILIAS.length) q = q.in("estilo", FAMILIAS);
  const { data: filas } = await q.limit(LIMITE);

  if (!filas?.length) {
    console.log("No hay fotos pendientes de etiquetar.");
    return;
  }
  console.log(`${filas.length} fotos por etiquetar${APLICAR ? "" : " (simulación)"}\n`);

  let hechas = 0;
  const etiquetar = async (f) => {
    try {
      const { data: bin } = await s.storage.from("referencias").download(f.path);
      if (!bin) throw new Error("no se pudo bajar");
      const b64 = Buffer.from(await bin.arrayBuffer()).toString("base64");
      const res = await client.messages.create({
        // Clasificar contra criterios ya escritos: es el trabajo de CLASSIFY,
        // no del motor. Y son 616 llamadas.
        model: "claude-sonnet-5",
        max_tokens: 300,
        thinking: { type: "disabled" },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: f.path.endsWith(".png") ? "image/png" : "image/jpeg",
                  data: b64,
                },
              },
              { type: "text", text: "¿Para qué ocasiones sirve este look?" },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      const txt = res.content.find((b) => b.type === "text")?.text;
      const v = JSON.parse(txt);
      if (APLICAR) {
        await s
          .from("referencias")
          .update({ ocasiones: v.ocasiones, registro: v.registro, de_noche: v.de_noche })
          .eq("id", f.id);
      }
      console.log(
        `  ${String(++hechas).padStart(3)}  ${f.estilo.padEnd(18)} ${f.clima.padEnd(9)} ${v.registro.padEnd(10)} ${v.de_noche ? "noche " : "      "} ${v.ocasiones.join(",")}`
      );
    } catch (e) {
      console.error(`  ${f.path}: ${e.message.slice(0, 70)}`);
    }
  };

  for (let i = 0; i < filas.length; i += CONC) {
    await Promise.all(filas.slice(i, i + CONC).map(etiquetar));
  }
  console.log(`\n${hechas}/${filas.length} etiquetadas${APLICAR ? " y guardadas" : " (nada guardado)"}`);
}

main();
