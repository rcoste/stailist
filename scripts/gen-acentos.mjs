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
// LA ESCALA ES ACUMULATIVA, Y NINGÚN NIVEL ES "SIN COLOR" (corrección de
// Roberto, 2026-08-25). La v1 puso "discreto = todo neutro, cero acento" y
// él lo cazó: "lo mínimo de acento sería como una bufanda; medio sería el
// crew neck y el otro algo más radical". Tiene razón por diseño de medición:
// con "nada" en el primer escalón, la pantalla pregunta "¿quieres color, sí o
// no?" en el primer salto y "¿cuánto?" en el segundo — dos preguntas. Así los
// tres escalones miden lo mismo y cada salto se ve:
//   1 discreto     — acento CHICO y lejos de la cara (bufanda, calzado)
//   2 medio        — pieza MEDIANA de color cerca de la cara (crew, polo)
//   3 protagonista — el color manda: pieza grande de color (abrigo, pantalón)
//
// DOS CLIMAS. Las columnas son el MISMO nivel en frío y en calor, porque el
// VEHÍCULO del acento cambia con el clima aunque el apetito no. Decisión de
// Roberto: no se segmenta por el clima de quien mira — ver los dos calibra el
// gusto general y enseña qué significa el nivel en cada estación.
//
// LOS VEHÍCULOS SE ELIGEN POR VISIBILIDAD: el acento clásico de nivel discreto
// en hombre es el calcetín y en miniatura no se ve; se usan bufanda (frío) y
// mocasín + cinturón (calor). El color sobrevive a la miniatura mucho mejor
// que el corte — por eso este grid aguanta 6 fotos donde pares-corte sólo 2.
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
// --nivel=medio,protagonista → rehace sólo esos, reusando el discreto que ya
// está en disco como base. Sirve para iterar UNA celda sin pagar la columna
// entera ni arriesgar que el discreto salga distinto y rompa la comparación.
const nivelArg = process.argv.find((a) => a.startsWith("--nivel="));
const NIVELES = nivelArg ? nivelArg.slice("--nivel=".length).split(",") : null;

const b64 = (p) => readFileSync(p).toString("base64");
const mime = (p) => (p.endsWith(".png") ? "image/png" : "image/jpeg");

// Los MISMOS modelos que los pares de corte: el reparto de la app es
// moreno/mestizo porque la usuaria es mexicana.
// m2 y no m1: Roberto descartó a m1 al ver la v1 de este grid.
const AVATAR = {
  hombre: "docs_para_claude/avatars-hombre/m2.png",
  mujer: "docs_para_claude/roster-mujer/av3.png",
};

// FONDO CLARO Y LIMPIO, no el concreto gris de los pares de corte: sobre gris
// medio los colores pierden fuerza, y esta pantalla mide justamente color.
// Roberto lo preguntó al ver la v1 ("no sé si sea el setting ideal").
const ESCENA =
  "A seamless off-white studio backdrop with a pale concrete floor, soft even daylight, nothing else in frame.";

