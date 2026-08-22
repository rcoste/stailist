// ABLACIÓN CONTRA LOS VOTOS: ¿qué dicen las reglas de código de los looks que
// Roberto ya votó?
//
// Uso: npx tsx scripts/ablacion-votos.ts
//
// Es el paso 2 del proceso (docs/improvement-loop-del-motor.md): antes de
// escribir o cambiar una regla, ver qué dispara hoy sobre los 👎 y los 👍
// reales. Una regla buena dispara en 👎 y calla en 👍; una que dispara parejo
// no distingue nada. Y para cada 👎 sin regla, el comentario de Roberto dice
// qué regla falta. Corre el MISMO camino que producción (contexto.ts +
// contextoDeReglas + repararEnCodigo): cero imitación.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "../lib/engine/contexto";
import { contextoDeReglas } from "../lib/engine/critic";
import { revisarEjecucion } from "../lib/engine/reglas-ejecucion";
import { repararEnCodigo } from "../lib/engine/reparar";
import { peticionDeBrief, type BriefMotor, type LookMotor } from "../lib/comparador/motor";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: corridas } = await s.from("comparador_motor_corridas").select("id, closet_user_id").order("creada");
  const casos: { brief: BriefMotor; look: LookMotor; marca: "arriba" | "abajo"; com: string | null; variante: string }[] = [];
  let dueno = "";
  for (const c of corridas ?? []) {
    const [{ data: pares }, { data: lados }] = await Promise.all([
      s.from("comparador_motor_pares").select("id, brief, marcas_look, comentarios_look").eq("corrida_id", c.id),
      s.from("comparador_motor_lados").select("par_id, variante, looks").eq("corrida_id", c.id),
    ]);
    for (const p of pares ?? [])
      for (const l of (lados ?? []).filter((x) => x.par_id === p.id)) {
        const marcas = (p.marcas_look as Record<string, Record<string, string>> | null)?.[l.variante] ?? {};
        const coms = (p.comentarios_look as Record<string, Record<string, string>> | null)?.[l.variante] ?? {};
        ((l.looks as LookMotor[] | null) ?? []).forEach((look, i) => {
          const m = marcas[String(i)];
          if ((m !== "arriba" && m !== "abajo") || !look.prendas) return;
          dueno = c.closet_user_id as string;
          casos.push({ brief: p.brief as BriefMotor, look, marca: m, com: coms[String(i)] ?? null, variante: l.variante });
        });
      }
  }
  const carga = await cargarBaseDelMotor(s as never, dueno);
  if ("error" in carga) throw new Error("closet_vacio");

  const porRegla: Record<string, { dn: number; up: number }> = {};
  const sinRegla: typeof casos = [];
  const rotosEntregados: { c: (typeof casos)[0]; v: string[]; tras: string[] }[] = [];
  for (const c of casos) {
    const ctx = construirContexto(carga.base, peticionDeBrief(c.brief));
    // La variante que apaga la regla de color corrió sin ella: medirla aquí
    // contaría como roto lo que ese lado no vigilaba.
    const cr = contextoDeReglas(ctx, { sinCoherenciaCromatica: c.variante === "sin-coherencia-cromatica" });
    const items = ctx.items.filter((i) => c.look.item_ids.includes(i.id));
    const v = revisarEjecucion(items, cr);
    for (const x of v) {
      const e = (porRegla[x.regla] ??= { dn: 0, up: 0 });
      c.marca === "abajo" ? e.dn++ : e.up++;
    }
    if (c.marca === "abajo" && !v.length) sinRegla.push(c);
    if (v.length) {
      const rep = repararEnCodigo(c.look.item_ids, ctx.items, cr);
      const tras = revisarEjecucion(ctx.items.filter((i) => rep.itemIds.includes(i.id)), cr).map((x) => x.regla);
      rotosEntregados.push({ c, v: v.map((x) => x.regla), tras });
    }
  }
  const dn = casos.filter((c) => c.marca === "abajo").length, up = casos.length - dn;
  console.log(`ABLACIÓN · ${casos.length} looks votados (${dn} 👎 / ${up} 👍)\n`);
  console.log(`regla                           en 👎   en 👍`);
  for (const [r, e] of Object.entries(porRegla).sort((a, b) => b[1].dn + b[1].up - (a[1].dn + a[1].up)))
    console.log(`  ${r.padEnd(30)} ${String(e.dn).padStart(4)}   ${String(e.up).padStart(4)}`);

  console.log(`\n👎 SIN NINGUNA REGLA QUE DISPARE (${sinRegla.length} de ${dn}) — aquí está lo que falta:`);
  for (const c of sinRegla)
    console.log(`  · [${c.brief.etiqueta}] ${c.look.prendas!.map((p) => p.nombre).join(" + ")}\n      tú: ${c.com ?? "(sin comentario)"}`);

  console.log(`\nLOOKS CON VIOLACIÓN AL SALIR DEL GENERADOR, y qué deja el reparador de hoy:`);
  for (const r of rotosEntregados)
    console.log(`  ${r.c.marca === "abajo" ? "👎" : "👍"} [${r.c.brief.etiqueta}] ${r.c.look.prendas!.map((p) => p.nombre).join(" + ")}\n      dispara: ${r.v.join(", ")} → tras reparar: ${r.tras.length ? r.tras.join(", ") : "limpio"}`);
}
main();
