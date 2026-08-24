// EL EXAMEN DEL JUEZ STYLIST contra los votos de Roberto.
//
// Uso:
//   npx tsx scripts/examen-juez.ts                 # en seco: cruza las críticas YA guardadas con sus votos ($0)
//   npx tsx scripts/examen-juez.ts --correr        # además corre el juez VIGENTE sobre esos looks y compara (~$0.01/look)
//   npx tsx scripts/examen-juez.ts --correr --guardar   # y sobreescribe las críticas guardadas con las nuevas
//
// QUÉ MIDE. Para cada look que Roberto marcó 👍/👎 en el comparador y que
// tiene crítica del juez: ¿el juez lo habría rechazado? Dos cifras por umbral
// de gravedad: cuántos 👎 caza (recall) y cuántos 👍 marca (falsa alarma).
// El universo es 83% positivo, así que el acierto global engaña: un juez que
// dijera "todo bien" acertaría 72%. Por eso la cifra que manda es la primera.
//
// POR QUÉ EXISTE COMO SCRIPT Y NO COMO CONSULTA SUELTA: es la medición que
// `docs/improvement-loop-del-motor.md` dice que se repite cada vez que el juez
// cambia. La primera vez (2026-08-22, js3) dio: ve pero no pesa — 85% de los 👎
// con cualquier hallazgo, 22% con "rompe".
//
// AFINAR Y VALIDAR SOBRE LOS MISMOS LOOKS ES TRAMPA. Si el juez se ajusta
// mirando estos 95, el número de aquí es optimista; el que vale es el de la
// siguiente ronda votada. El script lo imprime para que no se olvide.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { criticarLook, JUEZ_STYLIST_VERSION, type CriticaStylist, type Gravedad } from "../lib/engine/juez-stylist";
import type { BriefRubrica } from "../lib/engine/rubrica";
import { registroDelPerfil, estiloDelPerfil, colorDelPerfil } from "../lib/evales/evales";
import { conCategoria, ITEM_IMAGE_SELECT, itemImageUrlSync, type ItemImageRow } from "../lib/item-image";
import type { BriefMotor, LookMotor } from "../lib/comparador/motor";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

type Caso = {
  ladoId: string;
  indice: number;
  ronda: string;
  brief: BriefMotor;
  look: LookMotor;
  marca: "arriba" | "abajo";
  comentario: string | null;
  critica: CriticaStylist | null;
};

const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : "—");
const tiene = (c: CriticaStylist | null, niveles: Gravedad[]) =>
  !!c?.hallazgos.some((h) => niveles.includes(h.gravedad));

