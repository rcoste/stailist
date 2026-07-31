// Quita de la cosecha lo que NO es una foto de outfit, con un pase de visión.
//
// POR QUÉ EXISTE
// Pinterest devuelve, mezcladas con las fotos buenas, tres cosas que no sirven
// como referencia de estilo: portadas de blog con el título encima ("SMART
// CASUAL OUTFITS FOR MEN — 19 TOP PICKS"), collages de 8 looks en una rejilla,
// y anuncios de tienda con precios. Son como un tercio de lo que llega.
//
// La primera versión de esto le pasaba el problema al humano: "vas a estar
// dándole ← bastante seguido, es normal". Está mal — su ojo es el recurso
// escaso y debe gastarse en la única pregunta que la máquina NO puede
// contestar ("¿es buen ejemplo de este estilo?"), no en tirar anuncios.
//
// El filtro por dimensiones de la cosecha no alcanza: una portada de blog es
// vertical y de buena resolución, igual que una foto buena. Se necesita ver la
// imagen, así que se ve.
//
// NO BORRA: mueve a _descartadas/ dentro de cada estilo. Si el modelo se
// equivoca —y se equivoca— la foto se recupera moviéndola de vuelta.
//
// Uso: node scripts/filtrar-cosecha.mjs [estilo]   (sin estilo = todos)

import { readFileSync, readdirSync, existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const RAIZ = "docs_para_claude/cosecha-hombre";
const CONCURRENCIA = 6;

const env = readFileSync(".env.local", "utf8");
const key = env.split("\n").find((l) => l.startsWith("ANTHROPIC_API_KEY="));
if (!key) {
  console.error("No encontré ANTHROPIC_API_KEY en .env.local");
  process.exit(1);
}
process.env.ANTHROPIC_API_KEY = key.slice("ANTHROPIC_API_KEY=".length).trim().replace(/^"|"$/g, "");

const cliente = new Anthropic();

// El prompt pide la razón ANTES del veredicto a propósito: obliga a mirar la
// imagen antes de decidir, en vez de contestar "sí" por defecto.
const SISTEMA = `Clasificas imágenes cosechadas de Pinterest que se usarán como referencia de estilo de ropa.

Una imagen SIRVE solo si es una fotografía de UNA persona, con el outfit visible de cuerpo entero o de tres cuartos, sin nada encima que estorbe.

NO sirve si tiene cualquiera de esto:
- Texto grande superpuesto (títulos de artículo, "OUTFIT IDEAS", números como "19 TOP PICKS", precios, marcas de agua grandes, "COMMENT LINK").
- Es un collage o rejilla con varios looks o varias personas.
- Es foto de producto o flat-lay: prendas acomodadas sin que nadie las use, o prenda sola sobre fondo liso.
- Es un anuncio de tienda (precios, logos de e-commerce).
- La persona sale tan de cerca que no se ve el outfit (solo cara o solo torso).
- La persona NO es un hombre. Esta cosecha destila estilo masculino, y las búsquedas de Pinterest devuelven looks de mujer mezclados aunque el término diga "men".

Una marca de ropa chiquita en la prenda misma NO es motivo de rechazo.`;

const ESQUEMA = {
  type: "object",
  properties: {
    razon: { type: "string", description: "Qué se ve en la imagen, en pocas palabras" },
    sirve: { type: "boolean" },
  },
  required: ["razon", "sirve"],
  additionalProperties: false,
};

async function clasificar(ruta) {
  const b64 = readFileSync(ruta).toString("base64");
  const tipo = ruta.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await cliente.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 200,
        system: SISTEMA,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: tipo, data: b64 } },
              { type: "text", text: "¿Sirve como referencia de estilo?" },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      const texto = r.content.find((c) => c.type === "text")?.text ?? "{}";
      return JSON.parse(texto);
    } catch (e) {
      // Ante la duda la foto se queda: descartar por un fallo de red sería
      // perder material bueno sin que nadie se entere. Pero se marca el error
      // para que un fallo TOTAL no se lea como "todo pasó el filtro" — que fue
      // exactamente lo que pasó la primera vez que se corrió esto: un 400 en
      // las 58 llamadas y una salida de "0 descartadas" que parecía éxito.
      if (intento === 3) return { sirve: true, error: e.message, razon: "no se pudo clasificar" };
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
}

const soloEstilo = process.argv[2];
const estilos = readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_descartadas")
  .map((e) => e.name)
  .filter((n) => !soloEstilo || n === soloEstilo);

for (const estilo of estilos) {
  const dir = path.join(RAIZ, estilo);
  const descartes = path.join(dir, "_descartadas");
  const fotos = readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));

  let fuera = 0;
  let errores = 0;
  for (let i = 0; i < fotos.length; i += CONCURRENCIA) {
    const lote = fotos.slice(i, i + CONCURRENCIA);
    const veredictos = await Promise.all(
      lote.map((f) => clasificar(path.join(dir, f)))
    );
    lote.forEach((f, j) => {
      const v = veredictos[j];
      if (v.error) {
        errores++;
        if (errores === 1) console.error(`  ⚠ ${f}: ${v.error}`);
        return;
      }
      if (!v.sirve) {
        if (!existsSync(descartes)) mkdirSync(descartes, { recursive: true });
        renameSync(path.join(dir, f), path.join(descartes, f));
        fuera++;
        console.log(`  ✗ ${f} — ${v.razon}`);
      }
    });
  }
  console.log(`${estilo}: ${fotos.length - fuera} quedan, ${fuera} descartadas de ${fotos.length}`);
  if (errores) {
    console.error(
      `  ⚠ ${errores} de ${fotos.length} no se pudieron clasificar y SE QUEDARON sin revisar.`
    );
    if (errores === fotos.length) {
      console.error("  ⚠ Fallaron TODAS: el filtro no corrió. Revisa el error de arriba.");
      process.exitCode = 1;
    }
  }
  console.log("");
}
