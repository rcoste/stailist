// El grid de apetito de acentos: 3 niveles × 2 climas × 2 géneros = 12 fotos.
//
// PARA QUÉ
// Falta en el perfil la dimensión "¿cuánta atención quieres que atraiga tu
// ropa?" — el volumen de color, independiente de la colorimetría (QUÉ colores
// te van) y del arquetipo (qué vibe eres). Roberto la pidió tras ver un suéter
// cobalto: "probablemente no me lo hubiera puesto; hubiera usado marino".
// Spec: docs/designs/pantalla-apetito-acentos.md.
//
// LA REGLA DE DISEÑO ES LA DE gen-pares-corte.mjs, y por el mismo motivo: en
// una columna sólo puede cambiar UNA cosa. Si el look base cambiara entre
// niveles, la respuesta no diría nada — ¿eligió por el acento o porque le
// gustó más ese outfit? Por eso los tres niveles NO se generan por separado:
// se ENCADENAN desde el discreto, con la instrucción de conservar persona,
// pose, luz y prendas y cambiar sólo el acento.
//
// TRES NIVELES, DOS CLIMAS
// El nivel es lo que se mide (la persona toca la FILA). Las dos columnas son
// el MISMO nivel en frío y en calor, y están porque el VEHÍCULO del acento
// cambia con el clima aunque el apetito no: en frío es la bufanda o el knit,
// en calor el polo o el calzado. Decisión de Roberto: no se segmenta por el
// clima de quien mira — ver los dos calibra el gusto general y de paso enseña
// qué significa el nivel en cada estación.
//
// LOS VEHÍCULOS SE ELIGEN POR VISIBILIDAD. El acento clásico de nivel medio en
// hombre es el calcetín y en una miniatura no se ve; se usan bufanda (frío) y
// tenis (calor), igual de legítimos y legibles. El color sobrevive a la
// miniatura mucho mejor que el corte — por eso este grid aguanta 6 fotos donde
// pares-corte sólo aguantaba 2.
//
// Uso:  node scripts/gen-acentos.mjs [--only=hombre|mujer]
// Salida: public/acentos/<genero>-<frio|calor>-<discreto|medio|protagonista>.png

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const SALIDA = "public/acentos";
mkdirSync(SALIDA, { recursive: true });

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

const b64 = (p) => readFileSync(p).toString("base64");
const mime = (p) => (p.endsWith(".png") ? "image/png" : "image/jpeg");

// Los MISMOS modelos que los pares de corte: el reparto de la app es
// moreno/mestizo porque la usuaria es mexicana.
const AVATAR = {
  hombre: "docs_para_claude/avatars-hombre/m1.png",
  mujer: "docs_para_claude/roster-mujer/av3.png",
};

// Los colores de acento son FIJOS y seguros: la pantalla mide VOLUMEN, no
// matiz. Ninguno pisa el veto de la casa (ámbar/terracota/naranja), y los tres
// funcionan en casi cualquier colorimetría.
const ESCENA =
  "A plain light concrete wall in soft even daylight, nothing else in frame.";

