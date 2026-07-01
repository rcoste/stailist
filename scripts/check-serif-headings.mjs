// Guardrail del design system v3: la serif (Instrument Serif — clases .display /
// .editorial y utilidades font-display / font-editorial) es SOLO acento en itálica,
// NUNCA en titulares de UI (esos = Arimo sans). Este check falla el build si un
// heading <h1>–<h3> aplica la serif sin itálica, para que no se vuelva a colar.
// Los acentos correctos (numerales, wordmark, frases de loading, texto editorial)
// viven en <span>/<p>, así que no se marcan. `text-display` es un TAMAÑO (no la
// serif) → no cuenta.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];
const offenders = [];
// Token de serif: .display/.editorial (clase) o font-display/font-editorial
// (utilidad). El lookbehind (?<![\w-]) excluye text-display, bg-display, etc.
const SERIF = /(?<![\w-])(font-display|font-editorial|display|editorial)(?![\w-])/;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      walk(p);
      continue;
    }
    if (!p.endsWith(".tsx")) continue;
    const src = readFileSync(p, "utf8");
    const tagRe = /<(h[1-3])\b[^>]*>/g;
    let m;
    while ((m = tagRe.exec(src))) {
      const tag = m[0];
      const clsM = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
      const cls = clsM ? clsM[1] ?? clsM[2] ?? "" : "";
      if (!SERIF.test(cls)) continue;
      if (/\bitalic\b/.test(cls)) continue; // acento italic = permitido
      const line = src.slice(0, m.index).split("\n").length;
      offenders.push(`${p}:${line} — <${m[1]}> con serif`);
    }
  }
}

ROOTS.forEach(walk);

if (offenders.length) {
  console.error(
    "\n❌ Titular(es) de UI con serif. El v3 usa Arimo sans en titulares; la serif\n" +
      "   (.display/.editorial/font-display) es solo acento en itálica. Quítala del heading:\n"
  );
  offenders.forEach((o) => console.error("   - " + o));
  console.error("");
  process.exit(1);
}
console.log("✓ tipografía: sin serif en titulares de UI");
