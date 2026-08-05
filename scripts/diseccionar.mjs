// Convierte una foto de referencia en un BLUEPRINT: su estructura, no su ropa.
//
// DE DÓNDE VIENE
// Idea de Roberto, sostenida a lo largo del día: "aunque esta imagen que saqué
// de Pinterest se pueda usar para estas ocasiones, hay que diseccionar cuál es
// el outfit — funciona bien, podría quedar bien en estos colores, no tanto. De
// alguna manera funciona como un blueprint, y tendríamos muchísimos blueprints".
//
// EL PROBLEMA QUE RESUELVE
// Hoy le pasamos al motor la foto EN CRUDO y le pedimos, en la misma llamada,
// que lea la estructura de la imagen, la cruce contra 45 prendas, respete la
// colorimetría y respete la ocasión. Es el mismo fallo que ya se documentó y
// arregló para el recetario (prompt.ts v32): "recibía 45 prendas en lista plana
// y la receta en prosa, y tenía que emparejarlas de memoria". Se lo arreglamos
// al recetario y no a las fotos.
//
// POR QUÉ NO ES "EL RECETARIO OTRA VEZ"
// El recetario perdió su A/B (5-4-2) y su propio archivo explica por qué:
// "inyectar cinco recetas es lo mismo que no inyectar ninguna". Promediaba
// muchas fotos y salía prosa genérica — "suéter fino sobre camisa oxford con
// pantalón de tela" describe mil looks y pierde justo el detalle que hace que
// funcione. Al medirlo salió peor de lo que decía el comentario: a Roberto se
// le inyectaban DOS familias enteras a la vez (casual-limpio + clásico
// arreglado, 5,596 caracteres) pidiéndole UN outfit. La quimera por diseño.
//
// Un blueprint es de UNA foto. No promedia nada. Es el principio que Roberto
// formuló para los estilos —"no promedies: una de las tres, o las tres"—
// aplicado a la referencia.
//
// LAS DOS DECISIONES DE DISEÑO
// 1. Núcleo contra guarnición. Sin separarlos, el motor o fuerza un disfraz (te
//    pone el pañuelo porque la foto lo traía) o se rinde porque te falta una
//    pieza. Con ellos hay un mínimo claro: si cubres el núcleo, el look es
//    viable.
// 2. El color va como RELACIÓN, no como color. Roberto: "aunque esa foto traiga
//    polo azul, para ese polo podría ser perfectamente verde". Si el blueprint
//    guarda "olivo", el motor empuja olivo contra la colorimetría de la persona.
//    Si guarda "oscuro arriba, claro abajo, un solo saturado", la colorimetría
//    elige el tono y la estructura se respeta.
//
// LOS TIPOS SON DEL VOCABULARIO, no texto libre: si el modelo pudiera escribir
// "suéter ligero", el emparejamiento contra el clóset volvería a ser adivinanza
// de cadenas — que es justo lo que lib/engine/vocabulario.ts existe para evitar.
//
// ZONA NO VISIBLE ≠ ZONA VACÍA. Mucho street style viene recortado: la foto
// testigo de esta celda no enseña los zapatos. Si el blueprint guardara "pie:
// nada", el motor armaría looks descalzos.
//
// Uso: node scripts/diseccionar.mjs [--ocasion=diario] [--clima=templado]
//                                   [--familias=a,b] [--limite=30] [--aplicar]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { TIPOS_POR_ZONA } from "../lib/engine/vocabulario.ts";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const arg = (k, d) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1];
const OCASION = arg("ocasion", "diario");
const CLIMA = arg("clima", "templado");
const FAMILIAS = arg("familias", "clasico-arreglado,casual-limpio").split(",").filter(Boolean);
const LIMITE = Number(arg("limite", 30));
const CONC = Number(arg("conc", 4));
const APLICAR = process.argv.includes("--aplicar");
const SALIDA = "docs_para_claude/blueprints";

const ZONAS_ROPA = ["torso", "capa", "pierna", "pie", "accesorio"];
const TIPOS = ZONAS_ROPA.flatMap((z) => TIPOS_POR_ZONA[z] ?? []);

const ESQUEMA = {
  type: "object",
  properties: {
    nucleo: {
      type: "array",
      description:
        "Las prendas SIN LAS CUALES este look deja de ser este look. Normalmente 3 a 5.",
      items: {
        type: "object",
        properties: {
          zona: { type: "string", enum: ZONAS_ROPA },
          tipo: { type: "string", enum: TIPOS },
          detalle: {
            type: "string",
            description:
              "Cómo es esa prenda en la foto, sin decir su color: corte, tela, largo, cómo se lleva.",
          },
        },
        required: ["zona", "tipo", "detalle"],
        additionalProperties: false,
      },
    },
    guarnicion: {
      type: "array",
      description: "Prendas que SUMAN pero no definen. Si faltan, el look sigue en pie.",
      items: {
        type: "object",
        properties: {
          zona: { type: "string", enum: ZONAS_ROPA },
          tipo: { type: "string", enum: TIPOS },
          detalle: { type: "string" },
        },
        required: ["zona", "tipo", "detalle"],
        additionalProperties: false,
      },
    },
    zonas_no_visibles: {
      type: "array",
      description:
        "Zonas que la foto NO deja ver por recorte o encuadre. NO es que la persona no las lleve.",
      items: { type: "string", enum: ZONAS_ROPA },
    },
    color_relacion: {
      type: "string",
      description:
        "La relación entre los colores, SIN nombrar colores concretos. Ej: 'un solo tono medio-oscuro arriba contra base clara, resto neutros'.",
    },
    color_libre: {
      type: "string",
      description: "Qué colores concretos podrían cambiarse sin romper el look.",
    },
    clave: {
      type: "string",
      description:
        "El detalle que hace que el look funcione y que se perdería al resumirlo. Ej: 'el cuello y los puños de la camisa asomando bajo el punto'.",
    },
    rompe: {
      type: "string",
      description: "Qué cambio lo arruinaría.",
    },
  },
  required: [
    "nucleo",
    "guarnicion",
    "zonas_no_visibles",
    "color_relacion",
    "color_libre",
    "clave",
    "rompe",
  ],
  additionalProperties: false,
};

