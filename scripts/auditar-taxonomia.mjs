// ¿Los 9 "estilos" son de verdad 9 estilos, o hay atributos disfrazados?
//
// EL ERROR QUE VIENE A MEDIR
// "Tonos tierra" se coló como estilo cuando es una PALETA: no compite con
// "sastre", lo describe. Un abrigo camel sobre traje café es las dos cosas, y el
// clasificador —obligado a escoger una casilla— se quedó con el color. Se ve en
// los datos: de 362 fotos de invierno, tonos-tierra se llevó 52 y sastre 1.
// Una sola foto de sastrería en toda una cosecha de abrigos es imposible.
//
// Si ese error pasó una vez, puede haber pasado más. Esto lo mide en vez de
// opinarlo: describe cada foto en dimensiones SEPARADAS y luego compara las
// categorías entre sí. Dos categorías cuyas fotos son indistinguibles en todas
// las dimensiones no son dos estilos — son uno, o una es atributo de la otra.
//
// Deliberadamente NO se le dice al modelo a qué categoría pertenece la foto:
// sabiéndolo, describiría la categoría en vez de la foto.
//
// Uso: node scripts/auditar-taxonomia.mjs [n-por-estilo]

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const POR_ESTILO = Number(process.argv[2] ?? 10);
const CONCURRENCIA = 6;

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");
const cliente = new Anthropic();
const supabase = createClient(leer("NEXT_PUBLIC_SUPABASE_URL"), leer("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const db = new pg.Client({ connectionString: leer("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
await db.connect();

const SISTEMA = `Describes un outfit masculino en dimensiones independientes. No juzgas si te gusta ni a qué "estilo" pertenece: solo describes lo que ves, dimensión por dimensión.

- formalidad 1-5: 1 = ropa de estar en casa; 2 = casual de calle; 3 = arreglado sin ser formal; 4 = de oficina o compromiso; 5 = traje completo o etiqueta.
- paleta: "tierra" (camel, oliva, café, arena), "neutra" (blanco, negro, gris, azul marino), "color" (algún color saturado manda), "oscura" (negro dominante con poco más).
- silueta: "cenida", "recta" u "holgada" — la del conjunto, no la de una prenda.
- ornamento 1-5: 1 = nada, superficies lisas; 3 = algún patrón o detalle; 5 = estampados, logos o accesorios llamativos.
- construccion: "sastreria" si hay saco estructurado o traje; "media" si hay saco suave, camisa formal o tejido fino; "suelta" si todo es casual (camiseta, sudadera, mezclilla, deportivo).
- prendas: las 3 o 4 prendas que definen el look, en palabras simples.`;

const ESQUEMA = {
  type: "object",
  properties: {
    formalidad: { type: "integer", description: "1 a 5" },
    paleta: { type: "string", enum: ["tierra", "neutra", "color", "oscura"] },
    silueta: { type: "string", enum: ["cenida", "recta", "holgada"] },
    ornamento: { type: "integer", description: "1 a 5" },
    construccion: { type: "string", enum: ["sastreria", "media", "suelta"] },
    prendas: { type: "array", items: { type: "string" } },
  },
  required: ["formalidad", "paleta", "silueta", "ornamento", "construccion", "prendas"],
  additionalProperties: false,
};

async function describir(ref) {
  const { data, error } = await supabase.storage.from("referencias").download(ref.path);
  if (error) return { error: error.message };
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await cliente.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system: SISTEMA,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
            { type: "text", text: "Describe este outfit." },
          ],
        }],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      return JSON.parse(r.content.find((c) => c.type === "text")?.text ?? "{}");
    } catch (e) {
      if (i === 3) return { error: e.message };
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

// md5 del id como orden: la muestra es la misma entre corridas, así que dos
// auditorías se pueden comparar.
const { rows } = await db.query(
  `select id, estilo, path from (
     select id, estilo, path, row_number() over (partition by estilo order by md5(id::text)) as n
     from public.referencias
     where genero = 'hombre' and sirve = true and estilo not like '\\_%'
   ) t where n <= $1`,
  [POR_ESTILO]
);
console.log(`${rows.length} fotos en la muestra.\n`);

const datos = [];
for (let i = 0; i < rows.length; i += CONCURRENCIA) {
  const lote = rows.slice(i, i + CONCURRENCIA);
  const ds = await Promise.all(lote.map(describir));
  lote.forEach((r, j) => { if (!ds[j].error) datos.push({ ...r, ...ds[j] }); });
  process.stdout.write(`\r${Math.min(i + CONCURRENCIA, rows.length)} de ${rows.length}`);
}
console.log("\n");

const estilos = [...new Set(datos.map((d) => d.estilo))].sort();
const perfil = (e) => {
  const f = datos.filter((d) => d.estilo === e);
  const moda = (k) => {
    const c = new Map();
    for (const x of f) c.set(x[k], (c.get(x[k]) ?? 0) + 1);
    const [v, n] = [...c.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["-", 0];
    return { v, pct: Math.round((n / f.length) * 100) };
  };
  const prom = (k) => f.reduce((s, x) => s + x[k], 0) / f.length;
  return {
    n: f.length,
    formalidad: Number(prom("formalidad").toFixed(1)),
    ornamento: Number(prom("ornamento").toFixed(1)),
    paleta: moda("paleta"),
    silueta: moda("silueta"),
    construccion: moda("construccion"),
  };
};

console.log("PERFIL DE CADA CATEGORÍA");
console.table(
  estilos.map((e) => {
    const p = perfil(e);
    return {
      estilo: e,
      n: p.n,
      formalidad: p.formalidad,
      ornamento: p.ornamento,
      paleta: `${p.paleta.v} ${p.paleta.pct}%`,
      silueta: `${p.silueta.v} ${p.silueta.pct}%`,
      construccion: `${p.construccion.v} ${p.construccion.pct}%`,
    };
  })
);

// Dos categorías se "pisan" cuando sus perfiles casi coinciden. La distancia
// pesa formalidad y construcción por encima del color: el color es la dimensión
// que ya demostró NO definir un estilo.
const dist = (a, b) => {
  const pa = perfil(a), pb = perfil(b);
  return (
    Math.abs(pa.formalidad - pb.formalidad) * 1.5 +
    Math.abs(pa.ornamento - pb.ornamento) * 0.8 +
    (pa.construccion.v === pb.construccion.v ? 0 : 2) +
    (pa.silueta.v === pb.silueta.v ? 0 : 1)
  );
};

const pares = [];
for (let i = 0; i < estilos.length; i++)
  for (let j = i + 1; j < estilos.length; j++)
    pares.push({ a: estilos[i], b: estilos[j], d: Number(dist(estilos[i], estilos[j]).toFixed(2)) });
pares.sort((x, y) => x.d - y.d);

console.log("\nPARES QUE MÁS SE PISAN (distancia baja = indistinguibles)");
console.table(pares.slice(0, 8).map((p) => ({ "categoría A": p.a, "categoría B": p.b, distancia: p.d })));

// Una categoría que es ATRIBUTO se delata así: sus fotos coinciden en la
// dimensión que le da nombre (el color, por ejemplo) y se dispersan en todas las
// demás. Una que es ESTILO concentra formalidad y construcción.
console.log("\n¿ESTILO O ATRIBUTO? — dispersión interna de cada categoría");
console.table(
  estilos.map((e) => {
    const f = datos.filter((d) => d.estilo === e);
    const disp = (k) => new Set(f.map((x) => x[k])).size;
    const desv = (k) => {
      const m = f.reduce((s, x) => s + x[k], 0) / f.length;
      return Math.sqrt(f.reduce((s, x) => s + (x[k] - m) ** 2, 0) / f.length).toFixed(2);
    };
    return {
      estilo: e,
      "formalidad (desv)": desv("formalidad"),
      "construcciones distintas": disp("construccion"),
      "paletas distintas": disp("paleta"),
      "siluetas distintas": disp("silueta"),
    };
  })
);

writeFileSync("/tmp/auditoria-taxonomia.json", JSON.stringify(datos, null, 2));
console.log("\nDatos crudos en /tmp/auditoria-taxonomia.json");
await db.end();
