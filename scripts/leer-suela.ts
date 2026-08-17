// LEER LA SUELA Y EL TOBILLO DE CADA ZAPATO.
//
// POR QUÉ. La regla de lluvia juzgaba el calzado por su MATERIAL, siguiendo el
// criterio que dio Roberto ("tenis de piel o con suela grande… seamos un poquito
// más tolerantes"). En el veredicto de Gemini 3.7 lo afinó sin darse cuenta:
// marcó sus "Tenis de piel negros" como no aptos tres veces, y en cambio aprobó
// unos "Tenis blancos urbanos" con una razón explícita — "pasa lo de la lluvia
// por la SUELA GRUESA".
//
// O sea que el eje real no es de qué está hecho el zapato sino si el agua entra:
// un zapato escotado de suela fina se moja por arriba aunque sea de piel, y uno
// de suela gruesa te levanta del charco. Es el mismo razonamiento que el código
// ya usaba para el mocasín, sólo que no había dato para aplicarlo al resto.
//
// SE PREGUNTAN HECHOS, NO VEREDICTOS. La visión no opina si sirve para la
// lluvia: dice si cubre el tobillo, si la suela es gruesa y si es abierto. La
// regla compone esos hechos. Si algún día cambia el criterio, cambia la regla y
// no hay que volver a mirar 59 fotos.
//
// Cuesta ~$0.0017 por zapato (el mismo modelo que ya lee la ropa).
//
// ─────────────────────────────────────────────────────────────────────────────
// QUÉ PASÓ AL CORRERLO (2026-08-14) — LÉELO ANTES DE USAR ESTE DATO.
//
// Se leyeron 161 zapatos por $0.07 y el dato es REAL: dentro de "tenis" reparte
// 30 gruesa / 31 fina (no es un eco del nombre) y en zapatos de vestir da 0/37.
// Reproducibilidad medida releyendo 16: 14/16, o sea ~12% de ruido en los casos
// frontera.
//
// PERO NO RESOLVIÓ EL CASO QUE LO PIDIÓ. Los "Tenis de piel negros" que Roberto
// marcó como no aptos salieron `gruesa` — igual que los "Tenis blancos urbanos"
// que él aprobó POR la suela gruesa. O sea que la suela no separa sus dos casos
// y el motivo real de su objeción sigue sin saberse.
//
// Y LA GENERALIZACIÓN OBVIA ES PEOR QUE LA REGLA DE HOY. Se simuló "escotado +
// suela fina = falla" sobre su clóset: haría reprobar TODOS los zapatos de
// vestir con lluvia (derby, oxford, charol, formal). Un derby de piel bajo la
// lluvia en la ciudad es normal, y en un evento formal sería bloquear el único
// calzado correcto.
//
// POR ESO LA REGLA DE LLUVIA NO SE TOCÓ. El dato queda guardado (`suela`,
// `cubre_tobillo`, `calzado_abierto`) y hoy NO lo usa nadie. Que esté en la
// base no significa que esté en producción.
// ─────────────────────────────────────────────────────────────────────────────
//
// Uso:  npx tsx scripts/leer-suela.ts [--escribir] [límite]
//       sin --escribir sólo imprime, no toca la base.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

import { llamar, parsearJson } from "../lib/proveedores";
import { VISION_MODEL } from "../lib/models";
import { tipoDePrenda } from "../lib/engine/vocabulario";
import { pickItemImage, ITEM_IMAGE_SELECT, type ItemImageRow } from "../lib/item-image";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stailist.co";

const SYSTEM =
  "Miras la foto de producto de UN par de zapatos y describes lo que ves. No opinas sobre para qué sirven.";

const SCHEMA = {
  type: "object",
  properties: {
    cubre_tobillo: { type: "boolean" },
    suela: { type: "string", enum: ["gruesa", "fina"] },
    abierto: { type: "boolean" },
    seguro: { type: "boolean" },
  },
  required: ["cubre_tobillo", "suela", "abierto", "seguro"],
  additionalProperties: false,
};

const PREGUNTA =
  "Describe este calzado con tres hechos:\n" +
  "· cubre_tobillo: ¿la caña llega al tobillo o más arriba? (bota, botín, Chelsea = sí; zapato bajo, tenis bajo, mocasín = no)\n" +
  "· suela: 'gruesa' si es visiblemente voluminosa o con plataforma (tenis deportivo, bota de suela track, chunky); 'fina' si es delgada y al ras (mocasín, oxford, tenis de lona, balerina)\n" +
  "· abierto: ¿deja el pie al descubierto? (sandalia, huarache, chancla)\n" +
  "Si la foto no deja verlo, responde seguro: false.";

