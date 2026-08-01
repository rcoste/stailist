// Segundo par de ojos sobre las referencias ya curadas: un juez que solo sabe
// de taxonomía de estilos y no tiene gusto personal.
//
// EL PROBLEMA QUE MIDE
// La curaduría humana pide dos juicios en un solo botón: "¿esto es de este
// estilo?" (taxonomía) y "¿esto se ve bien?" (gusto). Son preguntas distintas y
// se contaminan: quien cura rechaza lo que no se pondría, aunque sea un ejemplo
// perfectamente correcto del estilo. Y si eso pasa, el recetario deja de
// describir el estilo y pasa a describir el guardarropa de una persona — que
// sirve para esa persona y falla para todas las demás.
//
// La sospecha ya tenía forma antes de correr esto: smart-casual se quedó en 3
// de 26 aprobadas, contra 81% y 73% de los otros dos estilos.
//
// NO decide nada por sí solo. Marca dónde el humano y la taxonomía discrepan,
// que es donde hay que mirar.
//
// Uso: node scripts/juez-estilo.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");

const supabase = createClient(leer("NEXT_PUBLIC_SUPABASE_URL"), leer("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const db = new pg.Client({ connectionString: leer("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
await db.connect();
const cliente = new Anthropic();

const DESCRIPCIONES = {
  "smart-casual": "Smart casual: registro entre lo formal y lo casual. Camisa, polo o suéter fino con pantalón de tela o jeans limpios; nunca traje completo, nunca ropa deportiva.",
  "clasico-elegante": "Clásico elegante: sastrería atemporal y tejidos nobles. Pantalón de pinzas, camisa, saco, mocasín. Sin estampados llamativos ni logos.",
  minimalista: "Minimalista: paleta reducida (dos colores), cero estampados y cero logos, siluetas limpias. La textura sustituye al color.",
};

const ESQUEMA = {
  type: "object",
  properties: {
    observado: { type: "string", description: "Qué lleva puesto, en pocas palabras" },
    es_del_estilo: { type: "boolean" },
    ejecucion: { type: "integer", description: "1-5: qué tan bien ejecutado está el look" },
  },
  required: ["observado", "es_del_estilo", "ejecucion"],
  additionalProperties: false,
};

const { rows } = await db.query(
  `select id, estilo, path, sirve from public.referencias
   where genero='hombre' and sirve is not null order by estilo, path`
);

async function juzgar(fila) {
  const { data } = await supabase.storage.from("referencias").createSignedUrl(fila.path, 300);
  const img = await fetch(data.signedUrl).then((r) => r.arrayBuffer());
  const b64 = Buffer.from(img).toString("base64");

  for (let i = 1; i <= 3; i++) {
    try {
      const r = await cliente.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 250,
        // Deliberadamente NO se le dice qué opinó el humano: un juez que ve el
        // veredicto previo tiende a ratificarlo, y entonces mide nada.
        system: `Eres experto en estilos de moda masculina. Juzgas si una foto es un buen ejemplo de un estilo dado.

Juzga SOLO taxonomía y ejecución, nunca tu gusto: una foto puede ser un ejemplo perfecto de un estilo que a ti no te gustaría usar, y eso cuenta como buen ejemplo.

Un estilo admite variantes: el mismo estilo se lleva ceñido o holgado, clásico o moderno, según la escuela. No descartes una variante por no ser la más común.`,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
              { type: "text", text: `${DESCRIPCIONES[fila.estilo]}\n\n¿Esta foto es un buen ejemplo de ese estilo?` },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      return JSON.parse(r.content.find((c) => c.type === "text").text);
    } catch (e) {
      if (i === 3) return { error: e.message };
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

const resultados = [];
for (let i = 0; i < rows.length; i += 5) {
  const lote = rows.slice(i, i + 5);
  const juicios = await Promise.all(lote.map(juzgar));
  lote.forEach((f, j) => resultados.push({ ...f, juez: juicios[j] }));
  process.stdout.write(`\r${resultados.length}/${rows.length}`);
}
console.log("");

const porEstilo = new Map();
for (const r of resultados) {
  if (r.juez?.error) continue;
  const acc = porEstilo.get(r.estilo) ?? { acuerdo: 0, humanoNo_juezSi: 0, humanoSi_juezNo: 0, total: 0 };
  acc.total++;
  if (r.sirve === r.juez.es_del_estilo) acc.acuerdo++;
  else if (!r.sirve && r.juez.es_del_estilo) acc.humanoNo_juezSi++;
  else acc.humanoSi_juezNo++;
  porEstilo.set(r.estilo, acc);
}

console.log("\nDÓNDE DISCREPAN (el humano dijo NO y la taxonomía dice SÍ = rechazo por gusto):");
console.table(
  [...porEstilo.entries()].map(([estilo, v]) => ({
    estilo,
    total: v.total,
    acuerdo: `${Math.round((v.acuerdo / v.total) * 100)}%`,
    "rechazó lo que sí era": v.humanoNo_juezSi,
    "aprobó lo que no era": v.humanoSi_juezNo,
  }))
);

// Las rescatables: el humano las tiró pero son del estilo y están bien
// ejecutadas. Son las que devolverían masa a la destilación.
const rescatables = resultados.filter(
  (r) => !r.sirve && r.juez?.es_del_estilo && r.juez.ejecucion >= 4
);
console.log(`\n${rescatables.length} RESCATABLES (del estilo, bien ejecutadas, rechazadas por el humano):`);
for (const r of rescatables.slice(0, 15)) {
  console.log(`  ${r.estilo}  ${r.path.split("/").pop()}  — ${r.juez.observado}`);
}

await db.query(
  `create table if not exists public.referencias_juez (
     referencia_id uuid primary key references public.referencias(id) on delete cascade,
     es_del_estilo boolean not null,
     ejecucion int not null,
     observado text,
     creado_en timestamptz not null default now()
   )`
);
for (const r of resultados) {
  if (r.juez?.error) continue;
  await db.query(
    `insert into public.referencias_juez (referencia_id, es_del_estilo, ejecucion, observado)
     values ($1,$2,$3,$4) on conflict (referencia_id) do update
     set es_del_estilo=excluded.es_del_estilo, ejecucion=excluded.ejecucion, observado=excluded.observado`,
    [r.id, r.juez.es_del_estilo, r.juez.ejecucion, r.juez.observado]
  );
}
console.log("\nGuardado en public.referencias_juez.");
await db.end();
