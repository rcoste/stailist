// ¿La rúbrica que MIRA ve lo que la que LEE no ve?
//
// Uso:  npx tsx scripts/rubrica-vision-acuerdo.ts <corridaId> [sellado-de-texto]
//
// LA PREGUNTA, EXACTA
// Idea de Roberto: "yo veo cosas que tú no ves; igual el modelo de visión ve
// cosas que yo hubiera visto y nos podemos ahorrar". En el veredicto hubo 21
// looks que él marcó 👎, y de esos ONCE no los cazó ni el código ni el juez de
// texto. Ese 11 es lo que hoy solo un humano ve — y es la razón real por la que
// no puede dejar de votar.
//
// Este script no pregunta "¿la visión es buena?". Pregunta: DE ESOS ONCE,
// ¿cuántos caza? Si caza varios, se gana un lugar como última capa del loop.
// Si caza los mismos que el texto, no aporta y nos ahorramos construirla.
//
// Se le dan las MISMAS fotos que ve el humano al votar (la cuadrícula de
// prendas), no el try-on: ese lo inventa un modelo de imagen que alucina.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { revisarEjecucion } from "../lib/engine/reglas-ejecucion";
import { bandaDeClima } from "../lib/engine/recetario";
import type { EngineItem } from "../lib/engine/prompt";
import { ITEM_IMAGE_SELECT, itemImageUrlSync, type ItemImageRow } from "../lib/item-image";
import { evaluarLookConVision, RUBRICA_VISION_VERSION } from "../lib/engine/rubrica-vision";
import type { BriefRubrica, NotaRubrica } from "../lib/engine/rubrica";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

type Look = { nombre: string; item_ids: string[]; explicacion: string; tip?: string | null };
type Sellado = { notas: { par: number; variante: string; look: number; nota: NotaRubrica }[] };

async function comoBase64(url: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mediaType = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!/^image\//.test(mediaType)) return null;
    return { mediaType, base64: buf.toString("base64") };
  } catch {
    return null;
  }
}

