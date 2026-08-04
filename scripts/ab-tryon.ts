// Renderiza los looks del A/B puestos sobre el avatar de Roberto.
//
// POR QUÉ
// Idea suya: "una cosa es qué prendas y otra es cómo se usan esas prendas — si
// va abierta, si va cerrada". Tiene razón y toca justo lo que separa los dos
// brazos: los `detalles` de cada receta son exactamente eso (la camisa abierta
// sobre playera, el dobladillo a la vista, las mangas dobladas al antebrazo), y
// SOLO el brazo con recetario los recibe. Si el recetario aporta algo, es ahí
// donde tendría que verse.
//
// LO QUE EL RENDER SÍ Y NO PUEDE MOSTRAR — leer antes de sacar conclusiones
// El generador de imágenes NO recibe la receta ni el tip: decide por su cuenta
// si abre un botón o dobla una manga, con una instrucción genérica de "vístelo
// como se viste alguien bien vestido". Así que el render sirve para juzgar
// proporción, color y si el conjunto se lee como outfit — pero NO prueba que el
// motor haya decidido llevarlo así. Cerrar ese hueco (pasarle los detalles de la
// receta al render) es otro cambio, y meterlo ahora contaminaría el A/B.
//
// Uso: npx tsx scripts/ab-tryon.ts [--conc=3]
// Salida: public/ab/<n>-<lado>.png + ab-pares.json actualizado

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const CONC = Number((process.argv.find((a) => a.startsWith("--conc=")) ?? "--conc=3").split("=")[1]);
const KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
const MODEL = "gemini-3-pro-image";
const SALIDA = "public/ab";
const EMAIL = "roberto@playrobix.com";

// EL MISMO PROMPT DE PRODUCCIÓN (app/api/tryon/route.ts). Copiado literal y no
// reescrito: ese prompt ya resolvió a base de iteraciones que no abroche todo
// como maniquí, que la pose sea candid y que conserve la cara. Un render con
// otro criterio mediría otra cosa que la que la persona ve en la app.
const COMO_SE_LLEVA =
  " Style the garments the way a well-dressed person actually wears them, never like a shop mannequin: leave a shirt's top button undone (two if the look is casual), and a polo's placket open or with a single button fastened. EXCEPTION: if the outfit includes a tie, or is clearly formal (a suit worn with a dress shirt), button the shirt all the way up.";
const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image wearing the exact clothing items shown in the following images." +
  " Keep the person's face, facial expression, apparent age, body type, skin tone and hair identical. Replace only their outfit with the provided garments." +
  COMO_SE_LLEVA +
  " Plain flat light-grey wall, cool neutral daylight (no warm golden tones), crisp and clear. Candid Gen-Z street-style: a relaxed off-axis three-quarter pose looking slightly away, NOT a stiff straight-on catalog pose. Full body head to feet. No text.";

type Lado = { titulo: string; itemIds?: string[]; tryon?: string };
type Par = { n: number; izq: Lado; der: Lado };