function tabla(titulo: string, casos: Caso[], critica: (c: Caso) => CriticaStylist | null) {
  const dn = casos.filter((c) => c.marca === "abajo");
  const up = casos.filter((c) => c.marca === "arriba");
  console.log(`\n${titulo} · ${casos.length} looks (${dn.length} 👎 / ${up.length} 👍)`);
  console.log(`  ${"umbral".padEnd(22)} caza de los 👎      falsa alarma en 👍`);
  for (const [etq, niveles] of [
    ["sólo 'rompe'", ["rompe"]],
    ["'rompe' o 'resta'", ["rompe", "resta"]],
    ["cualquier hallazgo", ["rompe", "resta", "detalle"]],
  ] as [string, Gravedad[]][]) {
    const caza = dn.filter((c) => tiene(critica(c), niveles)).length;
    const fa = up.filter((c) => tiene(critica(c), niveles)).length;
    console.log(
      `  ${etq.padEnd(22)} ${String(caza).padStart(3)}/${dn.length} (${pct(caza, dn.length).padStart(4)})      ${String(fa).padStart(3)}/${up.length} (${pct(fa, up.length).padStart(4)})`
    );
  }
  // De qué son los hallazgos, separando 👍 y 👎: lo que aparece mucho en 👍 es
  // severidad gastada en lo que a Roberto no le importa.
  const m: Record<string, { up: number; dn: number; rompeUp: number; rompeDn: number }> = {};
  for (const c of casos)
    for (const h of critica(c)?.hallazgos ?? []) {
      const e = (m[h.defecto] ??= { up: 0, dn: 0, rompeUp: 0, rompeDn: 0 });
      if (c.marca === "arriba") { e.up++; if (h.gravedad === "rompe") e.rompeUp++; }
      else { e.dn++; if (h.gravedad === "rompe") e.rompeDn++; }
    }
  console.log(`  hallazgos por defecto (en 👎 / en 👍; entre paréntesis los "rompe"):`);
  for (const [d, e] of Object.entries(m).sort((a, b) => b[1].up + b[1].dn - (a[1].up + a[1].dn)))
    console.log(`    ${d.padEnd(12)} 👎 ${String(e.dn).padStart(2)} (${e.rompeDn})   👍 ${String(e.up).padStart(2)} (${e.rompeUp})`);
}

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
  const correr = process.argv.includes("--correr");
  const guardar = process.argv.includes("--guardar");
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: corridas } = await s
    .from("comparador_motor_corridas")
    .select("id, closet_user_id, creada")
    .order("creada");
  const casos: Caso[] = [];
  for (const c of corridas ?? []) {
    const [{ data: pares }, { data: lados }] = await Promise.all([
      s.from("comparador_motor_pares").select("id, brief, marcas_look, comentarios_look").eq("corrida_id", c.id),
      s.from("comparador_motor_lados").select("id, par_id, variante, looks, criticas").eq("corrida_id", c.id),
    ]);
    for (const p of pares ?? [])
      for (const l of (lados ?? []).filter((x) => x.par_id === p.id)) {
        const looks = (l.looks as LookMotor[] | null) ?? [];
        const criticas = (l.criticas as CriticaStylist[] | null) ?? [];
        const marcas = (p.marcas_look as Record<string, Record<string, string>> | null)?.[l.variante] ?? {};
        const coms = (p.comentarios_look as Record<string, Record<string, string>> | null)?.[l.variante] ?? {};
        looks.forEach((look, i) => {
          const marca = marcas[String(i)];
          if (marca !== "arriba" && marca !== "abajo") return;
          // Sin nombres congelados no hay cómo reconstruir el look (los ids
          // murieron con el clóset del 08-18): fuera del examen, y se dice.
          if (!look.prendas) return;
          casos.push({
            ladoId: l.id, indice: i, ronda: c.id.slice(0, 8), brief: p.brief as BriefMotor, look,
            marca, comentario: coms[String(i)] ?? null, critica: criticas[i] ?? null,
          });
        });
      }
  }
  const conCritica = casos.filter((c) => c.critica);
  console.log(`EXAMEN DEL JUEZ · ${casos.length} looks votados y reconstruibles · ${conCritica.length} con crítica guardada`);
  tabla("GUARDADO (la crítica que se corrió en su ronda)", conCritica, (c) => c.critica);

  if (process.argv.includes("--detalle")) {
    // Para escribir la siguiente versión del juez: qué dijo en los 👍 (ruido)
    // y qué dijo —o calló— en los 👎, con la palabra de Roberto al lado.
    for (const marca of ["abajo", "arriba"] as const) {
      console.log(`\n===== ${marca === "abajo" ? "👎" : "👍"} =====`);
      for (const c of conCritica.filter((x) => x.marca === marca)) {
        console.log(`· [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}`);
        if (c.comentario) console.log(`    tú: ${c.comentario}`);
        for (const h of c.critica!.hallazgos) console.log(`    ${h.defecto}/${h.gravedad} (${h.pieza}): ${h.problema}`);
      }
    }
  }

  if (!correr) return;

  // ── Correr el juez vigente sobre los mismos looks ─────────────────────────
  const dueno = (corridas ?? [])[0]?.closet_user_id as string;
  const { data: perfil } = await s.from("profiles").select("*").eq("id", dueno).single();
  const p = (perfil ?? {}) as Record<string, unknown>;
  const { data: items } = await s.from("items").select(`id, ${ITEM_IMAGE_SELECT}`).eq("user_id", dueno).is("deleted_at", null);
  const filas = (items ?? []) as unknown as (ItemImageRow & { id: string })[];
  conCategoria(filas as unknown as ItemImageRow[]);
  const firmadas = new Map<string, string>();
  for (const f of filas)
    for (const path of [f.photo_path, f.render_path].filter(Boolean) as string[]) {
      const { data } = await s.storage.from("prendas").createSignedUrl(path, 3600);
      if (data?.signedUrl) firmadas.set(path, data.signedUrl);
    }
  const urlPorItem = new Map(filas.map((f) => [f.id, itemImageUrlSync(f, (x) => firmadas.get(x), "https://stailist.co")]));
  const imagenes = new Map<string, { mediaType: string; base64: string } | null>();
  const imagenDe = async (id: string) => {
    if (!imagenes.has(id)) { const u = urlPorItem.get(id); imagenes.set(id, u ? await comoBase64(u) : null); }
    return imagenes.get(id) ?? null;
  };

  console.log(`\nCorriendo ${JUEZ_STYLIST_VERSION} sobre ${casos.length} looks…`);
  const nuevas = new Map<Caso, CriticaStylist>();
  let costo = 0, fallos = 0, hechos = 0;
  const cola = [...casos];
  const obrero = async () => {
    for (;;) {
      const c = cola.shift();
      if (!c) return;
      const b = c.brief;
      const brief: BriefRubrica = {
        objective: b.objective, workDressCode: (p.work_dress_code as string | null) ?? null,
        veCliente: typeof b.veCliente === "boolean" ? b.veCliente : null, plan: b.plan ?? null,
        tipoEvento: b.tipoEvento ?? null, formality: b.formality ?? null, momento: b.momento,
        weather: b.weather, paraguas: b.paraguas === true, estilo: estiloDelPerfil(p),
        registro: registroDelPerfil(p), color: colorDelPerfil(p),
      };
      try {
        const prendas = await Promise.all((c.look.prendas ?? []).map(async (pr) => ({ nombre: pr.nombre, imagen: await imagenDe(pr.id) })));
        const r = await criticarLook(brief, { nombre: c.look.nombre, explicacion: c.look.explicacion, tip: c.look.tip ?? null, prendas });
        nuevas.set(c, r.critica);
        costo += r.recibo.costoUsd ?? 0;
      } catch (e) {
        fallos++;
        if (fallos <= 3) console.error(`  fallo: ${e instanceof Error ? e.message : e}`);
      }
      if (++hechos % 20 === 0) console.log(`  ${hechos}/${casos.length}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, obrero));
  console.log(`  listo · costo $${costo.toFixed(2)} · fallos ${fallos}`);

  const evaluados = casos.filter((c) => nuevas.has(c));
  tabla(`VIGENTE ${JUEZ_STYLIST_VERSION} (recién corrido)`, evaluados, (c) => nuevas.get(c)!);

  console.log(`\n👎 que ${JUEZ_STYLIST_VERSION} deja pasar sin "rompe":`);
  for (const c of evaluados.filter((x) => x.marca === "abajo" && !tiene(nuevas.get(x)!, ["rompe"])))
    console.log(`  · [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}\n      tú: ${c.comentario ?? "(sin comentario)"}\n      juez: ${nuevas.get(c)!.hallazgos.map((h) => `${h.defecto}/${h.gravedad}`).join(", ") || "NADA"}`);
  console.log(`\n👍 que ${JUEZ_STYLIST_VERSION} marca con "rompe" (falsas alarmas graves):`);
  for (const c of evaluados.filter((x) => x.marca === "arriba" && tiene(nuevas.get(x)!, ["rompe"])))
    console.log(`  · [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}\n      juez: ${nuevas.get(c)!.hallazgos.filter((h) => h.gravedad === "rompe").map((h) => `${h.defecto}: ${h.problema}`).join(" | ")}`);

  console.log(`\n⚠ Si ${JUEZ_STYLIST_VERSION} se afinó mirando estos looks, este número es optimista: el que vale es el de la próxima ronda votada.`);

  if (guardar) {
    const porLado = new Map<string, Caso[]>();
    for (const c of evaluados) (porLado.get(c.ladoId) ?? porLado.set(c.ladoId, []).get(c.ladoId)!).push(c);
    let n = 0;
    for (const [ladoId, cs] of porLado) {
      const { data: lado } = await s.from("comparador_motor_lados").select("criticas, looks").eq("id", ladoId).single();
      const criticas = [...(((lado?.criticas as CriticaStylist[] | null) ?? []))];
      for (const c of cs) criticas[c.indice] = nuevas.get(c)!;
      const { error } = await s.from("comparador_motor_lados").update({ criticas }).eq("id", ladoId);
      if (error) throw error;
      n++;
    }
    console.log(`guardado en ${n} lados (las críticas anteriores quedaron reemplazadas).`);
  }
}
main();
