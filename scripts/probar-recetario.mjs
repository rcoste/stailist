// Prueba de RECONSTRUCCIÓN del recetario: ¿se puede rearmar el estilo teniendo
// solo lo destilado?
//
// POR QUÉ ESTA PRUEBA Y NO EL A/B
// El A/B sobre un clóset real mezcla dos preguntas —si la destilación es
// correcta Y si el motor sabe aplicarla con la ropa que hay—, así que un mal
// resultado no dice cuál de las dos falló. Aquí se aísla la primera: se genera
// el outfit IDEAL del estilo, sin restricción de clóset, usando ÚNICAMENTE el
// texto del recetario. Si lo generado se ve como las fotos de las que salió, la
// destilación capturó el estilo. Si no, está mal y hay que arreglarla antes de
// que llegue al motor.
//
// LA REGLA QUE HACE VÁLIDA LA PRUEBA
// NO se le pasa ninguna foto de referencia al generador. Solo el avatar (para
// que la persona sea la misma) y el texto de la receta. Pasarle la foto del
// outfit probaría que sabe copiar una imagen, que no es lo que está en duda.
//
// Uso: node scripts/probar-recetario.mjs [--only=<id>]
// Salida: /tmp/recetario-prueba/<estilo>-<n>.png

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const SALIDA = "/tmp/recetario-prueba";
mkdirSync(SALIDA, { recursive: true });

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()) : null;

const { RECETAS_HOMBRE } = await import("../lib/engine/recetario.ts");

const b64 = (p) => readFileSync(p).toString("base64");

// El reparto es el MISMO que el del deck de swipes (genz-roster/hombre-0N.png),
// no el de avatars-hombre/ — ese quedó obsoleto en junio y usarlo hacía que la
// prueba se viera de otro producto.
//
// Un modelo fijo por estilo, distinto entre estilos: dentro de un estilo la
// comparación tiene que ser de ROPA, y si cambia la cara entre las tres fotos
// eso es lo primero que salta.
const AVATARES = {
  "clasico-elegante": "hombre-02.png",
  minimalista: "hombre-01.png",
  "smart-casual": "hombre-04.png",
};
const AV = (f) => `docs_para_claude/genz-roster/${f}`;

// Escena por estilo: neutra pero real. El fondo no debe hacer el trabajo que le
// toca a la ropa — si el estilo solo se lee por la locación, la destilación no
// sirve. Aun así no puede ser una pared de estudio: las fotos de origen son de
// calle y la comparación tiene que ser justa.
const ESCENAS = {
  "smart-casual":
    "A city sidewalk beside a plain modern building facade, soft overcast daylight, blurred street behind.",
  "clasico-elegante":
    "A quiet old European street with pale stone facades, warm late-afternoon light.",
  minimalista:
    "A plain pale concrete wall outdoors with a strip of pavement, soft even daylight.",
};

const IDENTIDAD =
  "Keep his face, hair, skin tone, build and age EXACTLY as in the reference image. Do NOT change his ethnicity. " +
  "Only his clothes and pose change.";

const FRAMING =
  "FRAMING: full body head to feet, the whole outfit clearly visible including the shoes. " +
  "Candid street-style, caught mid-moment. NOT a stiff centered catalog pose.";

const EXPRESSION =
  "EXPRESSION: calm neutral face, relaxed closed mouth. No smiling, no teeth. Looking away to the side.";

const SIN_MARCAS =
  "CRITICAL: no visible logos, no brand names, no text anywhere on the garments or in the scene.";

async function gen(estilo, n, formula, silueta, detalles, vetos, escena, avatar) {
  const nombre = `${estilo}-${n}.png`;
  // La silueta y los detalles van junto con la fórmula porque son justo la parte
  // que un listado de prendas no transmite: "camisa + pantalón + mocasín" lo
  // cumple igual un look entallado que uno con caída, y ahí se decide si el
  // estilo se lee o no.
  const text =
    `Full-body candid street-style fashion photograph of the SAME man shown in the reference image. ${IDENTIDAD} ` +
    `He is wearing: ${formula}. ` +
    `SILHOUETTE (this matters as much as the garments): ${silueta} ` +
    `EXECUTION DETAILS: ${detalles} ` +
    `NEVER: ${vetos} ` +
    `${FRAMING} ${EXPRESSION} SCENE: ${escena} ` +
    `Photorealistic depth of field, high quality, sharp. ${SIN_MARCAS} No watermark.`;

  const parts = [
    { text },
    { inlineData: { mimeType: "image/png", data: b64(AV(avatar)) } },
  ];

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: { aspectRatio: "3:4" },
            },
          }),
        }
      );
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!img) throw new Error("respuesta sin imagen");
      writeFileSync(`${SALIDA}/${nombre}`, Buffer.from(img.inlineData.data, "base64"));
      console.log(`OK → ${nombre}`);
      return;
    } catch (e) {
      if (intento === 3) {
        console.error(`FALLÓ ${nombre}: ${e.message}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}

for (const receta of RECETAS_HOMBRE) {
  if (ONLY && !ONLY.includes(receta.id)) continue;
  const escena = ESCENAS[receta.id] ?? ESCENAS.minimalista;
  // Tres fórmulas separadas entre sí, no las tres primeras: si salen tres
  // variaciones de lo mismo, la prueba no dice si el estilo tiene rango.
  const paso = Math.max(1, Math.floor(receta.formulas.length / 3));
  const elegidas = [0, paso, paso * 2].map((i) => receta.formulas[i]).filter(Boolean);
  // TODOS los detalles y TODOS los vetos. La primera versión mandaba
  // detalles.slice(0, 4) y ningún "evitar" — un recorte arbitrario que dejaba
  // fuera, en minimalista, justo "sin textura dos colores se ven pobres" y "nada
  // de prendas entalladas". La prueba estaba juzgando una versión mutilada del
  // recetario y atribuyéndole al recetario fallas del recorte.
  const detalles = receta.detalles.join(" ");
  const vetos = receta.evitar.join(" ");
  const avatar = AVATARES[receta.id] ?? "hombre-01.png";

  for (let i = 0; i < elegidas.length; i++) {
    await gen(receta.id, i + 1, elegidas[i], receta.silueta, detalles, vetos, escena, avatar);
  }
}

console.log(`\nListo. Las imágenes están en ${SALIDA}`);
