import { banda, type Banda } from "./color-medidas";
import { oklch } from "./color-perceptual";

// ¿EL LOOK SE LEE COMO UNA DECISIÓN O COMO CINCO COSAS OSCURAS JUNTAS?
//
// EL CASO QUE LO PIDIÓ ("Carbón bajo cero", 2026-08-17): traje gris carbón +
// camisa negra + suéter marino + botines café. Roberto: "al usar tantos colores
// es cuando ya se rompe y se ve no combinando".
//
// POR QUÉ NINGUNA REGLA LO CAZÓ, Y POR QUÉ EL PROMPT TAMPOCO:
// El prompt sabe contar SATURACIÓN ("máximo 1-2 colores protagonistas; el resto
// neutros") pero no sabe medir CONTRASTE. Y declara que gris, negro, marino y
// compañía "son el FONDO del guardarropa, funcionan siempre". Con esa
// aritmética un look de cinco neutros oscuros saca calificación perfecta: cero
// colores compitiendo. El modelo no desobedeció — obedeció una regla incompleta.
//
// La regla popular de "máximo 3 colores" tiene el MISMO agujero, palabra por
// palabra: casi todas sus versiones eximen a los neutros. Esa exención está
// escrita para outfits donde los neutros son el telón de fondo de uno o dos
// colores de verdad; no es licencia para construir el look entero de neutros.
//
// LO QUE SÍ LO EXPLICA, medido con las funciones que ya existían aquí:
//   café #6B4A33 · negro #1A1A1A · marino #1F2A44 · carbón #3A3C42 ×2
//   → las cinco en banda "profundo" (L de 10 a 31), cuatro familias de color,
//     y una sola pieza cálida (café, matiz 56°) contra marino a 266°.
//
// POR QUÉ TRES SEÑALES Y NO UNA, que es lo que hace que esto no sea otro mito
// como el de "marino con negro nunca":
//
//   · Una sola banda de valor la incumple el vestir TONAL (todo carbón/negro/
//     gris), que es un recurso avanzado y se ve muy bien.
//   · Una pieza cálida solitaria la incumple el traje marino con zapato café,
//     que es un clásico.
//
// Cada señal por separado rechaza looks buenos. Por eso la violación exige DOS
// de tres. Las tres juntas no tienen uso legítimo: son cuatro familias de color
// aplastadas en una sola banda con una pieza tirando de la temperatura opuesta,
// que es la definición de "no se ve combinando".

/** Croma mínimo para que una prenda declare temperatura. Debajo es un neutro
 *  acromático (el carbón #3A3C42 mide 0.011; el marino #1F2A44, 0.050). */
const CROMA_CON_TEMPERATURA = 0.03;

/** Ventana de matiz cálido en OKLCH: naranjas, cafés, tierras y amarillos. */
const CALIDO_DESDE = 20;
const CALIDO_HASTA = 110;

export type PrendaCromatica = { nombre: string; hex?: string | null };

export type MedidaCromatica = {
  /** Familias de color distintas, CONTANDO NEUTROS (ahí está el arreglo). */
  familias: number;
  /** Bandas de valor distintas que abarca el look (profundo/medio/claro). */
  bandas: Banda[];
  /** La única prenda que tira de la temperatura contraria, si existe. */
  solitariaTemplada: { nombre: string; temperatura: "cálida" | "fría" } | null;
  /** Cuáles de las tres señales dispararon. */
  senales: string[];
};

/** Cuánto matiz puede separar dos colores y seguir siendo la misma familia.
 *  Dos cafés reales del catálogo caen dentro de 10°; café (56°) y burdeos (17°)
 *  están a 39° y son dos familias. */
const MISMA_FAMILIA_MATIZ = 25;

/**
 * A qué familia de color pertenece una prenda.
 *
 * NO REUSA `mismoColorAOjo` AUNQUE PAREZCA LO MISMO, y la razón vale escribirla
 * porque yo caí en ella primero: esa función pregunta "¿son el mismo color a
 * ojo?" para decidir si dos CUEROS dialogan, y para eso trata a los acromáticos
 * con benevolencia — `distanciaMatiz` devuelve 0 en cuanto uno de los dos tiene
 * croma bajo, porque el ángulo de matiz de un gris es ruido numérico. Correcto
 * allá; aquí hacía que "gris carbón + burdeos" contara como UNA familia y el
 * look que originó la regla midiera 3 familias en vez de 4.
 *
 * Aquí la pregunta es otra: ¿cuántas decisiones de color distintas ve alguien?
 * Y para eso un negro, un gris y un blanco son tres cosas distintas aunque los
 * tres sean acromáticos.
 */
function familiaDe(hex: string): string | null {
  const o = oklch(hex);
  if (!o) return null;
  if (o.C < CROMA_CON_TEMPERATURA) {
    // Acromáticos: la familia la da la claridad. Los cortes son los que usa
    // cualquiera al nombrar la prenda — negro, gris, blanco.
    if (o.L < 0.3) return "neutro:negro";
    if (o.L < 0.75) return "neutro:gris";
    return "neutro:blanco";
  }
  return `matiz:${Math.round(o.h)}`;
}

