import { readFileSync } from "node:fs";
import pg from "pg";
const url = readFileSync(".env.local","utf8").split("\n").find(l=>l.startsWith("DATABASE_URL=")).slice(13).trim().replace(/^"|"$/g,"");
const c = new pg.Client({connectionString:url, ssl:{rejectUnauthorized:false}}); await c.connect();
const {rows} = await c.query(`select p.n, p.brief->>'etiqueta' et, p.repite_de, p.voto, p.marcas_look, p.comentarios_look from comparador_motor_pares p where p.corrida_id='65ded440-3fce-4b49-9fed-5c550f3595d7' order by p.n`);
const TOCADOS = /^(fiesta|cena con amigos|cita|comida de trabajo)/;
const cnt = { v72:{up:0,dn:0}, v71:{up:0,dn:0} };
const cntT = { v72:{up:0,dn:0}, v71:{up:0,dn:0} };
let g72=0, g71=0, emp=0, sinVoto=0;
const espejo = [];
for (const r of rows) {
  const tocado = TOCADOS.test(r.et);
  for (const [variante, marcas] of Object.entries(r.marcas_look ?? {})) {
    const k = variante === "produccion" ? "v72" : "v71";
    for (const m of Object.values(marcas ?? {})) {
      if(m==="arriba"){cnt[k].up++; if(tocado)cntT[k].up++;}
      else if(m==="abajo"){cnt[k].dn++; if(tocado)cntT[k].dn++;}
    }
  }
  if (!r.voto) { sinVoto++; continue; }
  if (r.repite_de) { espejo.push(r); continue; }
  if (r.voto==="produccion") g72++; else if (r.voto==="empate") emp++; else g71++;
  const marca = r.voto==="produccion"?"✅ v72":r.voto==="empate"?"= emp":"❌ v71";
  console.log(`${tocado?"🎯":"  "} par ${String(r.n).padStart(2)} [${r.et}] ${marca}`);
  for (const [va, cc] of Object.entries(r.comentarios_look ?? {})) for (const [i,t] of Object.entries(cc??{})) if(t) console.log(`      [${va==="produccion"?"v72":"v71"} look ${i}] ${String(t).replace(/\n+/g," ").slice(0,170)}`);
}
const pct=(e)=>`${e.up}👍/${e.dn}👎 = ${e.up+e.dn?Math.round(e.up/(e.up+e.dn)*100):0}%`;
console.log(`\nPARES: v72 gana ${g72} · v71 gana ${g71} · empates ${emp} · sin voto ${sinVoto}`);
console.log(`LOOKS TOTAL   → v72: ${pct(cnt.v72)}   v71: ${pct(cnt.v71)}`);
console.log(`LOOKS TOCADOS → v72: ${pct(cntT.v72)}   v71: ${pct(cntT.v71)}`);
for (const e of espejo) console.log(`espejo par ${e.n} [${e.et}]: voto ${e.voto}`);
await c.end();
