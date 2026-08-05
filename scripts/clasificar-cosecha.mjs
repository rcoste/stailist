// Le pone FAMILIA a una cosecha hecha POR OCASIÓN, y de paso tira la IA.
//
// POR QUÉ EXISTE
// Todo el pipeline anterior asume que cosechaste por estilo: el nombre de la
// carpeta ES la familia y subir-referencias.mjs lo lee de ahí. Idea de Roberto,
// y es la correcta: la biblioteca se cosechó buscando estilos ("minimalist
// street style") y por eso la cobertura por ocasión salió un accidente —evento
// tiene 144 fotos porque el street style no fotografía bodas—. Buscar por
// OCASIÓN ("mens summer wedding guest outfit") trae material de otra naturaleza,
// pero llega sin familia. Este script es el paso que faltaba: cosechas por
// ocasión y DESPUÉS subcategorizas por estilo, mirando la foto.
//
// Y TIRA LA IA EN LA MISMA PASADA, no en otra
// Las búsquedas por ocasión son de intención comercial ("wedding guest outfit"
// es tema de granja de blogs) y vienen inundadas de imágenes generadas mucho más
// que las de estilo. En la tanda de prueba, con el registro perfecto —blazer
// arena, camisa blanca, pantalón marino— y generada con IA: manos, piel y
// desenfoque delatándola. Destilar de ahí es aprender de una copia de una copia,
// justo cuando el producto mismo genera imágenes. Ya existe barrer-renders.mjs
// pero corre sobre las YA aprobadas, o sea después de que un humano las miró;
// aquí se hace antes y en la misma llamada, que además sale más barato.
//
// DEJA LA DUDA VIVA: solo se mata con veredicto 'ia' claro. Es el mismo criterio
// de barrer-renders — la duda respeta el material en vez de tirarlo, porque un
// falso positivo aquí borra una foto buena y nadie se entera.
//
// NO BORRA: mueve a _descartadas-ia/ y _sin-familia/ dentro de la raíz de la
// cosecha. Todo recuperable con un mv.
//
// Uso: node scripts/clasificar-cosecha.mjs <carpeta-de-origen> [--aplicar]
//      sin --aplicar solo dice qué haría.

import { readFileSync, readdirSync, renameSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { FAMILIAS } from "./familias.mjs";

const RAIZ = "docs_para_claude/cosecha-hombre";
const CONCURRENCIA = 5;

const origen = process.argv[2];
const APLICAR = process.argv.includes("--aplicar");
if (!origen) {
  console.error("Uso: node scripts/clasificar-cosecha.mjs <carpeta-de-origen> [--aplicar]");
  process.exit(1);
}
const DIR = path.join(RAIZ, origen);
if (!existsSync(DIR)) {
  console.error(`No existe ${DIR}`);
  process.exit(1);
}

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");
const cliente = new Anthropic();

const IDS = Object.keys(FAMILIAS);

const SISTEMA = `Miras una foto de un look de calle y contestas DOS cosas independientes.

1) ¿ES UNA IMAGEN GENERADA POR IA?
Búscalo en: manos y dedos mal resueltos, texturas de piel de plástico, desenfoque de fondo demasiado parejo o cremoso, gente de fondo con caras derretidas, joyería o botones que no cierran su forma, telas cuyo pliegue no obedece a la gravedad, simetría antinatural. Veredicto de tres valores: "foto", "ia" o "duda". Ante la duda di "duda", NUNCA "ia": un falso positivo borra material bueno y nadie se entera.

Sé EXIGENTE con "foto": resérvalo para cuando no veas NINGUNA señal de las de arriba. Una imagen impecable de estudio con luz perfecta, fondo cremoso y modelo sin un pelo fuera de sitio, en una búsqueda de blog, casi nunca es una foto real de calle — eso es "duda". "foto" es el veredicto de una imagen que se ve tomada por alguien, con ruido, sombras duras o encuadre imperfecto.

2) ¿A QUÉ FAMILIA DE ESTILO PERTENECE EL LOOK?
Elige UNA de estas, la que mejor lo describa:
${IDS.map((id) => `- "${id}": ${FAMILIAS[id].descripcion}`).join("\n")}

Si el look no cae limpiamente en ninguna, di "ninguna". Es mejor "ninguna" que forzarlo: una foto mal clasificada envenena la familia entera.

Clasificas por CONSTRUCCIÓN, no por color ni por el sitio donde se tomó la foto. Un traje completo es sastre aunque sea beige y esté en una playa. Un polo con chinos es preppy aunque sea en una oficina.`;

const ESQUEMA = {
  type: "object",
  properties: {
    razon: { type: "string", description: "Qué se ve, en pocas palabras" },
    autenticidad: { type: "string", enum: ["foto", "ia", "duda"] },
    familia: { type: "string", enum: [...IDS, "ninguna"] },
  },
  required: ["razon", "autenticidad", "familia"],
  additionalProperties: false,
};

const mover = (desde, aCarpeta) => {
  const destino = path.join(RAIZ, aCarpeta);
  mkdirSync(destino, { recursive: true });
  renameSync(desde, path.join(destino, path.basename(desde)));
};

async function main() {
  const fotos = readdirSync(DIR).filter((f) => /\.(jpg|png)$/i.test(f));
  if (!fotos.length) {
    console.log("No hay fotos que clasificar.");
    return;
  }
  console.log(`${fotos.length} fotos${APLICAR ? "" : " (simulación)"}\n`);

  const cuenta = {};
  const clasificar = async (f) => {
    const ruta = path.join(DIR, f);
    try {
      const b64 = readFileSync(ruta).toString("base64");
      const res = await cliente.messages.create({
        // Clasificar contra criterios ya escritos es trabajo de CLASSIFY, no del
        // motor (ver lib/models.ts). Y son decenas de llamadas por tanda.
        model: "claude-sonnet-5",
        max_tokens: 300,
        thinking: { type: "disabled" },
        system: SISTEMA,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: f.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
                  data: b64,
                },
              },
              { type: "text", text: "¿Es foto real o IA, y de qué familia es el look?" },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      const v = JSON.parse(res.content.find((b) => b.type === "text").text);
      // La duda va a su propio apartado, no a la familia. En la tanda de prueba
      // el modelo dio por real una imagen que a ojo humano era generada (blazer
      // arena, manos y desenfoque delatándola), así que confiar en el "foto" a
      // secas mete IA a la biblioteca en silencio. Y tirar la duda tampoco: el
      // falso positivo borra material bueno sin que nadie se entere. Apartarla
      // deja las familias limpias y la decisión, que es de ojo, para el humano —
      // sobre 3 fotos y no sobre 60.
      const destino =
        v.autenticidad === "ia"
          ? "_descartadas-ia"
          : v.autenticidad === "duda"
            ? "_duda-ia"
            : v.familia === "ninguna"
              ? "_sin-familia"
              : v.familia;
      cuenta[destino] = (cuenta[destino] ?? 0) + 1;
      if (APLICAR) mover(ruta, destino);
      const marca = destino.startsWith("_") ? "✗" : "→";
      console.log(`  ${marca} ${f.padEnd(14)} ${destino.padEnd(18)} ${v.razon.slice(0, 58)}`);
    } catch (e) {
      console.error(`  ! ${f}: ${e.message.slice(0, 70)}`);
    }
  };

  for (let i = 0; i < fotos.length; i += CONCURRENCIA) {
    await Promise.all(fotos.slice(i, i + CONCURRENCIA).map(clasificar));
  }
  console.log(`\nreparto${APLICAR ? "" : " que haría"}:`);
  for (const [k, v] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(3)}  ${k}`);
  }
}

main();
