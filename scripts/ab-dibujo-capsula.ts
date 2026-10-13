import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}
import { buildImagePrompt } from "../lib/archetype-image";
import { garmentRenderDesc } from "../lib/garment-desc";
import { GEMINI_MODEL_RAPIDO, GEMINI_MODEL_ROPA, pedirImagen } from "../lib/gemini-imagen";

// A/B A CIEGAS: ¿con qué modelo se dibujan las prendas IDEALES de la cápsula?
//
// Hoy salen del "rápido" (gemini-3.1-flash-image, $0.067). La ropa del clóset
// ya se dibuja con Nano Banana 2.1 ($0.033), que ganó a ciegas contra Pro —pero
// esa prueba fue de FOTO a imagen (lib/extraer-prenda.ts). Aquí es de TEXTO a
// imagen, en plano, sin foto: otra tarea, otra prueba. Mismo prompt exacto que
// producción (buildImagePrompt + garmentRenderDesc), los dos modelos, orden
// izquierda/derecha al azar por par, y la clave se guarda aparte para revelar
// después de votar.
//
// Uso: npx tsx scripts/ab-dibujo-capsula.ts [carpeta-de-salida]
// Deja N pares como <i>-izq.jpg / <i>-der.jpg, un index.html para verlos
// lado a lado y clave.json con qué modelo quedó de cada lado.

const SALIDA = process.argv[2] ?? "ab-capsula";
const A = GEMINI_MODEL_RAPIDO;
const B = GEMINI_MODEL_ROPA;

type Caso = {
  nombre: string;
  tipo: string;
  color: string;
  categoria: string;
  formalidad?: string;
  temporada?: string;
  gender: "hombre" | "mujer";
};

// Ocho combos como los que pide una cápsula real (claves recientes de
// catalog_renders): básicos lisos de hombre y de mujer, con un calzado por lado.
const CASOS: Caso[] = [
  { nombre: "Camisa oxford azul claro", tipo: "camisa", color: "azul claro", categoria: "top", formalidad: "smart-casual", gender: "hombre" },
  { nombre: "Chino beige", tipo: "pantalon", color: "beige", categoria: "bottom", formalidad: "casual", gender: "hombre" },
  { nombre: "Suéter de lana gris", tipo: "sueter", color: "gris", categoria: "top", temporada: "frio", gender: "hombre" },
  { nombre: "Mocasín de piel café", tipo: "mocasin", color: "chocolate", categoria: "calzado", formalidad: "smart-casual", gender: "hombre" },
  { nombre: "Blusa de seda blanca", tipo: "blusa", color: "blanco", categoria: "top", formalidad: "smart-casual", gender: "mujer" },
  { nombre: "Pantalón sastre negro", tipo: "pantalon-sastre", color: "negro", categoria: "bottom", formalidad: "formal", gender: "mujer" },
  { nombre: "Vestido midi verde oliva", tipo: "vestido", color: "oliva", categoria: "vestido", formalidad: "casual", gender: "mujer" },
  { nombre: "Tenis blancos de piel", tipo: "tenis", color: "blanco", categoria: "calzado", formalidad: "casual", gender: "mujer" },
];

async function dibujar(c: Caso, modelo: string): Promise<Buffer | null> {
  const desc = garmentRenderDesc({
    nombre: c.nombre,
    tipo: c.tipo,
    color: c.color,
    categoria: c.categoria,
    formalidad: c.formalidad,
    temporada: c.temporada,
    sinPatronDeclarado: true,
  });
  const type = c.categoria === "calzado" ? "shoes" : "flat";
  const r = await pedirImagen([{ text: buildImagePrompt(desc, type, c.gender) }], { modelo, aspecto: "3:4", ctx: null });
  if ("motivo" in r) {
    console.error(`  ✗ ${c.nombre} con ${modelo}: ${r.motivo}`);
    return null;
  }
  return Buffer.from(r.data, "base64");
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const clave: { i: number; nombre: string; izq: string; der: string }[] = [];
  const filas: string[] = [];
  for (let i = 0; i < CASOS.length; i++) {
    const c = CASOS[i];
    const t0 = Date.now();
    const [a, b] = await Promise.all([dibujar(c, A), dibujar(c, B)]);
    if (!a || !b) continue;
    const aIzq = Math.random() < 0.5;
    writeFileSync(`${SALIDA}/${i + 1}-izq.jpg`, aIzq ? a : b);
    writeFileSync(`${SALIDA}/${i + 1}-der.jpg`, aIzq ? b : a);
    clave.push({ i: i + 1, nombre: c.nombre, izq: aIzq ? A : B, der: aIzq ? B : A });
    filas.push(
      `<figure><figcaption>${i + 1}. ${c.nombre} <small>(${c.gender})</small></figcaption><div><img src="${i + 1}-izq.jpg"><img src="${i + 1}-der.jpg"></div></figure>`
    );
    console.log(`  ${i + 1}. ${c.nombre} listo (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  writeFileSync(`${SALIDA}/clave.json`, JSON.stringify(clave, null, 2));
  writeFileSync(
    `${SALIDA}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>A/B dibujo de cápsula</title>
<style>body{font-family:system-ui;background:#f4f3f1;color:#141414;margin:0;padding:24px}
h1{font-size:18px;margin:0 0 16px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;max-width:1200px}
figure{margin:0;background:#fff;border:1px solid #e4e3e0;border-radius:6px;padding:12px}
figcaption{font-weight:600;margin-bottom:8px}small{color:#6f6f6f;font-weight:400}
figure div{display:grid;grid-template-columns:1fr 1fr;gap:8px}img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:4px}
figure div img:first-child::after{content:"izq"}</style>
<h1>¿Cuál dibujo prefieres de cada par? Di "1 izquierda, 2 derecha…" o "igual".</h1><main>${filas.join("")}</main>`
  );
  console.log(`listo: ${clave.length} pares en ${SALIDA}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
