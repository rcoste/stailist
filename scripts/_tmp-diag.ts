import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of readFileSync(".env.local","utf8").split("\n")) {
  const i=l.indexOf("="); if(i>0&&!l.startsWith("#")) process.env[l.slice(0,i)] ??= l.slice(i+1).trim().replace(/^"|"$/g,"");
}
async function main(){
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: us } = await s.auth.admin.listUsers({ perPage: 1000 });
const me = us?.users.find(u=>u.email==="roberto@kublau.com")!;
const { data: prendas } = await s.from("items").select("id,attrs,archetypes(name,category)").eq("user_id", me.id);
const N=new Map<string,string>(); for(const p of prendas as any[]??[]) N.set(p.id, p.attrs?.nombre ?? p.archetypes?.name ?? "?");

// A) looks marcados en esta ronda, con su marca y comentario
const CORR="8559ec99-8238-42df-9edd-1b5f3e38df94";
const { data: pares } = await s.from("comparador_motor_pares").select("*").eq("corrida_id",CORR).order("n");
const { data: lados } = await s.from("comparador_motor_lados").select("par_id,variante,looks").eq("corrida_id",CORR);
for(const p of pares as any[]){
  console.log(`\n=== PAR ${p.n} · ${p.brief.etiqueta} ===`);
  for(const l of (lados as any[]).filter(x=>x.par_id===p.id)){
    (l.looks??[]).forEach((lk:any,i:number)=>{
      const m=p.marcas_look?.[l.variante]?.[String(i)] ?? "—";
      const c=p.comentarios_look?.[l.variante]?.[String(i)];
      console.log(`  [${m==="arriba"?"👍":m==="abajo"?"👎":"  "}] ${l.variante.slice(0,10)} · ${(lk.item_ids??[]).map((x:string)=>N.get(x)??"?").join(" + ")}`);
      if(c) console.log(`        💬 ${c}`);
    });
  }
}
// B) marcas por ronda (¿fue la peor?)
console.log("\n\n===== 👍/👎 POR RONDA =====");
const { data: corrs } = await s.from("comparador_motor_corridas").select("id,creada,prompt_version").order("creada",{ascending:false}).limit(12);
for(const c of corrs as any[]){
  const { data: ps } = await s.from("comparador_motor_pares").select("marcas_look,voto").eq("corrida_id",c.id);
  let up=0,dn=0,votados=0;
  for(const p of ps as any[]??[]){ if(p.voto) votados++;
    for(const v of Object.values(p.marcas_look??{})) for(const m of Object.values(v as any)) m==="arriba"?up++:m==="abajo"?dn++:0; }
  if(up+dn>0) console.log(`${c.id.slice(0,8)} ${c.creada?.slice(0,16)} v${c.prompt_version}: 👍${up} 👎${dn} → ${Math.round(up*100/(up+dn))}% aprobación (${votados} pares votados)`);
}
}
main();
