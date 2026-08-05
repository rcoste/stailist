// ¿Cuántos blueprints puede armar un clóset de verdad?
//
// EL NÚMERO QUE DECIDE, y por eso existe antes que el motor.
//
// La disciplina que costó tres correcciones aprender hoy: medir la premisa
// ANTES de construir encima. Dos veces di por buena una premisa sin medirla
// ("falta cosechar", "es imposible por definición") y las dos veces era falsa.
// Así que antes de escribir una línea del motor de blueprints, la pregunta es
// si el material y el clóset se tocan siquiera:
//
//   ~20 de 30 armables  → la idea funciona, seguimos
//    ~4 de 30 armables  → se cae, y nos ahorramos semanas
//
// CÓMO SE DECIDE SI UN BLUEPRINT ES ARMABLE
// Por el NÚCLEO, nunca por la guarnición: el núcleo son las prendas sin las
// cuales el look deja de ser ese look, y la guarnición es lo que suma. Exigir
// el reloj de la foto convertiría cualquier medición en un no.
//
// Y la zona NO VISIBLE no se exige: si la foto está recortada y no enseña los
// zapatos, el blueprint no dice nada del calzado, y pedirlo sería inventar un
// requisito que la referencia nunca puso.
//
// TRES NIVELES DE COINCIDENCIA, de estricto a laxo:
//   exacto   el clóset tiene ESE tipo (chino → chino)
//   zona     tiene otro tipo de la misma zona (chino → pantalon-vestir)
//   falta    no tiene nada de esa zona
// El sustituto de zona no es trampa: es lo que un stylist hace de verdad
// —"no tienes chinos, te pongo el pantalón de tela"— y es distinto de sustituir
// entre zonas, que sí rompe el look. Se reportan por separado para que el
// número se pueda leer con y sin sustituciones.
//
// Uso: node scripts/cobertura-blueprints.mjs [--email=...] [--archivo=diario-templado]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { tipoDePrenda } from "../lib/engine/vocabulario.ts";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const arg = (k, d) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1];
const EMAIL = arg("email", "roberto@playrobix.com");
const ARCHIVO = arg("archivo", "diario-templado");

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: perfil } = await s
    .from("profiles")
    .select("id, gender")
    .eq("email", EMAIL)
    .single();
  if (!perfil) throw new Error(`No encontré el perfil ${EMAIL}`);

  const { data: items } = await s
    .from("items")
    .select("id, attrs, archetypes(name)")
    .eq("user_id", perfil.id)
    .is("deleted_at", null);

  // El clóset resuelto a tipos canónicos: qué tipos tiene y qué zonas cubre.
  const tipos = new Set();
  const zonas = new Set();
  let sinReconocer = 0;
  for (const it of items ?? []) {
    const nombre = it.archetypes?.name ?? it.attrs?.nombre ?? "";
    const t = tipoDePrenda(nombre);
    if (!t || t.zona === "no-calle") {
      if (!t) sinReconocer++;
      continue;
    }
    tipos.add(t.tipo);
    for (const z of t.zonas) zonas.add(z);
  }
  console.log(
    `Clóset de ${EMAIL}: ${items.length} prendas · ${tipos.size} tipos distintos · ${sinReconocer} sin reconocer`
  );
  console.log(`zonas cubiertas: ${[...zonas].join(", ")}\n`);

  const bps = JSON.parse(readFileSync(`docs_para_claude/blueprints/${ARCHIVO}.json`, "utf8"));

  let armables = 0;
  let armablesExacto = 0;
  const faltantes = new Map();

  for (const bp of bps) {
    const noVisible = new Set(bp.zonas_no_visibles ?? []);
    const exigido = (bp.nucleo ?? []).filter((n) => !noVisible.has(n.zona));
    const detalle = exigido.map((n) => ({
      ...n,
      nivel: tipos.has(n.tipo) ? "exacto" : zonas.has(n.zona) ? "zona" : "falta",
    }));
    const faltan = detalle.filter((d) => d.nivel === "falta");
    const sustituidas = detalle.filter((d) => d.nivel === "zona");
    if (!faltan.length) armables++;
    if (!faltan.length && !sustituidas.length) armablesExacto++;
    for (const f of faltan) faltantes.set(f.tipo, (faltantes.get(f.tipo) ?? 0) + 1);

    const marca = faltan.length ? "✗" : sustituidas.length ? "~" : "✓";
    console.log(
      `  ${marca} ${bp.estilo.padEnd(18)} ${detalle.map((d) => (d.nivel === "exacto" ? d.tipo : `${d.tipo}(${d.nivel})`)).join(" + ")}`
    );
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`ARMABLES:            ${armables} de ${bps.length}`);
  console.log(`  sin sustituir nada: ${armablesExacto}`);
  console.log(`  con sustituto de la misma zona: ${armables - armablesExacto}`);
  if (faltantes.size) {
    console.log(`\nlo que te falta y en cuántos blueprints pega:`);
    for (const [t, n] of [...faltantes].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${String(n).padStart(2)}×  ${t}`);
    }
  }
}

main();
