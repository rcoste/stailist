// Abre el sobre: compara las notas SELLADAS de la rúbrica contra las marcas que
// el humano acabó de emitir, y dice cuánto coinciden.
//
// Uso:  npx tsx scripts/rubrica-acuerdo-corrida.ts <corridaId> [archivo-sellado]
//
// ESTE ES EL GATE DEL LEARNING LOOP, y solo vale con marcas FRESCAS. El primer
// intento midió 70% contra 148 marcas viejas, pero esas etiquetas eran
// anteriores al estándar de hoy: Roberto había marcado 👍 un look donde él
// mismo escribió "mocasín en lluvia no aplica". Seguir afinando el juez contra
// eso era afinarlo contra ruido. Con marcas emitidas bajo el estándar vigente
// el número sí dice algo.
//
// No cuesta nada: las notas ya están pagadas (scripts/rubrica-sellar.ts).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { NotaRubrica } from "../lib/engine/rubrica";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

type Sellado = {
  rubrica: string;
  corrida: string;
  notas: { par: number; etiqueta: string; variante: string; look: number; nombre: string; nota: NotaRubrica }[];
};

async function main() {
  const corridaId = process.argv[2];
  const archivo = process.argv[3] ?? `/tmp/rubrica-${corridaId.slice(0, 8)}.json`;
  const sellado = JSON.parse(readFileSync(archivo, "utf8")) as Sellado;
  if (sellado.corrida !== corridaId) {
    console.error(`El sellado es de otra corrida (${sellado.corrida.slice(0, 8)}).`);
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: pares } = await supabase
    .from("comparador_motor_pares")
    .select("*")
    .eq("corrida_id", corridaId)
    .order("n");

  const nota = new Map(
    sellado.notas.map((n) => [`${n.par}|${n.variante}|${n.look}`, n])
  );

  let ok = 0;
  let tot = 0;
  const arriba: NotaRubrica[] = [];
  const abajo: NotaRubrica[] = [];
  const disc: string[] = [];

  for (const p of pares ?? []) {
    const marcas = (p.marcas_look as Record<string, Record<string, string>> | null) ?? {};
    for (const [variante, porIdx] of Object.entries(marcas)) {
      for (const [i, m] of Object.entries(porIdx)) {
        if (m !== "arriba" && m !== "abajo") continue;
        const n = nota.get(`${p.n}|${variante}|${i}`);
        if (!n) continue; // espejo: sus looks se juzgaron en el original
        tot++;
        const acierta = n.nota.aprobado === (m === "arriba");
        if (acierta) ok++;
        (m === "arriba" ? arriba : abajo).push(n.nota);
        if (!acierta) {
          disc.push(
            `  [${m === "arriba" ? "👍 humano, juez rechaza" : "👎 humano, juez APRUEBA"}] "${n.nombre}" · ${n.etiqueta}\n     juez: ${n.nota.porQue.slice(0, 150)}`
          );
        }
      }
    }
  }

  if (!tot) {
    console.log("Todavía no hay marcas humanas que comparar.");
    return;
  }

  console.log(`ACUERDO rúbrica ${sellado.rubrica} vs marcas humanas: ${((ok / tot) * 100).toFixed(0)}% (${ok}/${tot})`);
  // El dato que importa: los 👍 son la mayoría, así que un juez que aprobara
  // TODO sacaría un acuerdo alto y falso. Lo que separa es cuántos 👎 caza.
  console.log(
    `  de tus ${abajo.length} 👎, el juez rechaza ${abajo.filter((n) => !n.aprobado).length}  ← el dato que importa`
  );
  console.log(
    `  de tus ${arriba.length} 👍, el juez aprueba ${arriba.filter((n) => n.aprobado).length}`
  );

  const media = (cs: NotaRubrica[], d: keyof NotaRubrica) =>
    cs.length ? (cs.reduce((a, c) => a + (c[d] as number), 0) / cs.length).toFixed(2) : "—";
  console.log(`\nSEPARACIÓN 👍 vs 👎 (si no separan, la escala es ruido)`);
  for (const d of ["ocasion", "clima", "armado", "wow"] as const) {
    console.log(`  ${d.padEnd(8)} ${media(arriba, d)} vs ${media(abajo, d)}`);
  }

  console.log(`\nDISCREPANCIAS (${disc.length}) — lo único que hay que revisar a mano:`);
  disc.forEach((d) => console.log(d));
}

main();
