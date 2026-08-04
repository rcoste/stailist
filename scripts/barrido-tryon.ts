// Renderiza los looks del barrido puestos sobre un modelo.
//
// POR QUÉ
// Ver las prendas sueltas alcanza para decidir si el juez acertó en color o en
// formalidad, pero no para lo que solo aparece cuando la ropa está puesta: la
// proporción, cómo cae, si el look se "lee" como conjunto o como suma de piezas.
// Y esa es justo la mitad del barrido que no se puede medir con reglas ni con
// otro modelo.
//
// USA EL MISMO PROMPT QUE LA APP
// El try-on de producción (app/api/tryon/route.ts) ya resolvió cosas que costaron
// iteraciones: que no abroche todo hasta el cuello como maniquí, que la pose sea
// candid y no de catálogo, que conserve la expresión. Copiar ese prompt —y no
// escribir uno nuevo— hace que lo que Roberto juzgue aquí se parezca a lo que
// vería en la app. Un render con otro criterio mediría otra cosa.
//
// SOLO LOS MARCADOS
// Renderizar los 50 son ~17 minutos y la mayoría no tiene nada que juzgar. Se
// rinden los que el juez marcó, que son donde el ojo humano decide.
//
// Uso: npx tsx scripts/barrido-tryon.ts [--n=20]
// Salida: public/barrido/<n>.png + revision.json actualizado con la ruta

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const N = Number((process.argv.find((a) => a.startsWith("--n=")) ?? "--n=20").slice(4));
const KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
const MODEL = "gemini-3-pro-image";
const SALIDA = "public/barrido";

// El mismo prompt de app/api/tryon/route.ts. Si aquel cambia, este tiene que
// cambiar con él — por eso está copiado literal y no reescrito.
const COMO_SE_LLEVA =
  " Style the garments the way a well-dressed person actually wears them, never like a shop mannequin: leave a shirt's top button undone (two if the look is casual), and a polo's placket open or with a single button fastened. EXCEPTION: if the outfit includes a tie, or is clearly formal (a suit worn with a dress shirt), button the shirt all the way up.";
const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image wearing the exact clothing items shown in the following images." +
  " Keep the person's face, facial expression, apparent age, body type, skin tone and hair identical. Replace only their outfit with the provided garments." +
  COMO_SE_LLEVA +
  " Plain flat light-grey wall, cool neutral daylight (no warm golden tones), crisp and clear. Candid Gen-Z street-style: a relaxed off-axis three-quarter pose looking slightly away, NOT a stiff straight-on catalog pose. Full body head to feet. No text.";

const b64 = (p: string) => readFileSync(p).toString("base64");
const mime = (p: string) => (p.endsWith(".png") ? "image/png" : "image/jpeg");

// Un modelo fijo para todos: el barrido compara looks entre sí, y si cambia la
// persona el ojo compara personas.
const AVATAR = "docs_para_claude/avatars-hombre/m2.png";

type Look = {
  n: number;
  prendas: { nombre: string; foto: string | null }[];
  fallos: string[];
  tryon?: string;
};

const datos = JSON.parse(readFileSync("lib/engine/barrido/revision.json", "utf8")) as {
  looks: Look[];
};

async function render(look: Look): Promise<boolean> {
  const salida = `${SALIDA}/${look.n}.png`;
  if (existsSync(salida)) return true; // reanudable: no re-gasta lo ya hecho
  const fotos = look.prendas
    .map((p) => p.foto && `public${p.foto}`)
    .filter((p): p is string => Boolean(p) && existsSync(p as string));
  if (fotos.length === 0) return false;

  const parts = [
    { text: PROMPT },
    { inlineData: { mimeType: mime(AVATAR), data: b64(AVATAR) } },
    ...fotos.map((f) => ({ inlineData: { mimeType: mime(f), data: b64(f) } })),
  ];

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
          }),
        }
      );
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const img = data?.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string } }) => p.inlineData?.data
      );
      if (!img) throw new Error("respuesta sin imagen");
      writeFileSync(salida, Buffer.from(img.inlineData.data, "base64"));
      return true;
    } catch (e) {
      if (intento === 3) {
        console.error(`  #${look.n} falló: ${(e as Error).message}`);
        return false;
      }
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
  return false;
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const objetivo = datos.looks.filter((l) => l.fallos.length > 0).slice(0, N);
  console.log(`Renderizando ${objetivo.length} looks marcados…\n`);

  let ok = 0;
  for (let i = 0; i < objetivo.length; i += 3) {
    const lote = objetivo.slice(i, i + 3);
    const res = await Promise.all(lote.map(render));
    lote.forEach((l, j) => {
      if (res[j]) {
        l.tryon = `/barrido/${l.n}.png`;
        ok++;
      }
    });
    console.log(`  ${Math.min(i + 3, objetivo.length)}/${objetivo.length}`);
  }

  writeFileSync("lib/engine/barrido/revision.json", JSON.stringify(datos, null, 1));
  console.log(`\n${ok} renders → ${SALIDA}`);
}

main();