async function main() {
  const corridaId = process.argv[2];
  const selladoTexto = process.argv[3] ?? `/tmp/rubrica-${corridaId.slice(0, 8)}.json`;
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: corrida } = await s
    .from("comparador_motor_corridas")
    .select("closet_user_id")
    .eq("id", corridaId)
    .single();
  const dueno = corrida!.closet_user_id as string;

  const [{ data: pares }, { data: lados }, { data: items }] = await Promise.all([
    s.from("comparador_motor_pares").select("*").eq("corrida_id", corridaId).order("n"),
    s.from("comparador_motor_lados").select("*").eq("corrida_id", corridaId),
    s
      .from("items")
      .select(`id, ${ITEM_IMAGE_SELECT}`)
      .eq("user_id", dueno)
      .is("deleted_at", null),
  ]);

  // Las URLs de las imágenes, firmadas donde toque (bucket privado).
  const filas = (items ?? []) as unknown as (ItemImageRow & { id: string })[];
  const privadas = new Map<string, string>();
  for (const f of filas) {
    for (const path of [f.photo_path, f.render_path].filter(Boolean) as string[]) {
      const { data } = await s.storage.from("prendas").createSignedUrl(path, 3600);
      if (data?.signedUrl) privadas.set(path, data.signedUrl);
    }
  }
  const meta = new Map(
    filas.map((f) => [
      f.id,
      {
        nombre: ((f.attrs ?? {}) as { nombre?: string }).nombre ?? "Prenda",
        url: itemImageUrlSync(f, (path) => privadas.get(path), "https://stailist.co"),
        attrs: (f.attrs ?? {}) as EngineItem["attrs"],
      },
    ])
  );
  const closet: EngineItem[] = filas.map((f) => ({
    id: f.id,
    attrs: (f.attrs ?? {}) as EngineItem["attrs"],
  }));

  const texto = JSON.parse(readFileSync(selladoTexto, "utf8")) as Sellado;
  const notaTexto = new Map(
    texto.notas.map((n) => [`${n.par}|${n.variante}|${n.look}`, n.nota])
  );

  // Cada look marcado, con quién lo caza hoy.
  type Caso = {
    clave: string;
    marca: string;
    brief: BriefRubrica & { etiqueta: string };
    look: Look;
    codigo: boolean;
  };
  const casos: Caso[] = [];
  for (const p of pares ?? []) {
    if (p.repite_de) continue;
    const brief = p.brief as BriefRubrica & { etiqueta: string };
    const marcas = (p.marcas_look as Record<string, Record<string, string>> | null) ?? {};
    for (const l of (lados ?? []).filter((x) => x.par_id === p.id)) {
      ((l.looks as Look[] | null) ?? []).forEach((look, idx) => {
        const m = marcas[l.variante as string]?.[String(idx)];
        if (m !== "arriba" && m !== "abajo") return;
        const its = look.item_ids
          .map((id) => closet.find((c) => c.id === id))
          .filter((x): x is EngineItem => !!x);
        const codigo =
          revisarEjecucion(its, {
            clima: bandaDeClima(brief.weather ?? null),
            closet,
            lluvia: /lluvia/i.test(brief.weather?.condition ?? ""),
            paraguas: brief.paraguas === true,
            formality: brief.formality,
          }).length > 0;
        casos.push({ clave: `${p.n}|${l.variante}|${idx}`, marca: m, brief, look, codigo });
      });
    }
  }

  console.log(
    `Rúbrica visual ${RUBRICA_VISION_VERSION} sobre ${casos.length} looks marcados\n`
  );

  const notaVision = new Map<string, NotaRubrica>();
  let costo = 0;
  let fallos = 0;
  let hechos = 0;
  const cola = [...casos];
  const worker = async () => {
    for (;;) {
      const c = cola.shift();
      if (!c) return;
      const prendas = await Promise.all(
        c.look.item_ids.map(async (id) => {
          const m = meta.get(id);
          return {
            nombre: m?.nombre ?? "Prenda",
            imagen: m?.url ? await comoBase64(m.url) : null,
          };
        })
      );
      try {
        const { nota, recibo } = await evaluarLookConVision(c.brief, {
          nombre: c.look.nombre,
          explicacion: c.look.explicacion,
          tip: c.look.tip ?? null,
          prendas,
        });
        notaVision.set(c.clave, nota);
        costo += recibo.costoUsd ?? 0;
      } catch (e) {
        fallos++;
        if (fallos <= 3)
          console.error(`  fallo "${c.look.nombre}": ${e instanceof Error ? e.message : e}`);
      }
      if (++hechos % 25 === 0) console.log(`  ${hechos}/${casos.length}…`);
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));

  // ── Lo que importa: los que HOY no caza nadie ──
  const evaluados = casos.filter((c) => notaVision.has(c.clave));
  const acierta = (c: Caso) =>
    notaVision.get(c.clave)!.aprobado === (c.marca === "arriba");
  const abajo = evaluados.filter((c) => c.marca === "abajo");
  const arriba = evaluados.filter((c) => c.marca === "arriba");

  console.log(`\n${"=".repeat(64)}`);
  console.log(
    `ACUERDO de la rúbrica VISUAL: ${((evaluados.filter(acierta).length / evaluados.length) * 100).toFixed(0)}% (${evaluados.filter(acierta).length}/${evaluados.length})`
  );
  console.log(
    `  de sus ${abajo.length} 👎, la visión rechaza ${abajo.filter(acierta).length}`
  );
  console.log(
    `  de sus ${arriba.length} 👍, la visión aprueba ${arriba.filter(acierta).length}`
  );

  const huerfanos = abajo.filter((c) => {
    const t = notaTexto.get(c.clave);
    return !c.codigo && (!t || t.aprobado); // ni el código ni el texto lo cazaron
  });
  const rescatados = huerfanos.filter((c) => !notaVision.get(c.clave)!.aprobado);
  console.log(`\nLA PREGUNTA QUE IMPORTA`);
  console.log(
    `  👎 que HOY no caza nadie (ni código ni juez de texto): ${huerfanos.length}`
  );
  console.log(
    `  de esos, la VISIÓN caza: ${rescatados.length}  ← si esto es alto, se gana su lugar`
  );
  for (const c of rescatados) {
    console.log(`\n  ✓ "${c.look.nombre}" (${c.brief.etiqueta})`);
    console.log(`    visión: ${notaVision.get(c.clave)!.porQue.slice(0, 160)}`);
  }
  console.log(
    `\ncosto $${costo.toFixed(2)}${fallos ? ` · ${fallos} fallos` : ""}`
  );
}

main();