const mime = (p: string) => (p.endsWith(".png") ? "image/png" : "image/jpeg");

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: perfil } = await s
    .from("profiles")
    .select("id, avatar_path")
    .eq("email", EMAIL)
    .single();
  if (!perfil?.avatar_path) throw new Error("Ese perfil no tiene avatar");

  const { data: av } = await s.storage.from("prendas").download(perfil.avatar_path);
  if (!av) throw new Error("No pude bajar el avatar");
  const avatarB64 = Buffer.from(await av.arrayBuffer()).toString("base64");

  // Las prendas del clóset, con su imagen resuelta. Se bajan una vez y se
  // reusan: los mismos ids salen en varios looks.
  const datos = JSON.parse(readFileSync("lib/engine/barrido/ab-pares.json", "utf8")) as {
    pares: Par[];
  };
  const ids = [
    ...new Set(datos.pares.flatMap((p) => [...(p.izq.itemIds ?? []), ...(p.der.itemIds ?? [])])),
  ];
  const { data: items } = await s
    .from("items")
    .select("id, photo_path, render_status, render_path, attrs, archetypes(image_path)")
    .in("id", ids);

  const imagen = new Map<string, { b64: string; mime: string }>();
  type Fila = {
    id: string;
    photo_path?: string | null;
    render_status?: string | null;
    render_path?: string | null;
    attrs?: { image_path?: string } | null;
    // Supabase tipa el join como arreglo aunque la relación sea 1-1.
    archetypes?: { image_path?: string | null } | { image_path?: string | null }[] | null;
  };
  for (const i of (items ?? []) as unknown as Fila[]) {
    const arch = Array.isArray(i.archetypes) ? i.archetypes[0] : i.archetypes;
    // MISMO ORDEN que lib/item-image.ts: arquetipo → render → foto → prestada.
    const publico = arch?.image_path ?? i.attrs?.image_path;
    const privado =
      i.render_status === "done" && i.render_path ? i.render_path : i.photo_path;
    try {
      if (publico) {
        const ruta = `public${publico}`;
        if (existsSync(ruta)) {
          imagen.set(i.id, { b64: readFileSync(ruta).toString("base64"), mime: mime(ruta) });
          continue;
        }
      }
      if (privado) {
        const { data } = await s.storage.from("prendas").download(privado);
        if (data) {
          imagen.set(i.id, {
            b64: Buffer.from(await data.arrayBuffer()).toString("base64"),
            mime: mime(privado),
          });
        }
      }
    } catch {
      // Una prenda sin imagen no tumba el render: entra el resto del look.
    }
  }
  console.log(`${imagen.size}/${ids.length} prendas con imagen · avatar ok\n`);

  mkdirSync(SALIDA, { recursive: true });

  async function render(n: number, lado: "a" | "b", l: Lado): Promise<boolean> {
    const salida = `${SALIDA}/${n}-${lado}.png`;
    if (existsSync(salida)) {
      l.tryon = `/ab/${n}-${lado}.png`;
      return true; // reanudable: no re-gasta lo ya hecho
    }
    const fotos = (l.itemIds ?? []).map((id) => imagen.get(id)).filter(Boolean) as {
      b64: string;
      mime: string;
    }[];
    if (!fotos.length) return false;

    const parts = [
      { text: PROMPT },
      { inlineData: { mimeType: "image/png", data: avatarB64 } },
      ...fotos.map((f) => ({ inlineData: { mimeType: f.mime, data: f.b64 } })),
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
              generationConfig: {
                responseModalities: ["IMAGE"],
                imageConfig: { aspectRatio: "3:4" },
              },
            }),
          }
        );
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 100)}`);
        const data = await res.json();
        const img = data?.candidates?.[0]?.content?.parts?.find(
          (p: { inlineData?: { data?: string } }) => p.inlineData?.data
        );
        if (!img) throw new Error("respuesta sin imagen");
        writeFileSync(salida, Buffer.from(img.inlineData.data, "base64"));
        l.tryon = `/ab/${n}-${lado}.png`;
        return true;
      } catch (e) {
        if (intento === 3) {
          console.error(`  #${n}${lado} falló: ${(e as Error).message}`);
          return false;
        }
        await new Promise((r) => setTimeout(r, 4000 * intento));
      }
    }
    return false;
  }

  const tareas = datos.pares.flatMap((p) => [
    () => render(p.n, "a", p.izq),
    () => render(p.n, "b", p.der),
  ]);
  let ok = 0;
  for (let i = 0; i < tareas.length; i += CONC) {
    const res = await Promise.all(tareas.slice(i, i + CONC).map((f) => f()));
    ok += res.filter(Boolean).length;
    console.log(`  ${Math.min(i + CONC, tareas.length)}/${tareas.length}`);
    // Se guarda en cada lote: una corrida cortada a la mitad deja igual la
    // pantalla utilizable con lo que alcanzó a renderizar.
    writeFileSync("lib/engine/barrido/ab-pares.json", JSON.stringify(datos, null, 1));
  }
  console.log(`\n${ok}/${tareas.length} renders → ${SALIDA}`);
}

main();
