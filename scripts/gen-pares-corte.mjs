// Los pares de corte: dos fotos donde lo ÚNICO distinto es cómo queda la ropa.
//
// PARA QUÉ
// 8 de las 10 recetas destiladas dicen "manda la preferencia de la persona"
// entre recto y holgado, y esa preferencia no se preguntaba nunca. Preguntarla
// con palabras no sirve —"¿corte standard o relajado?" asume un vocabulario que
// justo no tiene quien no sabe vestirse—, así que se mide viendo: dos fotos,
// eliges una.
//
// LA REGLA DE DISEÑO, Y POR QUÉ EL SCRIPT ESTÁ HECHO ASÍ
// En un par A/B solo puede cambiar UNA cosa. Si cambian dos, la respuesta no
// dice nada: eligió B, ¿por el corte o porque el modelo le cayó mejor? Por eso
// las dos fotos NO se generan por separado desde el mismo texto — dos corridas
// del generador dan dos personas ligeramente distintas, otra luz y otro tono de
// prenda, y el par queda inservible.
//
// En su lugar se ENCADENAN: primero la opción "recta", y la "holgada" se genera
// USANDO LA RECTA como referencia, con la instrucción de conservar persona,
// lugar, luz y prendas y cambiar solo el corte. Es la misma técnica del try-on:
// el delta mínimo es lo que hace honesto el dato.
//
// DOS PARES, NO UNO NI CINCO
// Uno solo no permite distinguir "prefiere holgado" de "le tocó picarle a algo".
// Con dos, si coinciden hay preferencia; si no coinciden, la persona no tiene
// preferencia fuerte y eso también es información (se guarda como 'mixta'). Más
// de dos empieza a pesar en un onboarding cuya promesa es el primer outfit en
// menos de dos minutos.
//
// Par 1 = volumen ABAJO (pierna recta vs pierna amplia).
// Par 2 = volumen ARRIBA (tejido a talla vs tejido con caída).
// Los dos preguntan el mismo eje desde lados distintos del cuerpo, que es lo que
// evita medir "me gustan los pantalones anchos" en vez de "me gusta la ropa
// holgada".
//
// Uso:  node scripts/gen-pares-corte.mjs [--only=hombre|mujer]
// Salida: public/corte/<genero>-<par>-<recta|holgada>.png

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const SALIDA = "public/corte";
mkdirSync(SALIDA, { recursive: true });

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

const b64 = (p) => readFileSync(p).toString("base64");
const mime = (p) => (p.endsWith(".png") ? "image/png" : "image/jpeg");

// Un solo modelo por género en los cuatro pares: si cambia la persona entre el
// par 1 y el par 2, las dos respuestas ya no miden lo mismo.
// av3 y no av1: el reparto de la app es moreno/mestizo porque la usuaria es
// mexicana, y av1 es rubia de piel clara.
const AVATAR = {
  hombre: "docs_para_claude/avatars-hombre/m1.png",
  mujer: "docs_para_claude/roster-mujer/av3.png",
};

// Ropa deliberadamente NEUTRA y sin estilo marcado: la pregunta es el corte, y
// si el look tuviera personalidad (una chamarra de cuero, un estampado) la
// persona respondería a eso. Paleta de dos tonos apagados por la misma razón.
const PARES = {
  hombre: [
    {
      par: 1,
      escena: "A plain light concrete wall in soft even daylight, nothing else in frame.",
      recta:
        "a plain mid-grey crew-neck t-shirt tucked loosely into STRAIGHT-LEG charcoal trousers that fall clean and narrow over plain white sneakers, and a thin leather belt",
      cambio:
        "Change ONLY the trousers: same charcoal colour and same fabric, but now WIDE-LEG and fluid, high-waisted, with much more volume through the thigh and a wide hem breaking over the same sneakers.",
    },
    {
      par: 2,
      escena: "A plain light concrete wall in soft even daylight, nothing else in frame.",
      recta:
        "a beige fine-knit sweater that follows the body closely with a neat shoulder seam, over plain dark straight trousers and plain white sneakers",
      cambio:
        "Change ONLY the sweater: same beige colour and same fine knit, but now clearly OVERSIZED and boxy — dropped shoulder seams down the upper arm, wide body, longer hem. The trousers, shoes and everything else stay identical.",
    },
  ],
  mujer: [
    {
      par: 1,
      escena: "A plain light concrete wall in soft even daylight, nothing else in frame.",
      recta:
        "a plain mid-grey crew-neck t-shirt tucked loosely into STRAIGHT-LEG charcoal trousers that fall clean and narrow over plain white sneakers, and a thin leather belt",
      cambio:
        "Change ONLY the trousers: same charcoal colour and same fabric, but now WIDE-LEG and fluid, high-waisted, with much more volume through the thigh and a wide hem breaking over the same sneakers.",
    },
    {
      par: 2,
      escena: "A plain light concrete wall in soft even daylight, nothing else in frame.",
      recta:
        "a beige fine-knit sweater that follows the body closely with a neat shoulder seam, over plain dark straight trousers and plain white sneakers",
      cambio:
        "Change ONLY the sweater: same beige colour and same fine knit, but now clearly OVERSIZED and boxy — dropped shoulder seams down the upper arm, wide body, longer hem. The trousers, shoes and everything else stay identical.",
    },
  ],
};