/** Familias distintas. Los matices se agrupan por cercanía (dos cafés son un
 *  café); los acromáticos, por su corte de claridad. */
function contarFamilias(prendas: PrendaCromatica[]): number {
  const neutros = new Set<string>();
  const matices: number[] = [];
  for (const p of prendas) {
    if (!p.hex) continue;
    const f = familiaDe(p.hex);
    if (!f) continue;
    if (f.startsWith("neutro:")) {
      neutros.add(f);
      continue;
    }
    const h = Number(f.slice("matiz:".length));
    const distancia = (a: number, b: number) => {
      const d = Math.abs(a - b) % 360;
      return d > 180 ? 360 - d : d;
    };
    if (!matices.some((m) => distancia(m, h) <= MISMA_FAMILIA_MATIZ)) matices.push(h);
  }
  return neutros.size + matices.length;
}

/**
 * Piezas que NO son una decisión de color: nudes y metales.
 *
 * LO CAZÓ LA MEDICIÓN CONTRA LOS LOOKS REALES, y de la peor forma posible para
 * mí: la regla se diseñó sobre un look de hombre y sus dos únicos falsos
 * positivos aparecieron en clósets de mujer, los dos por un TACÓN NUDE
 * ("Esmeralda de Noche": pantalón marino + blusa esmeralda + tacón nude +
 * arracadas doradas — un look de noche perfectamente bueno, marcado porque el
 * nude contaba como "la única pieza cálida").
 *
 * Un tacón nude no es un color elegido: es una pieza hecha para DESAPARECER
 * contra la piel, que es justo lo contrario de tirar de la temperatura del
 * look. Los metales igual — la regla popular de los tres colores ya los exime
 * por esta misma razón y aquí se me había pasado.
 *
 * Va por nombre y no por hex a propósito: por color, un nude es indistinguible
 * de un camel o un beige, y ésos SÍ son decisiones de color.
 */
const SIN_DECISION_DE_COLOR =
  /\b(nude|dorad[oa]s?|platead[oa]s?|met[áa]lic[oa]s?|oro|plata)\b/i;

function temperaturaDe(prenda: PrendaCromatica): "cálida" | "fría" | null {
  if (SIN_DECISION_DE_COLOR.test(prenda.nombre)) return null;
  const o = oklch(prenda.hex);
  if (!o || o.C < CROMA_CON_TEMPERATURA) return null; // acromático: no opina
  return o.h >= CALIDO_DESDE && o.h <= CALIDO_HASTA ? "cálida" : "fría";
}

/**
 * Mide el look. Devuelve null si no hay hex suficiente para juzgar: sin dato se
 * calla, nunca inventa una violación (misma disciplina que el resto de reglas).
 */
export function medirCoherencia(prendas: PrendaCromatica[]): MedidaCromatica | null {
  const conColor = prendas.filter((p) => banda(p.hex) !== null);
  // Con menos de tres prendas medibles no hay "demasiadas familias" que juzgar,
  // y un look a medio leer es la vía más corta a un falso positivo.
  if (conColor.length < 3) return null;

  const familias = contarFamilias(conColor);
  const bandas = [...new Set(conColor.map((p) => banda(p.hex)!))];

  const templadas = conColor
    .map((p) => ({ nombre: p.nombre, temperatura: temperaturaDe(p) }))
    .filter((x): x is { nombre: string; temperatura: "cálida" | "fría" } =>
      x.temperatura !== null
    );
  const calidas = templadas.filter((t) => t.temperatura === "cálida");
  const frias = templadas.filter((t) => t.temperatura === "fría");
  // SOLO LA CÁLIDA SOLITARIA, no la fría. Al principio la medí en las dos
  // direcciones y marcaba "camisa blanca + blazer marino + chino camel +
  // mocasín café", donde el marino es el único frío — y eso es un clásico, no
  // un accidente. El fallo real tiene una sola dirección: una pieza cálida
  // (café, tierra, camel) suelta dentro de un look frío, que es exactamente el
  // botín café contra la camisa negra. Al revés —un ancla fría entre cálidos—
  // es cómo se construye medio guardarropa de otoño.
  const solitariaTemplada =
    calidas.length === 1 && frias.length >= 1 ? calidas[0] : null;

  const senales: string[] = [];
  if (familias >= 4) senales.push(`${familias} familias de color`);
  if (bandas.length === 1) senales.push(`todo en un solo tono de ${bandas[0]}`);
  if (solitariaTemplada) {
    senales.push(
      `"${solitariaTemplada.nombre}" es la única pieza ${solitariaTemplada.temperatura}`
    );
  }

  return { familias, bandas, solitariaTemplada, senales };
}

/** El umbral: dos de tres. Ver el porqué arriba — cada señal sola rechaza looks
 *  legítimos (tonal dressing, marino con café). */
export const SENALES_PARA_VIOLAR = 2;

export function rompeCoherencia(m: MedidaCromatica | null): boolean {
  return m !== null && m.senales.length >= SENALES_PARA_VIOLAR;
}
