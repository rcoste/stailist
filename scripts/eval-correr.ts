// Correr un eval del motor desde la terminal, sin pantalla.
//
// Uso:  npx tsx scripts/eval-correr.ts [vueltas] [--nota "texto"]
//       npx tsx scripts/eval-correr.ts --seguir <corridaId>
//
// PARA QUÉ: una corrida completa son ~13 briefs × (generar + calificar) y toma
// media hora. Dejarla corriendo aquí y llegar al marcador ya hecho es el mismo
// patrón que el comparador ya tenía — el trabajo real vive en lib/evales/paso.ts
// y esta es solo otra puerta, así que no hay arnés que pueda derivar del
// producto (la clase de bug que este proyecto ya pagó tres veces).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { pasoEval } from "../lib/evales/paso";
import {
  briefCompleto,
  colorDelPerfil,
  estiloDelPerfil,
  marcadorEval,
  type EvalBriefFila,
} from "../lib/evales/evales";
import { PROMPT_VERSION } from "../lib/engine/prompt";
import { RUBRICA_VERSION, tieneEstilo, tieneColor } from "../lib/engine/rubrica";
import { RUBRICA_VISION_VERSION } from "../lib/engine/rubrica-vision";
import { MODELO_MOTOR, MODELO_JUEZ } from "../lib/models";
import { N_POOL, POOL_VERSION, briefsPara } from "../lib/comparador/motor";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const DUENO = process.env.EVAL_EMAIL ?? "roberto@kublau.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

function mapear(b: Record<string, unknown>): EvalBriefFila {
  return {
    id: b.id as string,
    n: b.n as number,
    brief: b.brief as EvalBriefFila["brief"],
    looks: (b.looks as EvalBriefFila["looks"]) ?? null,
    reviews: (b.reviews as EvalBriefFila["reviews"]) ?? null,
    error: (b.error as string | null) ?? null,
    costoGenUsd: b.costo_gen_usd != null ? Number(b.costo_gen_usd) : null,
    msGen: (b.ms_gen as number | null) ?? null,
    notas: (b.notas as EvalBriefFila["notas"]) ?? null,
    costoNotasUsd: b.costo_notas_usd != null ? Number(b.costo_notas_usd) : null,
    marcas: (b.marcas as Record<string, string> | null) ?? null,
    comentarios: (b.comentarios as Record<string, string> | null) ?? null,
  };
}

