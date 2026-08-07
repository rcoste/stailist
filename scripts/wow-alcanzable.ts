// ¿El 5 del wow es ALCANZABLE, o la escala está rota?
//
// Uso:  npx tsx scripts/wow-alcanzable.ts
//
// POR QUÉ EXISTE
// La línea base del eval dio wow {2:8, 3:25, 4:7} sobre 40 looks: CERO cincos.
// Eso admite dos lecturas y son muy distintas: (a) el motor nunca llega a
// excelente, o (b) el 5 es inalcanzable por cómo está escrita la rúbrica. Si es
// (b), optimizar el prompt es perseguir un número que no se puede mover, y
// todo el trabajo siguiente se mediría contra una vara rota.
//
// La prueba es directa: se le dan al juez looks ESCRITOS A MANO para sacar 5
// —cada uno con una decisión de styling con chispa Y un gesto físico concreto—
// y se ve qué nota les pone. Si ni éstos llegan a 5, el problema es la vara.
//
// Los looks van con prendas plausibles de un clóset masculino real y con briefs
// del pool: si el juez pudiera objetar el clima o la ocasión, no estaríamos
// midiendo el wow sino otra cosa.
import { readFileSync } from "node:fs";
import { evaluarLook, RUBRICA_VERSION, type BriefRubrica, type LookRubrica } from "../lib/engine/rubrica";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const ESTILO = {
  marca: "minimalismo refinado: sastrería suave, neutros profundos y un acento de color por look",
  palabras: "sencillo pero con intención — que se note el cuidado, no el esfuerzo",
  arquetipo: "El editor — neutros, corte impecable y un guiño de color",
};
const COLOR = {
  estacion: "invierno",
  mejores: [
    { nombre: "Vino", hex: "#722F37" },
    { nombre: "Esmeralda", hex: "#046307" },
    { nombre: "Azul rey", hex: "#1F4E9C" },
  ],
  prestados: [{ nombre: "Chocolate", hex: "#4A342A" }],
  evita: [{ nombre: "Camel", hex: "#C19A6B" }],
};

const CASOS: { que: string; brief: BriefRubrica; look: LookRubrica }[] = [
  {
    que: "contraste de textura + acento de color + gesto de proporción",
    brief: {
      objective: "diario",
      momento: "dia",
      weather: { temp_c: 18, condition: "nublado" },
      estilo: ESTILO,
      color: COLOR,
    },
    look: {
      nombre: "Punto grueso sobre sastre",
      explicacion:
        "El suéter de punto grueso vino contra el pantalón de sastre carbón: dos pesos que se contradicen a propósito, y el vino te enciende la cara.",
      tip: "Métete el suéter apenas al frente y deja el resto suelto — te marca la cintura sin acartonarte, y el pantalón de sastre gana pierna.",
      prendas: [
        { nombre: "Suéter de punto grueso vino", color: "vino #722F37", material: "lana" },
        { nombre: "Pantalón de sastre carbón", color: "carbón #3A3B3F", material: "lana fría" },
        { nombre: "Botines Chelsea negros", color: "negro #1A1A1A", material: "piel" },
      ],
    },
  },
  {
    que: "monocromo roto por textura + gesto de calzado",
    brief: {
      objective: "evento",
      plan: "cena con amigos en un restaurante",
      tipoEvento: "cena-amigos",
      formality: "semiformal",
      momento: "noche",
      weather: { temp_c: 15, condition: "despejado" },
      estilo: ESTILO,
      color: COLOR,
    },
    look: {
      nombre: "Negro sobre negro, tres texturas",
      explicacion:
        "Todo negro, pero en punto, lana y gamuza: el look se lee por textura y no por color, que es el truco más difícil de sostener.",
      tip: "Deja el cuello tortuga por fuera del pantalón y sube el dobladillo una vuelta para que se vea el botín de gamuza — la gamuza es la que rompe el bloque.",
      prendas: [
        { nombre: "Cuello tortuga negro de merino", color: "negro #1A1A1A", material: "merino" },
        { nombre: "Pantalón de lana negro", color: "negro #16161A", material: "lana" },
        { nombre: "Botines de gamuza negros", color: "negro #1C1A1A", material: "gamuza" },
      ],
    },
  },
  {
    que: "el caso EXTREMO: styling de revista, gesto quirúrgico",
    brief: {
      objective: "oficina",
      workDressCode: "business_casual",
      momento: "dia",
      weather: { temp_c: 20, condition: "despejado" },
      estilo: ESTILO,
      color: COLOR,
    },
    look: {
      nombre: "Esmeralda bajo sastre",
      explicacion:
        "El blazer carbón sin estructura sobre una camisa esmeralda: el color más fuerte de tu paleta va escondido bajo el neutro y solo asoma en el cuello y los puños. Es el guiño que la gente nota sin saber por qué.",
      tip: "Arremanga el blazer dos vueltas por encima del puño de la camisa — deja que el esmeralda se asome ahí, y no toques el cuello.",
      prendas: [
        { nombre: "Blazer carbón sin estructura", color: "carbón #37383D", material: "lana fría" },
        { nombre: "Camisa esmeralda", color: "esmeralda #046307", material: "algodón" },
        { nombre: "Pantalón de sastre gris medio", color: "gris #6E7075", material: "lana fría" },
        { nombre: "Derbys de piel negros", color: "negro #1A1A1A", material: "piel" },
      ],
    },
  },
  {
    que: "CONTROL: correcto pero plano (debería dar 3, no más)",
    brief: {
      objective: "diario",
      momento: "dia",
      weather: { temp_c: 18, condition: "nublado" },
      estilo: ESTILO,
      color: COLOR,
    },
    look: {
      nombre: "Camisa y chinos",
      explicacion: "Una camisa blanca con chinos azules: resuelve el día sin complicaciones.",
      tip: "Deja la camisa por fuera para que se vea relajado.",
      prendas: [
        { nombre: "Camisa oxford blanca", color: "blanco #FAFAF7", material: "algodón" },
        { nombre: "Chinos azul marino", color: "marino #27425F", material: "algodón" },
        { nombre: "Tenis de piel blancos", color: "blanco #F2F2F0", material: "piel" },
      ],
    },
  },
];

async function main() {
  console.log(`¿El 5 del wow es alcanzable? · rúbrica ${RUBRICA_VERSION}\n`);
  let maxWow = 0;
  for (const c of CASOS) {
    try {
      const { nota } = await evaluarLook(c.brief, c.look);
      maxWow = Math.max(maxWow, nota.wow);
      console.log(`"${c.look.nombre}" — ${c.que}`);
      console.log(
        `  wow ${nota.wow} · ocasión ${nota.ocasion} · clima ${nota.clima} · armado ${nota.armado} · estilo ${nota.estilo} · color ${nota.color}`
      );
      console.log(`  ${nota.porQue}\n`);
    } catch (e) {
      console.log(`"${c.look.nombre}" — FALLÓ: ${e instanceof Error ? e.message : e}\n`);
    }
  }
  console.log("=".repeat(64));
  console.log(
    maxWow >= 5
      ? "EL 5 SÍ ES ALCANZABLE: la escala sirve; lo que falta es motor."
      : `NADIE PASÓ DE ${maxWow}: la vara es sospechosa. Antes de tocar el prompt del motor, hay que revisar cómo está escrito el 5 de la rúbrica — si nada puede sacarlo, el promedio no se mueve aunque el motor mejore.`
  );
}

main();
