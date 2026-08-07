// ¿La rúbrica automática reproduce las marcas de Roberto?
//
// Uso:  npx tsx scripts/rubrica-acuerdo.ts [correo-del-closet]
//
// ESTE NÚMERO ES EL GATE DEL LEARNING LOOP. Las 148 marcas 👍/👎 ya emitidas
// (a ciegas, antes de que existiera la rúbrica) son un set de evaluación real
// que ya está pagado. Si el juez automático no las reproduce, "tenemos
// autoeval" es una creencia, no una herramienta — y optimizar el prompt contra
// él sería optimizar contra ruido.
//
// Qué imprime: acuerdo global, cuántos 👎 humanos caza el juez (el dato que
// importa: los 👍 son ~90% de la base y aprobarlo todo daría un acuerdo alto y
// falso), la separación de las escalas entre 👍 y 👎, y CADA discrepancia con
// el porqué del juez — esas discrepancias son lo único que Roberto tiene que
// revisar a mano.
//
// CUESTA DINERO REAL (~$1-2: una llamada de juez por look marcado, con caché
// por look — los espejos repiten looks y no se pagan dos veces).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  evaluarLook,
  RUBRICA_VERSION,
  type BriefRubrica,
  type LookRubrica,
  type NotaRubrica,
} from "../lib/engine/rubrica";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

type Caso = {
  clave: string; // parId-fuente + variante + índice: los espejos comparten look
  corrida: string;
  variante: string;
  brief: BriefRubrica & { etiqueta: string };
  look: LookRubrica;
  marca: "arriba" | "abajo";
};