const SISTEMA = `Diseccionas la foto de un look en su ESTRUCTURA, para que otro sistema pueda reproducirlo con la ropa de otra persona.

No describes la foto. Extraes la receta de por qué funciona.

NÚCLEO contra GUARNICIÓN — es la distinción más importante:
- Núcleo: las prendas sin las cuales el look deja de ser este look. Normalmente 3 a 5.
- Guarnición: lo que suma pero no define. Si falta, el look sigue en pie.
Ojo: a veces un accesorio SÍ es núcleo — una corbata convierte "arreglado" en "formal". Decídelo por lo que hace al look, no por la categoría.

EL COLOR NO SE NOMBRA. Se describe la RELACIÓN. Escribe "un tono medio-oscuro sólido arriba contra base clara", no "suéter verde olivo". Quien use este blueprint tiene su propia colorimetría y va a elegir otros tonos: lo que tiene que sobrevivir es el contraste y cuántos colores conviven, no los tonos exactos.

ZONA NO VISIBLE NO ES ZONA VACÍA. Si la foto está recortada y no se ven los zapatos, ponlo en zonas_no_visibles y NO inventes calzado. Confundir las dos cosas produce looks descalzos.

LA CLAVE es lo que se perdería al resumir. "Suéter sobre camisa" describe mil looks; "el cuello y los puños blancos asomando bajo el punto" describe este, y es lo que lo hace arreglado en vez de casual. Busca ese detalle.

Los tipos de prenda salen de una lista cerrada. Elige el más cercano; si de verdad ninguno sirve, deja esa prenda fuera del núcleo.`;

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const cliente = new Anthropic();

  const { data: fotos } = await s
    .from("referencias")
    .select("id, path, estilo, clima, registro, paleta, silueta, ocasiones")
    .eq("genero", "hombre")
    .eq("sirve", true)
    .eq("clima", CLIMA)
    .in("estilo", FAMILIAS)
    .contains("ocasiones", [OCASION])
    .limit(LIMITE);

  if (!fotos?.length) {
    console.log("No hay fotos para esa celda.");
    return;
  }
  console.log(
    `${fotos.length} fotos · ${OCASION}/${CLIMA} · ${FAMILIAS.join(", ")}${APLICAR ? "" : " (simulación)"}\n`
  );

  const out = [];
  const diseccionar = async (f) => {
    try {
      const { data: bin } = await s.storage.from("referencias").download(f.path);
      const b64 = Buffer.from(await bin.arrayBuffer()).toString("base64");
      const res = await cliente.messages.create({
        // Es lectura fina de una imagen —proporción, cómo cae la tela, qué
        // asoma bajo qué— y de aquí sale TODO lo demás. Un blueprint mal leído
        // se propaga a cada look que lo use, igual que un color mal leído en
        // una prenda (ver VISION_MODEL en lib/models.ts).
        model: "claude-opus-5",
        max_tokens: 1500,
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
                  media_type: f.path.endsWith(".png") ? "image/png" : "image/jpeg",
                  data: b64,
                },
              },
              { type: "text", text: "Disecciona este look." },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      const bp = JSON.parse(res.content.find((b) => b.type === "text").text);
      out.push({
        id: f.id,
        path: f.path,
        estilo: f.estilo,
        clima: f.clima,
        registro: f.registro,
        ocasiones: f.ocasiones,
        ...bp,
      });
      const nucleo = bp.nucleo.map((x) => x.tipo).join(" + ");
      console.log(
        `  ${String(out.length).padStart(2)}  ${f.estilo.padEnd(18)} ${nucleo}${bp.zonas_no_visibles.length ? `   [sin ver: ${bp.zonas_no_visibles.join(",")}]` : ""}`
      );
    } catch (e) {
      console.error(`  ! ${f.path}: ${e.message.slice(0, 70)}`);
    }
  };

  for (let i = 0; i < fotos.length; i += CONC) {
    await Promise.all(fotos.slice(i, i + CONC).map(diseccionar));
  }

  if (APLICAR) {
    mkdirSync(SALIDA, { recursive: true });
    const ruta = `${SALIDA}/${OCASION}-${CLIMA}.json`;
    // FUSIONA por path en vez de sobreescribir: la celda se llena en varias
    // corridas (una por familia, o en tandas para no gastar todo de golpe) y la
    // primera versión pisaba lo anterior — se perdieron 30 blueprints de
    // casual-limpio al correr los de clásico-arreglado.
    let previos = [];
    try {
      previos = JSON.parse(readFileSync(ruta, "utf8"));
    } catch {
      // primera corrida de esta celda
    }
    const porPath = new Map(previos.map((b) => [b.path, b]));
    for (const b of out) porPath.set(b.path, b);
    const todos = [...porPath.values()];
    writeFileSync(ruta, JSON.stringify(todos, null, 1));
    console.log(`\n${out.length} nuevos · ${todos.length} en total → ${ruta}`);
  } else {
    console.log(`\n${out.length} blueprints (nada guardado)`);
  }
}

main();