// Pose FRONTAL y quieta, al revés que el deck. Ahí la pose candid vende el
// look; aquí una pierna adelantada o un giro cambiarían cómo se lee la caída y
// contaminarían justo lo que se está midiendo.
const COMUN =
  "FRAMING: full body head to feet, centred, straight on, the whole outfit clearly visible including the shoes. " +
  "POSE: standing still and relaxed, feet slightly apart, arms hanging naturally at the sides, weight even on both legs. " +
  "EXPRESSION: calm neutral face, relaxed closed mouth, no smiling, looking straight ahead. " +
  "Photorealistic, sharp, neutral white balance, even soft light with no dramatic shadows. " +
  "CRITICAL: no logos, no brand names, no text anywhere, no watermark.";

async function pedir(parts, salida, etiqueta) {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
          }),
        }
      );
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!img) throw new Error("respuesta sin imagen");
      writeFileSync(salida, Buffer.from(img.inlineData.data, "base64"));
      console.log(`OK  ${etiqueta}`);
      return true;
    } catch (e) {
      if (intento === 3) { console.error(`FALLÓ ${etiqueta}: ${e.message}`); return false; }
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}

for (const genero of ["hombre", "mujer"]) {
  if (ONLY && !ONLY.includes(genero)) continue;
  const avatar = AVATAR[genero];
  if (!existsSync(avatar)) { console.error(`FALTA avatar: ${avatar}`); continue; }
  const persona = genero === "hombre" ? "man" : "woman";
  const poss = genero === "hombre" ? "his" : "her";

  for (const { par, escena, recta, cambio } of PARES[genero]) {
    const pathRecta = `${SALIDA}/${genero}-${par}-recta.png`;
    const pathHolgada = `${SALIDA}/${genero}-${par}-holgada.png`;

    // 1) La opción RECTA, desde el avatar.
    const ok = await pedir(
      [
        {
          text:
            `Full-body photograph of the SAME ${persona} shown in the reference image. Keep ${poss} face, hair, skin tone, ` +
            `body build, height and age EXACTLY as in the reference; do NOT change ${poss} ethnicity. ` +
            `${persona === "man" ? "He" : "She"} is wearing ${recta}. SCENE: ${escena} ${COMUN}`,
        },
        { inlineData: { mimeType: mime(avatar), data: b64(avatar) } },
      ],
      pathRecta,
      `${genero} par ${par} — recta`
    );
    if (!ok) continue;

    // 2) La HOLGADA, desde la recta recién hecha. Aquí está todo el asunto:
    //    generarla desde el avatar otra vez daría otra persona, otra luz y otro
    //    tono de prenda, y entonces el par mediría cualquier cosa menos el corte.
    await pedir(
      [
        {
          text:
            `Take the photograph in the reference image and change ONE thing only. ${cambio} ` +
            `EVERYTHING else must stay pixel-for-pixel the same: the same person with the same face and body, the same pose, ` +
            `the same framing and camera distance, the same background, the same light, the same colours, the same shoes. ` +
            `This is a before/after pair where only the garment cut differs. ${COMUN}`,
        },
        { inlineData: { mimeType: "image/png", data: b64(pathRecta) } },
      ],
      pathHolgada,
      `${genero} par ${par} — holgada`
    );
  }
}

console.log(`\nListo → ${SALIDA}`);