// Los colores de acento son FIJOS y seguros: la pantalla mide VOLUMEN, no
// matiz. Burdeos, cobalto y esmeralda funcionan en casi cualquier
// colorimetría y ninguno pisa el veto de la casa (ámbar/terracota/naranja).
const COLUMNAS = {
  hombre: [
    {
      clima: "frio",
      // Base: abrigo carbón + crew marino + pantalón carbón. El ejemplo de
      // Roberto ("el abrigo con un crew neck azul marino, más neutral"), aquí
      // ya con su acento chico encima.
      discreto:
        "a charcoal grey wool overcoat, open, over a NAVY fine-knit crew-neck sweater, with a deep BURGUNDY wool scarf draped around the neck hanging down the front, plain dark grey trousers and black leather chelsea boots",
      medio:
        "Change ONE thing only: remove the burgundy scarf completely, and the crew-neck sweater is now COBALT BLUE — a strong saturated blue, same fine knit and same shape. The coat, trousers and boots stay exactly the same.",
      protagonista:
        "Change ONE thing only: the overcoat is now a rich DEEP EMERALD GREEN wool, same cut, same length, still open. The scarf is gone, the sweater underneath is the same NAVY fine knit as in the reference, and the trousers and boots stay exactly the same.",
    },
    {
      clima: "calor",
      // Base blanca + marino: el beige con gris medio de la v1 se enlodaba
      // (cálido contra frío) y Roberto lo cazó — "creo que ni siquiera va esa
      // combinación, está raro".
      discreto:
        "a plain WHITE short-sleeve polo shirt tucked loosely into navy blue lightweight chino trousers, with BURGUNDY leather loafers and a matching burgundy leather belt",
      medio:
        "Change ONE thing only: the polo shirt is now EMERALD GREEN, a rich saturated green, same short-sleeve polo shape and same fabric. The loafers and belt become plain dark brown. The navy trousers stay exactly the same.",
      // Pantalón de color y top neutro, NO polo esmeralda + pantalón burdeos:
      // esa versión salió complementaria verde/vino y Roberto la mató con la
      // descripción exacta — "parecen uvas". El criterio que la reemplaza es el
      // MISMO del frío: la pieza de mayor superficie del look en color, resto
      // neutro (allá el abrigo, aquí el pantalón).
      protagonista:
        "Change ONE thing only: the trousers are now COBALT BLUE, a strong saturated blue, same lightweight chino cut. The polo shirt goes back to plain WHITE and the loafers become plain dark brown. Same person, same pose, same background.",
    },
  ],
  mujer: [
    {
      clima: "frio",
      discreto:
        "a charcoal grey wool overcoat, open, over a NAVY fine-knit crew-neck sweater, with a deep BURGUNDY wool scarf draped around the neck hanging down the front, plain dark grey straight trousers and black leather ankle boots",
      medio:
        "Change ONE thing only: remove the burgundy scarf completely, and the crew-neck sweater is now COBALT BLUE — a strong saturated blue, same fine knit and same shape. The coat, trousers and boots stay exactly the same.",
      protagonista:
        "Change ONE thing only: the overcoat is now a rich DEEP EMERALD GREEN wool, same cut, same length, still open. The scarf is gone, the sweater underneath is the same NAVY fine knit as in the reference, and the trousers and boots stay exactly the same.",
    },
    {
      clima: "calor",
      discreto:
        "a plain WHITE short-sleeve knit top tucked loosely into navy blue lightweight trousers, carrying a BURGUNDY leather shoulder bag and wearing burgundy leather flats",
      medio:
        "Change ONE thing only: the knit top is now EMERALD GREEN, a rich saturated green, same short-sleeve shape and same fabric. The bag is gone and the flats become plain dark brown. The navy trousers stay exactly the same.",
      protagonista:
        "Change ONE thing only: the trousers are now COBALT BLUE, a strong saturated blue, same lightweight cut. The knit top goes back to plain WHITE, the bag is gone and the flats become plain dark brown. Same person, same pose, same background.",
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

    // 1) DISCRETO, desde el avatar. Es la base de la columna entera. Con
    //    --nivel se salta si ya existe: rehacerlo cambiaría la base y las
    //    otras dos dejarían de ser el mismo look.
    if (NIVELES && !NIVELES.includes("discreto") && existsSync(p("discreto"))) {
      for (const nivel of ["medio", "protagonista"].filter((n) => NIVELES.includes(n))) {
        await pedir(
          [
            {
              text:
                `Take the photograph in the reference image and change ONE thing only. ${col[nivel]} ` +
                `EVERYTHING else must stay pixel-for-pixel the same: the same person with the same face and body, the same pose, ` +
                `the same framing and camera distance, the same background, the same light. ` +
                `This is a set where only the colour accent differs. ${COMUN}`,
            },
            { inlineData: { mimeType: "image/png", data: b64(p("discreto")) } },
          ],
          p(nivel),
          `${genero} ${col.clima} — ${nivel} (rehecho)`
        );
      }
      continue;
    }

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