async function main() {
  const escribir = process.argv.includes("--escribir");
  const limite = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 0);

  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // SE SELECCIONA COMO LO HACE LA REGLA, no por `categoria`. La primera versión
  // filtraba por attrs.categoria='calzado' y se dejó fuera justo los tenis del
  // caso — muchas prendas viejas no tienen esa clave. La regla de lluvia deriva
  // la zona del NOMBRE (tipoDePrenda), así que leer por otro criterio garantiza
  // que el dato caiga en un conjunto distinto del que se va a evaluar.
  const { data, error } = await s
    .from("items")
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .is("deleted_at", null);
  if (error) throw new Error(`no pude leer el calzado: ${error.message}`);

  type Z = { id: string; nombre: string; attrs: Record<string, unknown>; path: string; publica: boolean };
  const zapatos: Z[] = [];
  for (const it of data ?? []) {
    const attrs = (it.attrs ?? {}) as Record<string, unknown>;
    const nom = (attrs.nombre as string) ?? "";
    if (tipoDePrenda(nom)?.zona !== "pie") continue;
    // EL RESOLVER CANÓNICO, no uno propio. La primera versión prefería el
    // render sobre el arquetipo y así leía una imagen DISTINTA de la que la app
    // enseña — el orden real pone el arquetipo primero. Auditar una imagen que
    // nadie ve no dice nada del producto.
    const pick = pickItemImage(it as unknown as ItemImageRow);
    if (!pick) continue;
    zapatos.push({
      id: it.id as string,
      nombre: (attrs.nombre as string) ?? "(sin nombre)",
      attrs,
      path: pick.path,
      publica: pick.kind === "public",
    });
  }
  // Los que ya se leyeron no se vuelven a pagar.
  const pendientes = zapatos.filter((z) => z.attrs.suela === undefined);
  const lote = limite > 0 ? pendientes.slice(0, limite) : pendientes;
  console.log(`${zapatos.length} en total · ${zapatos.length - pendientes.length} ya leídos`);
  console.log(`${lote.length} zapatos${escribir ? " (ESCRIBIENDO)" : " (sólo lectura)"}\n`);

  let costo = 0,
    escritos = 0,
    inseguros = 0,
    fallos = 0;

  const CONCURRENCIA = 6;
  for (let i = 0; i < lote.length; i += CONCURRENCIA) {
    await Promise.all(
      lote.slice(i, i + CONCURRENCIA).map(async (z) => {
        try {
          const blob = z.publica
            ? await fetch(`${SITIO}${z.path}`).then((r) =>
                r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))
              )
            : (await s.storage.from("prendas").download(z.path)).data;
          if (!blob) throw new Error("no bajó la imagen");
          const r = await llamar({
            modelo: VISION_MODEL,
            system: SYSTEM,
            texto: PREGUNTA,
            imagen: {
              mediaType: blob.type || "image/jpeg",
              base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
            },
            schema: SCHEMA,
            maxTokens: 200,
          });
          costo += r.costoUsd ?? 0;
          const v = parsearJson<{
            cubre_tobillo: boolean;
            suela: string;
            abierto: boolean;
            seguro: boolean;
          }>(r.texto);
          if (!v.seguro) {
            inseguros++;
            console.log(`  ? ${z.nombre} — la foto no deja verlo`);
            return;
          }
          console.log(
            `  ${z.nombre.padEnd(34)} tobillo:${v.cubre_tobillo ? "sí" : "no "} suela:${v.suela.padEnd(6)} ${v.abierto ? "ABIERTO" : ""}`
          );
          if (!escribir) return;
          // Merge sobre los attrs que ya tiene: escribir el objeto entero
          // pisaría lo que otra pasada haya guardado.
          const nuevos = {
            ...z.attrs,
            cubre_tobillo: v.cubre_tobillo,
            suela: v.suela,
            calzado_abierto: v.abierto,
          };
          const { error: e2 } = await s.from("items").update({ attrs: nuevos }).eq("id", z.id);
          if (e2) throw new Error(`no pude guardar: ${e2.message}`);
          escritos++;
        } catch (e) {
          fallos++;
          console.error(`  ✗ ${z.nombre}: ${e instanceof Error ? e.message : e}`);
        }
      })
    );
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`leídos:    ${lote.length - inseguros - fallos}`);
  console.log(`escritos:  ${escritos}`);
  console.log(`inseguros: ${inseguros}`);
  console.log(`fallos:    ${fallos}`);
  console.log(`costo:     $${costo.toFixed(3)}`);
}

main();
