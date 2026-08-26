// ¿El traje completo / la corbata en eventos relajados están condenados por los votos?
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "../lib/engine/contexto";
import { peticionDeBrief, type BriefMotor, type LookMotor } from "../lib/comparador/motor";
for (const l of readFileSync(".env.local","utf8").split("\n")) { const i=l.indexOf("="); if(i>0&&!l.startsWith("#")) process.env[l.slice(0,i)] ??= l.slice(i+1).trim().replace(/^"|"$/g,""); }
type It = { id: string; attrs: Record<string, unknown> };
const nom = (i: It) => String(i.attrs.nombre ?? "").toLowerCase();
// traje completo = dos piezas con el MISMO lazo conjunto en el look (dato, no heurística)
function trajeCompleto(its: It[]): boolean {
  const cj = its.map(i => i.attrs.conjunto).filter(Boolean) as string[];
  return new Set(cj).size < cj.length; // algún lazo repetido = par presente
}
const esSastreSuelto = (its: It[]) => !trajeCompleto(its) && its.some(i => /blazer|saco|americana/.test(nom(i)));
const conCorbata = (its: It[]) => its.some(i => /corbata|moño/.test(nom(i)));
// eventos "relajados": cita, cena con amigos, fiesta (los tres con dial/plan relajado)
const RELAJADO = /^(cita|cena con amigos|fiesta)/;
async function main(){
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type C = { et: string; its: It[]; m: string; com: string|null };
const casos: C[] = []; let dueno = "";
const { data: corridas } = await s.from("comparador_motor_corridas").select("id, closet_user_id").order("creada");
const porId = new Map<string, It>();
for (const c of corridas ?? []) {
  const [{ data: pares }, { data: lados }] = await Promise.all([
    s.from("comparador_motor_pares").select("id, brief, marcas_look, comentarios_look").eq("corrida_id", c.id),
    s.from("comparador_motor_lados").select("par_id, variante, looks").eq("corrida_id", c.id),
  ]);
  dueno = c.closet_user_id as string;
  for (const p of pares ?? []) for (const l of (lados ?? []).filter(x=>x.par_id===p.id)) {
    const ma=(p.marcas_look as Record<string,Record<string,string>>|null)?.[l.variante]??{};
    const co=(p.comentarios_look as Record<string,Record<string,string>>|null)?.[l.variante]??{};
    ((l.looks as LookMotor[]|null)??[]).forEach((lk,i)=>{
      const m=ma[String(i)]; if(m!=="arriba"&&m!=="abajo")return;
      casos.push({ et:(p.brief as BriefMotor).etiqueta.replace(/ \(\d+ª\)$/,""), its: lk.item_ids as never, m, com:co[String(i)]??null });
    });
  }
}
const carga = await cargarBaseDelMotor(s as never, dueno); if ("error" in carga) throw new Error("x");
for (const it of carga.base.items as It[]) porId.set(it.id, it);
// resolver ids → items (comparador guardó ids)
for (const c of casos) c.its = (c.its as unknown as string[]).map(id=>porId.get(id)).filter(Boolean) as It[];
const { data: cs } = await s.from("eval_corridas").select("id");
for (const c of cs ?? []) {
  const { data: bs } = await s.from("eval_briefs").select("brief, looks, marcas, comentarios").eq("corrida_id", c.id);
  for (const b of bs ?? []) {
    const ctx = construirContexto(carga.base, peticionDeBrief(b.brief as BriefMotor));
    const ma=(b.marcas??{}) as Record<string,string>; const co=(b.comentarios??{}) as Record<string,string>;
    ((b.looks??[]) as {item_ids:string[]}[]).forEach((lk,i)=>{
      const m=ma[String(i)]; if(m!=="arriba"&&m!=="abajo")return;
      const its=(ctx.items as It[]).filter(x=>lk.item_ids.includes(x.id)); if(its.length!==lk.item_ids.length)return;
      casos.push({ et:(b.brief as BriefMotor).etiqueta.replace(/ \(\d+ª\)$/,""), its, m, com:co[String(i)]??null });
    });
  }
}
const rel = casos.filter(c => RELAJADO.test(c.et) && c.its.length >= 3);
const pct = (a:C[]) => a.length ? `${a.filter(c=>c.m==="arriba").length}👍/${a.filter(c=>c.m==="abajo").length}👎 = ${Math.round(a.filter(c=>c.m==="arriba").length/a.length*100)}%` : "—";
console.log(`EVENTOS RELAJADOS (cita/cena amigos/fiesta): ${rel.length} looks votados\n`);
const grupos: [string,(c:C)=>boolean][] = [
  ["traje COMPLETO (lazo conjunto)", c=>trajeCompleto(c.its)],
  ["  · y además corbata/moño", c=>trajeCompleto(c.its)&&conCorbata(c.its)],
  ["  · sin corbata", c=>trajeCompleto(c.its)&&!conCorbata(c.its)],
  ["sastre SUELTO (blazer/saco, sin par)", c=>esSastreSuelto(c.its)],
  ["sin sastre (punto/chamarra/camisa)", c=>!trajeCompleto(c.its)&&!esSastreSuelto(c.its)],
  ["corbata (con o sin traje)", c=>conCorbata(c.its)],
];
for (const [k,f] of grupos) console.log(`  ${k.padEnd(38)} ${pct(rel.filter(f))}`);
console.log(`\n— y en BODA/FUNERAL (código duro), el traje completo como control:`);
const duro = casos.filter(c => /^(boda|funeral)/.test(c.et) && c.its.length>=3);
console.log(`  traje completo ahí: ${pct(duro.filter(c=>trajeCompleto(c.its)))}  (base ${pct(duro)})`);
console.log(`\n👎 de sastre SUELTO en relajado (¿por qué falla el blazer?):`);
for (const c of rel.filter(c=>esSastreSuelto(c.its)&&c.m==="abajo")) console.log(`  · [${c.et}] ${c.its.map(nom).join(" + ")}\n      ${c.com?.replace(/\n+/g," ").slice(0,140) ?? "—"}`);
console.log(`\n👍 de traje completo en relajado (¿cuándo SÍ lo aprueba?):`);
for (const c of rel.filter(c=>trajeCompleto(c.its)&&c.m==="arriba")) console.log(`  · [${c.et}] ${c.its.map(nom).join(" + ")}`);
}
main();
