// Reparte una cosecha GENÉRICA entre los estilos, viendo la foto.
//
// POR QUÉ LA COSECHA ES GENÉRICA Y NO POR ESTILO
// Buscar "<estilo> + <prenda de abrigo>" mete el sesgo dos veces: la búsqueda
// decide qué prenda usa ese estilo para abrigarse, y luego la destilación lee
// esa decisión como si fuera un hallazgo. Es exactamente el error que ya nos
// mordió con "old money" y con "wide trousers".
//
// Así que se cosecha frío a secas —por técnica ("layering", "cold weather
// street style") y con una canasta ANCHA de prendas (abrigo, puffer, cuero,
// tejido), para que ninguna forma de abrigar domine— y es esta clasificación,
// mirando la foto ya cosechada, la que decide a qué estilo pertenece cada una.
// La búsqueda deja de opinar sobre el estilo.
//
// Puede devolver "ninguno", y debe: una cosecha ancha trae looks que no son de
// ningún estilo del catálogo. Forzarlos a la casilla más cercana ensuciaría la
// destilación con material ajeno, que es peor que perder la foto.
//
// La confianza filtra: por debajo de 4 la foto se queda sin repartir en vez de
// entrar a un estilo a medias. El humano ya tiene bastante que curar.
//
// Uso: node scripts/clasificar-estilo.mjs [carpeta]   (default _frio)

import { readFileSync, readdirSync, existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { FAMILIAS } from "./familias.mjs";

const carpeta = process.argv[2] ?? "_frio";
const RAIZ = "docs_para_claude/cosecha-hombre";
const CONCURRENCIA = 6;
const MIN_CONFIANZA = 4;

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");
const cliente = new Anthropic();

const SISTEMA = `Clasificas fotos de outfits masculinos según a qué familia de estilo pertenecen.

Familias posibles:
${Object.entries(FAMILIAS).map(([id, f]) => `- ${id}: ${f.descripcion}`).join("\n")}

Reglas:
- Contesta la familia que MEJOR describe el look, no la que más se le parezca de lejos.
- Si el look no es claramente de ninguna, contesta "ninguno". Es una respuesta correcta y frecuente — una cosecha amplia trae mucho que no encaja.
- Un look puede rozar dos familias; elige la dominante y baja la confianza.
- No juzgues si el look te gusta ni si está bien puesto. Solo a qué familia pertenece.

Confianza 1-5: 5 = ejemplo de libro de la familia; 3 = encaja pero con dudas; 1 = casi adivinando.`;

const ESQUEMA = {
  type: "object",
  properties: {
    observado: { type: "string", description: "Qué lleva puesto, en pocas palabras" },
    estilo: { type: "string", enum: [...Object.keys(FAMILIAS), "ninguno"] },
    confianza: { type: "integer", description: "1 a 5" },
  },
  required: ["observado", "estilo", "confianza"],
  additionalProperties: false,
};

async function clasificar(ruta) {
  const b64 = readFileSync(ruta).toString("base64");
  const tipo = ruta.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await cliente.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: SISTEMA,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: tipo, data: b64 } },
            { type: "text", text: "¿De qué estilo es este look?" },
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

const dir = path.join(RAIZ, carpeta);
if (!existsSync(dir)) {
  console.error(`No existe ${dir}`);
  process.exit(1);
}
const fotos = readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));
console.log(`${fotos.length} fotos por clasificar.\n`);

const conteo = new Map();
let sinRepartir = 0;
let errores = 0;

for (let i = 0; i < fotos.length; i += CONCURRENCIA) {
  const lote = fotos.slice(i, i + CONCURRENCIA);
  const vs = await Promise.all(lote.map((f) => clasificar(path.join(dir, f))));
  for (let j = 0; j < lote.length; j++) {
    const f = lote[j];
    const v = vs[j];
    if (v.error) {
      errores++;
      if (errores <= 3) console.error(`  ⚠ ${f}: ${v.error}`);
      continue;
    }
    if (v.estilo === "ninguno" || v.confianza < MIN_CONFIANZA) {
      sinRepartir++;
      continue;
    }
    const destino = path.join(RAIZ, v.estilo);
    if (!existsSync(destino)) mkdirSync(destino, { recursive: true });
    // Prefijo para que se distingan de la cosecha vieja del mismo estilo y no
    // choquen si Pinterest devolvió la misma foto en las dos tandas.
    renameSync(path.join(dir, f), path.join(destino, `f-${f}`));
    conteo.set(v.estilo, (conteo.get(v.estilo) ?? 0) + 1);
  }
  process.stdout.write(`\r${Math.min(i + CONCURRENCIA, fotos.length)} de ${fotos.length}`);
}

console.log("\n");
console.table([...conteo.entries()].map(([estilo, n]) => ({ estilo, repartidas: n })));
console.log(`${sinRepartir} sin repartir (ninguno o confianza < ${MIN_CONFIANZA}), ${errores} errores.`);
console.log(`Las sin repartir se quedan en ${dir}.`);
