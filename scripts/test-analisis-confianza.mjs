// Verifica que el análisis por visión usa bien confianza/inseguro:
// una imagen nítida debe dar confianza alta + inseguro vacío; una ambigua
// (varias prendas, mala luz) debe bajar la confianza y/o marcar campos.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const env = (k) =>
  readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(k + "="))
    ?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");

const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
const PATRONES = ["liso", "rayas", "cuadros", "floral", "animal-print", "grafico", "estampado"];
const INSEGURO = ["nombre", "categoria", "color", "formalidad", "temporada", "material", "patron"];

const SYSTEM = `Eres experta en moda. Miras la foto de UNA prenda y describes sus atributos para un clóset digital. IMPORTANTE — prefiere marcar inseguridad antes que inventar: si la foto no te deja distinguir bien un atributo (el tipo exacto, el material, la formalidad, el color real bajo la luz), da tu mejor estimación PERO agrégalo a 'inseguro' con el nombre del campo. Es mejor una duda honesta que un dato inventado. 'confianza': 'alta' si todo se ve nítido, 'media' si algo cuesta, 'baja' si la foto es ambigua (mala luz, prenda arrugada, varias prendas). Si estás seguro de todo, deja 'inseguro' vacío y 'confianza' en 'alta'.`;

const SCHEMA = {
  type: "object",
  properties: {
    nombre: { type: "string" }, categoria: { type: "string", enum: ["top","saco","bottom","calzado","abrigo","vestido","accesorio"] },
    color: { type: "string" }, color_hex: { type: "string" },
    formalidad: { type: "string", enum: ["casual","formal-casual","formal"] },
    temporada: { type: "string", enum: ["calor","templado","frio","todo-el-año"] },
    material: { type: "string" }, patron: { type: "string", enum: PATRONES },
    confianza: { type: "string", enum: ["alta","media","baja"] },
    inseguro: { type: "array", items: { type: "string", enum: INSEGURO } },
  },
  required: ["nombre","categoria","color","color_hex","formalidad","temporada","patron","confianza"],
  additionalProperties: false,
};

async function analizar(label, path, mime) {
  const b64 = readFileSync(path).toString("base64");
  const res = await client.messages.create({
    model: "claude-opus-5", max_tokens: 500, system: SYSTEM,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
      { type: "text", text: "Describe esta prenda para mi clóset." },
    ] }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  const a = JSON.parse(res.content.find((b) => b.type === "text").text);
  console.log(`\n── ${label} ──`);
  console.log(`   ${a.nombre} · ${a.categoria} · ${a.color}`);
  console.log(`   confianza: ${a.confianza.toUpperCase()}  |  inseguro: [${(a.inseguro ?? []).join(", ") || "—"}]`);
}

await analizar("NÍTIDA (flat-lay de arquetipo)", "public/archetypes/abrigo-camel.png", "image/png");
await analizar("AMBIGUA (persona, blusa sheer + bikini + pantalón)", "docs_para_claude/outfit-inspo/CFZ/IMG_0918.PNG", "image/png");
console.log("");