const COLUMNAS = {
  hombre: [
    {
      clima: "frio",
      // Nivel 1 — el ejemplo literal de Roberto: "el abrigo con un crew neck
      // azul marino, que es algo más neutral".
      discreto:
        "a charcoal grey wool overcoat, open, over a NAVY fine-knit crew-neck sweater, plain dark grey trousers and black leather chelsea boots",
      medio:
        "Add ONE thing only: a deep BURGUNDY wool scarf draped around the neck, hanging down the front over the sweater. Everything else stays exactly as it is — the same coat, the same navy sweater, the same trousers and boots.",
      protagonista:
        "Change ONE thing only: the crew-neck sweater is now COBALT BLUE, a strong saturated blue, same fine knit and same shape. Remove the scarf if present. The coat, trousers and boots stay exactly the same.",
    },
    {
      clima: "calor",
      discreto:
        "a plain STONE BEIGE short-sleeve polo shirt, tucked loosely into mid-grey lightweight trousers, with plain white leather sneakers",
      medio:
        "Change ONE thing only: the sneakers are now BURGUNDY leather loafers, and a matching burgundy leather belt is visible at the waist. The polo, the trousers and everything else stay exactly the same.",
      protagonista:
        "Change ONE thing only: the polo shirt is now EMERALD GREEN, a rich saturated green, same short-sleeve polo shape and same fabric. The shoes go back to plain white sneakers and the belt is plain dark. The trousers stay exactly the same.",
    },
  ],
  mujer: [
    {
      clima: "frio",
      discreto:
        "a charcoal grey wool overcoat, open, over a NAVY fine-knit crew-neck sweater, plain dark grey straight trousers and black leather ankle boots",
      medio:
        "Add ONE thing only: a deep BURGUNDY wool scarf draped around the neck, hanging down the front over the sweater. Everything else stays exactly as it is — the same coat, the same navy sweater, the same trousers and boots.",
      protagonista:
        "Change ONE thing only: the crew-neck sweater is now COBALT BLUE, a strong saturated blue, same fine knit and same shape. Remove the scarf if present. The coat, trousers and boots stay exactly the same.",
    },
    {
      clima: "calor",
      discreto:
        "a plain STONE BEIGE short-sleeve knit top, tucked loosely into mid-grey lightweight trousers, with plain white leather sneakers",
      medio:
        "Change ONE thing only: she is now carrying a BURGUNDY leather shoulder bag and wearing burgundy leather flats instead of the sneakers. The top, the trousers and everything else stay exactly the same.",
      protagonista:
        "Change ONE thing only: the knit top is now EMERALD GREEN, a rich saturated green, same short-sleeve shape and same fabric. The bag is gone and the shoes go back to plain white sneakers. The trousers stay exactly the same.",
    },
  ],
};

// Pose FRONTAL y quieta, igual que los pares de corte: aquí la foto es un
// instrumento de medición, no una carta que vende un look.
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
  const pron = genero === "hombre" ? "He" : "She";

  for (const col of COLUMNAS[genero]) {
    const p = (nivel) => `${SALIDA}/${genero}-${col.clima}-${nivel}.png`;

    // 1) DISCRETO, desde el avatar. Es la base de la columna entera.
    const ok = await pedir(
      [
        {
          text:
            `Full-body photograph of the SAME ${persona} shown in the reference image. Keep ${poss} face, hair, skin tone, ` +
            `body build, height and age EXACTLY as in the reference; do NOT change ${poss} ethnicity. ` +
            `${pron} is wearing ${col.discreto}. SCENE: ${ESCENA} ${COMUN}`,
        },
        { inlineData: { mimeType: mime(avatar), data: b64(avatar) } },
      ],
      p("discreto"),
      `${genero} ${col.clima} — discreto`
    );
    if (!ok) continue;

    // 2) y 3) MEDIO y PROTAGONISTA, los dos ENCADENADOS DESDE EL DISCRETO (no
    //    en cascada medio→protagonista: el error se acumularía y el
    //    protagonista acabaría siendo otra foto). Cada uno es la misma base con
    //    un solo cambio, que es lo que hace honesta la columna.
    for (const nivel of ["medio", "protagonista"]) {
      await pedir(
        [
          {
            text:
              `Take the photograph in the reference image and change ONE thing only. ${col[nivel]} ` +
              `EVERYTHING else must stay pixel-for-pixel the same: the same person with the same face and body, the same pose, ` +
              `the same framing and camera distance, the same background, the same light, the same trousers. ` +
              `This is a set where only the colour accent differs. ${COMUN}`,
          },
          { inlineData: { mimeType: "image/png", data: b64(p("discreto")) } },
        ],
        p(nivel),
        `${genero} ${col.clima} — ${nivel}`
      );
    }
  }
}

console.log(`\nListo → ${SALIDA}`);