async function main() {
  const correo = process.argv[2] ?? "roberto@kublau.com";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: us } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const dueno = us!.users.find((u) => u.email === correo);
  if (!dueno) {
    console.error(`No encontré a ${correo}.`);
    process.exit(1);
  }

  // Los nombres/colores/materiales de las prendas, deleted incluidas: un look
  // viejo puede referirse a una prenda que ya se borró y su nombre sigue
  // siendo el dato.
  const { data: items } = await supabase
    .from("items")
    .select("id, attrs")
    .eq("user_id", dueno.id);
  const prenda = new Map(
    (items ?? []).map((i) => {
      const a = (i.attrs ?? {}) as Record<string, unknown>;
      return [
        i.id as string,
        {
          nombre: (a.nombre as string) ?? "Prenda",
          color: (a.color as string) ?? (a.color_name as string) ?? null,
          material: (a.material as string) ?? null,
        },
      ];
    })
  );

  const { data: corridas } = await supabase
    .from("comparador_motor_corridas")
    .select("id")
    .eq("closet_user_id", dueno.id);
  const ids = (corridas ?? []).map((c) => c.id as string);

  const [{ data: pares }, { data: lados }] = await Promise.all([
    supabase.from("comparador_motor_pares").select("*").in("corrida_id", ids),
    supabase.from("comparador_motor_lados").select("*").in("corrida_id", ids),
  ]);

  type Look = { nombre: string; item_ids: string[]; explicacion: string; tip?: string | null };
  const lado = new Map<string, Look[]>();
  for (const l of lados ?? []) {
    if (l.looks) lado.set(`${l.par_id}|${l.variante}`, l.looks as Look[]);
  }

  const casos: Caso[] = [];
  for (const p of pares ?? []) {
    const fuente = (p.repite_de as string | null) ?? (p.id as string);
    const brief = p.brief as BriefRubrica & { etiqueta: string };
    for (const [variante, porIdx] of Object.entries(
      (p.marcas_look as Record<string, Record<string, string>> | null) ?? {}
    )) {
      for (const [idx, marca] of Object.entries(porIdx)) {
        if (marca !== "arriba" && marca !== "abajo") continue;
        const look = lado.get(`${fuente}|${variante}`)?.[Number(idx)];
        if (!look) continue;
        casos.push({
          clave: `${fuente}|${variante}|${idx}`,
          corrida: p.corrida_id as string,
          variante,
          brief,
          marca,
          look: {
            nombre: look.nombre,
            explicacion: look.explicacion,
            tip: look.tip ?? null,
            prendas: look.item_ids.map(
              (id) => prenda.get(id) ?? { nombre: "Prenda", color: null, material: null }
            ),
          },
        });
      }
    }
  }

  const unicos = new Set(casos.map((c) => c.clave)).size;
  console.log(
    `Rúbrica ${RUBRICA_VERSION} · ${casos.length} marcas de ${correo} · ${unicos} looks únicos a juzgar\n`
  );

  // Caché por look: la MISMA nota sirve para la marca del original y la del
  // espejo (son el mismo look; pagarlo dos veces mediría el azar del juez, no
  // el acuerdo).
  const notas = new Map<string, NotaRubrica>();
  let costo = 0;
  let fallos = 0;
  const cola = [...new Set(casos.map((c) => c.clave))];
  const porClave = new Map(casos.map((c) => [c.clave, c]));
  let hechos = 0;

  const worker = async () => {
    for (;;) {
      const clave = cola.shift();
      if (!clave) return;
      const c = porClave.get(clave)!;
      try {
        const { nota, recibo } = await evaluarLook(c.brief, c.look);
        notas.set(clave, nota);
        costo += recibo.costoUsd ?? 0;
      } catch (e) {
        fallos++;
        console.error(
          `  fallo en "${c.look.nombre}": ${e instanceof Error ? e.message : e}`
        );
      }
      hechos++;
      if (hechos % 20 === 0) console.log(`  ${hechos}/${unicos}…`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  // ── El acuerdo ──
  const evaluados = casos.filter((c) => notas.has(c.clave));
  const arriba = evaluados.filter((c) => c.marca === "arriba");
  const abajo = evaluados.filter((c) => c.marca === "abajo");
  const ok = (c: Caso) => notas.get(c.clave)!.aprobado === (c.marca === "arriba");

  const acc = evaluados.filter(ok).length / Math.max(1, evaluados.length);
  const cazaAbajo = abajo.filter(ok).length;
  const apruebaArriba = arriba.filter(ok).length;

  console.log(`\n${"=".repeat(64)}`);
  console.log(`ACUERDO GLOBAL: ${(acc * 100).toFixed(0)}% (${evaluados.filter(ok).length}/${evaluados.length})`);
  console.log(
    `  de los ${abajo.length} 👎 humanos, el juez rechaza ${cazaAbajo} (${abajo.length ? Math.round((cazaAbajo / abajo.length) * 100) : 0}%)  ← el dato que importa`
  );
  console.log(
    `  de los ${arriba.length} 👍 humanos, el juez aprueba ${apruebaArriba} (${Math.round((apruebaArriba / arriba.length) * 100)}%)`
  );

  const media = (cs: Caso[], dim: keyof NotaRubrica) =>
    cs.length
      ? (cs.reduce((a, c) => a + (notas.get(c.clave)![dim] as number), 0) / cs.length).toFixed(2)
      : "—";
  console.log(`\nSEPARACIÓN DE ESCALAS (media 👍 vs 👎 — si no separan, la escala es ruido)`);
  for (const dim of ["ocasion", "clima", "armado", "wow"] as const) {
    console.log(`  ${dim.padEnd(8)} ${media(arriba, dim)} vs ${media(abajo, dim)}`);
  }

  console.log(`\nDISCREPANCIAS (lo único que hay que revisar a mano):`);
  for (const c of evaluados.filter((x) => !ok(x))) {
    const n = notas.get(c.clave)!;
    console.log(
      `  [${c.marca === "arriba" ? "👍 humano, juez rechaza" : "👎 humano, juez aprueba"}] "${c.look.nombre}" · ${c.brief.etiqueta}`
    );
    console.log(`     juez: ${n.porQue.slice(0, 140)}`);
  }

  console.log(
    `\ncosto: $${costo.toFixed(2)} · ${fallos ? `${fallos} fallos de juez · ` : ""}rúbrica ${RUBRICA_VERSION}`
  );
}

main();
