// ¿CON QUÉ UMBRAL AVISAR? Medido contra el clóset real, no elegido a ojo.
//
// El aviso de "ya la tienes" tiene dos formas de fallar y NO cuestan igual:
//   - No avisar de una repetida → sigue el estado de hoy (31 prendas de sobra).
//   - Avisar de más → la persona mira dos fotos y sigue. Barato… hasta que es
//     tan frecuente que se ignora el aviso, y entonces no sirve para nada.
//
// Así que se mide: cuántos de los grupos que el detector de /admin llama
// "idénticas" cazaría cada umbral, y cuántas parejas inventaría entre prendas
// que ese mismo detector clasifica como DISTINTAS (los tres pantalones negros
// de Roberto, que son de sintético, lana y algodón).
//
// Correr: node scripts/calibrar-ya-la-tienes.mjs

import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

// --- la misma matemática que lib/engine/color-perceptual.ts ---
const rgbDeHex = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const aLineal = (v) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const oklch = (hex) => {
  const rgb = rgbDeHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(aLineal);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, bb), h };
};
const distancia = (a, b) => {
  const x = oklch(a);
  const y = oklch(b);
  if (!x || !y) return null;
  const rad = (g) => (g * Math.PI) / 180;
  return Math.hypot(
    (x.L - y.L) / 2,
    x.C * Math.cos(rad(x.h)) - y.C * Math.cos(rad(y.h)),
    x.C * Math.sin(rad(x.h)) - y.C * Math.sin(rad(y.h))
  );
};

const VACIAS = new Set(["de","del","la","el","los","las","con","sin","para","por","un","una","y","mi","tu","su","muy","mas","tipo","estilo"]);
// Los colores no cuentan como nombre: se comparan aparte y con matemática.
const COLORES = new Set(["negro","negra","blanco","blanca","gris","azul","marino","marina","beige","cafe","verde","vino","rosa","rojo","roja","amarillo","amarilla","crema","camel","oliva","marron","plateado","plateada","dorado","dorada","claro","clara","oscuro","oscura","carbon","hueso","arena","celeste","turquesa","morado","morada","lila","coral","mostaza","terracota","burdeos","borgona","nude","khaki","caqui","denim"]);
const palabras = (n) =>
  new Set(
    (n ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !VACIAS.has(p) && !COLORES.has(p))
  );

const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
const { rows } = await c.query(`
  select i.user_id, i.id, lower(trim(coalesce(a.name, i.attrs->>'nombre'))) as nombre,
         i.attrs->>'color_hex' as hex, i.attrs->>'material' as material,
         i.attrs->>'corte' as corte, coalesce(i.attrs->>'categoria', a.category) as categoria,
         i.certeza, coalesce(i.attrs->'confirmados','[]'::jsonb) ? 'corte' as corte_confirmado
  from items i left join archetypes a on a.id=i.archetype_id
  where i.deleted_at is null`);
await c.end();

// La verdad de referencia: el mismo criterio que usa /admin/duplicados.
const porNombre = new Map();
for (const r of rows) {
  const k = r.user_id + "|" + r.nombre;
  if (!porNombre.has(k)) porNombre.set(k, []);
  porNombre.get(k).push(r);
}
const rgbDist = (a, b) => {
  const x = rgbDeHex(a), y = rgbDeHex(b);
  return x && y ? Math.hypot(x[0]-y[0], x[1]-y[1], x[2]-y[2]) : null;
};
const identicas = [], distintas = [];
for (const fs of porNombre.values()) {
  if (fs.length < 2) continue;
  const difiere = ["material", "corte", "categoria"].some(
    (cmp) => new Set(fs.map((f) => f[cmp]).filter(Boolean)).size > 1
  );
  const ds = fs.slice(1).map((f) => rgbDist(fs[0].hex, f.hex)).filter((d) => d != null);
  const max = ds.length ? Math.max(...ds) : 0;
  if (difiere) distintas.push(fs);
  else if (max <= 12) identicas.push(fs);
}

console.log(`referencia: ${identicas.length} grupos "idénticas", ${distintas.length} "distintas"\n`);
const mide = (etiqueta, parecen) => {
  const cazadas = identicas.filter((fs) => parecen(fs[0], fs[1])).length;
  let falsas = 0;
  for (const fs of distintas)
    for (let i = 0; i < fs.length; i++)
      for (let j = i + 1; j < fs.length; j++) if (parecen(fs[i], fs[j])) falsas++;
  console.log(`${etiqueta.padEnd(42)} caza ${cazadas}/${identicas.length}  ·  falsas ${falsas}`);
};

const base = (a, b) => {
  if (!(a.categoria ?? "").trim()) return false;
  if ((a.categoria ?? "").toLowerCase() !== (b.categoria ?? "").toLowerCase()) return false;
  const pa = palabras(a.nombre);
  return [...palabras(b.nombre)].some((w) => pa.has(w));
};

// Variante 1: categoría + nombre + color, barriendo el umbral. El umbral no
// mueve la aguja — las prendas con el mismo nombre tienen el mismo color, así
// que el color no es lo que las separa.
for (const umbral of [0.04, 0.08, 0.2]) {
  mide(`categoría+nombre+color ≤${umbral}`, (a, b) => {
    if (!base(a, b)) return false;
    const d = distancia(a.hex, b.hex);
    return d !== null && d <= umbral;
  });
}

// Variante 2: lo mismo, pero un MATERIAL distinto descarta. Es el dato que de
// verdad separa los tres "Pantalón negro" de Roberto (sintético, lana, algodón).
// Sólo descarta cuando AMBAS lo declaran: ausente no es "distinto".
const materialChoca = (a, b) =>
  !!a.material && !!b.material &&
  a.material.trim().toLowerCase() !== b.material.trim().toLowerCase();
const corteChoca = (a, b) =>
  !!a.corte && !!b.corte && a.corte !== b.corte;

mide("+ material distinto descarta", (a, b) => {
  if (!base(a, b)) return false;
  if (materialChoca(a, b)) return false;
  const d = distancia(a.hex, b.hex);
  return d !== null && d <= 0.08;
});

mide("+ material y corte distintos descartan", (a, b) => {
  if (!base(a, b)) return false;
  if (materialChoca(a, b) || corteChoca(a, b)) return false;
  const d = distancia(a.hex, b.hex);
  return d !== null && d <= 0.08;
});

// Variante 3: el corte SÓLO cuenta si es de fiar. 491 de 670 prendas asumidas
// traen un corte copiado del arquetipo que nadie confirmó — usarlo para
// descartar es dejar que un dato inventado calle un aviso legítimo.
const corteDeFiar = (x) => x.certeza === "exacta" || x.corte_confirmado === true;
mide("+ corte SÓLO si es de fiar", (a, b) => {
  if (!base(a, b)) return false;
  if (materialChoca(a, b)) return false;
  if (corteChoca(a, b) && corteDeFiar(a) && corteDeFiar(b)) return false;
  const d = distancia(a.hex, b.hex);
  return d !== null && d <= 0.08;
});
