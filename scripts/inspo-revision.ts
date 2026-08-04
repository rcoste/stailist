// Arma la vista de "qué fotos vio el motor y qué armó con ellas".
//
// POR QUÉ EXISTE
// Roberto, después de juzgar a ciegas: "quiero entender qué imágenes tomaste
// para la inspo de cada uno de los outfits". Ver la foto al lado del look es lo
// único que dice si el motor la usó, la ignoró, o la usó mal.
//
// Y ahí saltó el fallo: el selector filtra por familia, clima, paleta y silueta
// — NO por ocasión, que es justo lo que él pidió ("que vayan adhoc a la
// ocasión"). La biblioteca no tiene ese campo. Para un evento de noche le
// enseñamos fotos de looks casuales.
//
// Uso: npx tsx scripts/inspo-revision.ts
// Salida: lib/engine/barrido/inspo-revision.json

import { readFileSync, writeFileSync } from "node:fs";

type Fila = {
  caso: { ocasion: string; temp: number; momento: string };
  brazo: string;
  inspiracion?: string[];
  look?: string;
  prendas?: string[];
  explicacion?: string;
  error?: string;
};

const d = JSON.parse(
  readFileSync("docs_para_claude/barrido/ab-inspiracion.json", "utf8")
) as Fila[];
const clave = JSON.parse(
  readFileSync("docs_para_claude/barrido/ab-clave.json", "utf8")
) as { n: number; izq: string; caso: string }[];

const k = (f: Fila) => `${f.caso.ocasion}|${f.caso.temp}|${f.caso.momento}`;
const porCaso = new Map<string, { fotos: string[]; con: Fila[]; sin: Fila[] }>();
for (const f of d) {
  if (f.error) continue;
  const e = porCaso.get(k(f)) ?? { fotos: [], con: [], sin: [] };
  if (f.brazo === "con-marca") {
    e.con.push(f);
    if (f.inspiracion?.length) e.fotos = f.inspiracion;
  } else e.sin.push(f);
  porCaso.set(k(f), e);
}

const casos = clave
  .map((c) => {
    const e = porCaso.get(c.caso);
    if (!e) return null;
    // La familia sale de la carpeta: hombre/<carpeta>/<archivo>.
    return {
      n: c.n,
      caso: c.caso,
      ocasion: e.con[0]?.caso.ocasion ?? "",
      temp: e.con[0]?.caso.temp ?? 0,
      momento: e.con[0]?.caso.momento ?? "",
      fotos: e.fotos.map((p) => ({ url: `/inspo/${p.replace(/\//g, "_")}`, carpeta: p.split("/")[1] })),
      conFotos: e.con.map((x) => ({ look: x.look, prendas: x.prendas, explicacion: x.explicacion })),
      sinFotos: e.sin.map((x) => ({ look: x.look, prendas: x.prendas, explicacion: x.explicacion })),
    };
  })
  .filter(Boolean);

writeFileSync("lib/engine/barrido/inspo-revision.json", JSON.stringify({ casos }, null, 1));
console.log(`${casos.length} casos → lib/engine/barrido/inspo-revision.json`);