async function abrir(s: Cliente, duenoId: string, vueltas: number, nota: string | null) {
  const { data: perfil } = await s.from("profiles").select("*").eq("id", duenoId).single();
  const pf = (perfil ?? {}) as Record<string, unknown>;
  const conEstilo = tieneEstilo(estiloDelPerfil(pf));
  const conColor = tieneColor(colorDelPerfil(pf));

  const { data: c, error } = await s
    .from("eval_corridas")
    .insert({
      user_id: duenoId,
      closet_user_id: duenoId,
      prompt_version: PROMPT_VERSION,
      pool_version: POOL_VERSION,
      modelo_generador: MODELO_MOTOR.id,
      modelo_juez: MODELO_JUEZ.id,
      rubrica_version: RUBRICA_VERSION,
      rubrica_vision_version: RUBRICA_VISION_VERSION,
      con_estilo: conEstilo,
      con_color: conColor,
      ...(nota ? { nota } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;

  const briefs = briefsPara("veredicto", vueltas * N_POOL);
  const { error: eb } = await s
    .from("eval_briefs")
    .insert(briefs.map((brief, i) => ({ corrida_id: c.id, n: i + 1, brief })));
  if (eb) {
    await s.from("eval_corridas").delete().eq("id", c.id);
    throw eb;
  }
  console.log(
    `corrida ${c.id}\n  ${PROMPT_VERSION} · ${MODELO_MOTOR.id} · pool ${POOL_VERSION} · ${RUBRICA_VERSION}/${RUBRICA_VISION_VERSION}` +
      `\n  ${briefs.length} briefs · estilo declarado: ${conEstilo ? "sí" : "NO (la dimensión no medirá)"}`
  );
  return { id: c.id as string, conEstilo, conColor };
}

async function main() {
  const args = process.argv.slice(2);
  const seguir = args.indexOf("--seguir");
  const iNota = args.indexOf("--nota");
  const nota = iNota >= 0 ? args[iNota + 1] ?? null : null;

  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: dueno } = await s
    .from("profiles")
    .select("id")
    .eq("email", DUENO)
    .single();
  if (!dueno) throw new Error(`sin perfil para ${DUENO}`);

  let corridaId: string;
  let conEstilo: boolean;
  let conColor: boolean;
  if (seguir >= 0) {
    corridaId = args[seguir + 1];
    const { data: c } = await s
      .from("eval_corridas")
      .select("con_estilo, con_color")
      .eq("id", corridaId)
      .single();
    conEstilo = c?.con_estilo === true;
    conColor = c?.con_color === true;
    console.log(`retomando ${corridaId}`);
  } else {
    const vueltas = Math.max(1, Math.min(3, Number(args[0]) || 1));
    const abierta = await abrir(s, dueno.id as string, vueltas, nota);
    corridaId = abierta.id;
    conEstilo = abierta.conEstilo;
    conColor = abierta.conColor;
  }

  // Dos pasadas: la primera genera, la segunda califica. El servidor decide
  // cuál toca por los datos de la fila, así que basta repetir hasta que no
  // quede nada pendiente (con tope, para no ciclar sobre un fallo terminal).
  for (let ronda = 1; ronda <= 4; ronda++) {
    const { data: filas } = await s
      .from("eval_briefs")
      .select("*")
      .eq("corrida_id", corridaId)
      .order("n");
    const pendientes = (filas ?? []).map(mapear).filter((f) => !briefCompleto(f));
    if (pendientes.length === 0) break;
    console.log(`\nronda ${ronda}: ${pendientes.length} pendientes`);

    const cola = [...pendientes];
    let hechos = 0;
    const obrero = async () => {
      for (;;) {
        const f = cola.shift();
        if (!f) return;
        const t0 = Date.now();
        const r = await pasoEval({
          supabase: s,
          corridaId,
          briefId: f.id,
          actorId: dueno.id as string,
        });
        const seg = Math.round((Date.now() - t0) / 1000);
        const que =
          "error" in r ? `ERROR ${r.error}` : "fallo" in r ? `fallo: ${r.fallo}` : r.hizo;
        console.log(`  [${++hechos}/${pendientes.length}] ${f.brief.etiqueta} — ${que} (${seg}s)`);
      }
    };
    await Promise.all(Array.from({ length: 2 }, obrero));
  }

  const { data: finales } = await s
    .from("eval_briefs")
    .select("*")
    .eq("corrida_id", corridaId)
    .order("n");
  const filas = (finales ?? []).map(mapear);
  const m = marcadorEval(filas, conEstilo, conColor);

  const prom = (d: typeof m.texto) => {
    const xs = [d.ocasion, d.clima, d.armado, d.estilo, d.color, d.wow].filter(
      (x): x is number => x != null
    );
    return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : "—";
  };
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`EVAL ${PROMPT_VERSION} · ${MODELO_MOTOR.id}`);
  console.log(`  ${m.looksCalificados}/${m.looks} looks calificados · ${m.errores} errores`);
  console.log(`  dimensión      texto  visión`);
  for (const d of ["ocasion", "clima", "armado", "estilo", "color", "wow"] as const) {
    const t = m.texto[d];
    const v = m.vision[d];
    console.log(
      `  ${d.padEnd(14)} ${(t == null ? "—" : t.toFixed(2)).padStart(5)}  ${(v == null ? "—" : v.toFixed(2)).padStart(6)}`
    );
  }
  console.log(`  promedio       ${prom(m.texto).padStart(5)}  ${prom(m.vision).padStart(6)}`);
  console.log(
    `  aprobado       ${pct(m.aprobadoTexto.si, m.aprobadoTexto.de).padStart(5)}  ${pct(m.aprobadoVision.si, m.aprobadoVision.de).padStart(6)}`
  );
  console.log(
    `\n  looks con violación de regla: ${pct(m.violaciones.looksConViolacion, m.looks)} (${m.violaciones.total})`
  );
  for (const [r, n] of Object.entries(m.violaciones.porRegla).sort((a, b) => b[1] - a[1]))
    console.log(`    ${r}: ${n}`);
  console.log(
    `  el juez de producción reparó: ${pct(m.reparacion.reparados, m.reparacion.candidatos)} · rechazó ${m.reparacion.rechazados}/${m.reparacion.candidatos}`
  );
  console.log(
    `  costo $${m.costoTotal.toFixed(2)} · generación $${m.costoGenPromedio?.toFixed(3) ?? "—"} / ${m.msGenPromedio ? Math.round(m.msGenPromedio / 1000) : "—"}s`
  );

  // La métrica que NO se puede adular: se cuenta sobre el texto del motor, no
  // sobre la opinión de un juez.
  const g = m.gestos;
  console.log(
    `\nGESTOS DE STYLING (métrica primaria del wow — aritmética, no opinión)`
  );
  console.log(
    `  ${g.distintos} gestos distintos en ${g.conTip}/${g.total} looks con tip`
  );
  console.log(
    `  dominancia ${g.dominancia.toFixed(2)} (1.00 = un solo truco) · equilibrio ${g.equilibrio.toFixed(2)}`
  );
  for (const [k, n] of Object.entries(g.porGesto).sort((a, b) => b[1] - a[1]))
    console.log(`    ${k.padEnd(14)} ${n}`);

  // Los rechazos, que es de donde salen las reglas nuevas.
  console.log(`\nLO QUE LOS JUECES RECHAZARON`);
  for (const f of filas) {
    (f.notas ?? []).forEach((n, i) => {
      const look = f.looks?.[i];
      if (!look) return;
      const malo = n.texto?.aprobado === false || n.vision?.aprobado === false;
      if (!malo) return;
      console.log(`\n  [${f.brief.etiqueta}] "${look.nombre}"`);
      if (n.texto?.aprobado === false) console.log(`    texto:  ${n.texto.porQue}`);
      if (n.vision?.aprobado === false) console.log(`    visión: ${n.vision.porQue}`);
      if (n.violaciones?.length)
        console.log(`    código: ${n.violaciones.map((v) => v.regla).join(", ")}`);
    });
  }
  console.log(`\ncorrida: /admin/evales/${corridaId}`);
}

main();
