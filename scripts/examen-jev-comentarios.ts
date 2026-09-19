// LA SEGUNDA PRUEBA DE JEV: ¿entiende lo que Roberto ESCRIBE?
//
// Uso:  npx tsx scripts/examen-jev-comentarios.ts
//
// POR QUÉ EXISTE. El primer examen (scripts/examen-jev.ts) le pidió a Jev la
// tarea más difícil del producto —adivinar si un look le gusta a Roberto— y
// perdió. Pero de las siete preguntas que le hicimos, UNA tuvo señal real
// (`ocasion`: 0.31 en los 👎 contra 0.15 en los 👍) y las otras seis fueron
// ruido. Ese retrato es consistente con lo que el modelo dice de sí mismo:
// entiende lenguaje y contexto, no tiene ojo.
//
// Así que fallar la prueba de GUSTO no prueba que falle la de COMPRENSIÓN, y
// cerrar el tema sin medir la segunda sería decidir de oído — que es
// exactamente lo que esta casa no hace. Roberto lo dijo con todas sus letras:
// "debe de haber algo que nos sirva".
//
// LA TAREA, que sí es la forma nativa de este modelo: leer una frase y meterla
// en una de siete cajas. Es el enrutamiento de tickets con el que lo venden.
//
// LA VERDAD CONTRA LA QUE SE MIDE no la inventó nadie: son los 👎 donde Roberto
// escribió un comentario Y marcó el defecto con su propio vocabulario. Su
// etiqueta manda; el examen sólo cuenta si Jev llegó a la misma.
//
// LA VARA, escrita antes de correr: el piso es la CLASE MAYORITARIA. Con 22
// casos donde `ocasion` es 10, un clasificador que contestara "ocasion" a todo
// acertaría 45%. Jev tiene que superar eso con claridad para que la respuesta
// sea "sí entiende"; quedarse cerca significa que sólo aprendió el reparto.
//
// EL TAMAÑO, dicho antes que el resultado: son 22 casos. Alcanza para
// distinguir "entiende" de "no entiende", NO para un porcentaje con decimales.
// Si sale peleado, el veredicto correcto es "no concluyente", no el número.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { DEFECTOS_MOTOR } from "../lib/comparador/motor";
import { preguntarJev, type PreguntaChoice } from "../lib/jev";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

/**
 * Las siete cajas, descritas para quien no conoce el producto.
 *
 * Son las MISMAS de `DEFECTOS_MOTOR` y en el mismo orden: si el examen usara
 * otro vocabulario, mediría si Jev adivina mi traducción y no si entiende a
 * Roberto.
 */
const DESCRIPCION: Record<string, string> = {
  clima: "La ropa no aguanta el clima de ese día: frío, calor, o calzado que no sirve para lluvia.",
  ocasion: "El look no corresponde al lugar o al evento: muy informal para algo formal, o al revés.",
  color: "Los colores del look no funcionan juntos, o no le favorecen a la persona.",
  proporcion: "Los largos, volúmenes o siluetas de las prendas no se equilibran entre sí.",
  capas: "Las capas están mal resueltas: sobran, faltan, o es una combinación que nadie usaría.",
  repetido: "El look se parece demasiado a otro, o es la opción más predecible y sin decisión.",
  plano: "El look es correcto pero aburrido: sin textura, contraste ni punto de interés.",
};

type Caso = { texto: string; etiquetas: string[] };

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: pares } = await s
    .from("comparador_motor_pares")
    .select("marcas_look, comentarios_look, defectos_look");

  const casos: Caso[] = [];
  for (const p of pares ?? []) {
    const m = (p.marcas_look ?? {}) as Record<string, Record<string, string>>;
    const com = (p.comentarios_look ?? {}) as Record<string, Record<string, string>>;
    const def = (p.defectos_look ?? {}) as Record<string, Record<string, string[]>>;
    for (const variante of Object.keys(m))
      for (const i of Object.keys(m[variante] ?? {})) {
        if (m[variante][i] !== "abajo") continue;
        const texto = com[variante]?.[i];
        const etiquetas = def[variante]?.[i];
        if (texto?.trim() && etiquetas?.length) casos.push({ texto: texto.trim(), etiquetas });
      }
  }

  const reparto: Record<string, number> = {};
  for (const c of casos) for (const e of c.etiquetas) reparto[e] = (reparto[e] ?? 0) + 1;
  const mayoritaria = Object.entries(reparto).sort((a, b) => b[1] - a[1])[0];
  console.log(`COMPRENSIÓN · ${casos.length} comentarios de Roberto con su propia etiqueta de motivo`);
  console.log(`  reparto: ${Object.entries(reparto).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  PISO (contestar siempre "${mayoritaria[0]}"): ${Math.round((mayoritaria[1] * 100) / casos.length)}%`);

  const pregunta: PreguntaChoice = {
    type: "choice",
    instructions:
      "Una persona rechazó un outfit que le sugirieron y escribió por qué. ¿De qué se está quejando?",
    criteria: Object.fromEntries(DEFECTOS_MOTOR.map((d) => [d.clave, DESCRIPCION[d.clave]])),
  };

  let aciertos = 0, costo = 0, ms = 0, fallos = 0;
  const filas: { texto: string; suyo: string[]; jev: string; conf: number; ok: boolean }[] = [];
  for (const c of casos) {
    try {
      const r = await preguntarJev(c.texto, { motivo: pregunta });
      const a = r.respuestas.motivo;
      if (a?.type !== "choice") { fallos++; continue; }
      costo += r.recibo.costoUsd ?? 0;
      ms += r.recibo.ms;
      // Su etiqueta puede traer más de un motivo: acierta si da con cualquiera
      // de los que él marcó. Exigir el orden sería inventar una vara más dura
      // que la que él mismo usó al etiquetar.
      const ok = c.etiquetas.includes(a.choice);
      if (ok) aciertos++;
      filas.push({ texto: c.texto, suyo: c.etiquetas, jev: a.choice, conf: a.confidence, ok });
    } catch (e) {
      fallos++;
      console.error(`  fallo: ${e instanceof Error ? e.message : e}`);
    }
  }

  const n = filas.length;
  if (!n) { console.error("Ningún comentario contestó."); process.exit(1); }
  console.log(
    `\nACIERTO: ${aciertos}/${n} (${Math.round((aciertos * 100) / n)}%) · piso ${Math.round((mayoritaria[1] * 100) / casos.length)}% · costo $${costo.toFixed(4)} · ${Math.round(ms / n)}ms por comentario · fallos ${fallos}`
  );

  // Con 22 casos el porcentaje no se sostiene solo: hay que poder leer cada uno
  // y ver si el desacuerdo es error del modelo o ambigüedad del comentario.
  console.log(`\nCASO POR CASO`);
  for (const f of filas)
    console.log(
      `  ${f.ok ? "✓" : "✗"} [tú: ${f.suyo.join("+")} · jev: ${f.jev} ${f.conf.toFixed(2)}] "${f.texto.slice(0, 95)}"`
    );

  // La confianza es la mitad de la promesa del modelo: si acierta cuando está
  // seguro y falla cuando duda, sirve aunque el porcentaje global sea medio —
  // porque el código puede preguntar en vez de adivinar.
  const seguros = filas.filter((f) => f.conf >= 0.7);
  const dudosos = filas.filter((f) => f.conf < 0.7);
  console.log(
    `\n¿LA CONFIANZA AVISA? seguro (≥0.70): ${seguros.filter((f) => f.ok).length}/${seguros.length} · dudoso (<0.70): ${dudosos.filter((f) => f.ok).length}/${dudosos.length}`
  );
  console.log(
    `\n⚠ Son ${n} casos: alcanza para distinguir "entiende" de "no entiende", no para un porcentaje fino.`
  );
}

main();
