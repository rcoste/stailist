import { llamar, type Modelo } from "@/lib/proveedores";
import { SEASONS, seasonPalette, normSeason, type Season } from "@/lib/colorimetria";
import type { Weather } from "@/lib/weather";

// "¿ME VEO BIEN?" — LA AMIGA QUE TE MIRA ANTES DE SALIR.
//
// QUÉ ES Y QUÉ NO ES. No es una evaluación. Una app que te califica sin que se
// lo pidas te está juzgando, y la usuaria de esto es gente con crisis frente al
// clóset: si el tono se va un grado, construimos algo que le dice a alguien
// inseguro, cada mañana, qué hizo mal. Aquí la persona PREGUNTA y la amiga
// CONTESTA. Es la misma foto y el mismo consejo, pero el contrato emocional es
// el opuesto — y el momento también: ya estás vestido, a punto de salir, y
// dudas. Ése es el instante en que alguien sí saca el teléfono; "documentar mi
// outfit del día" es una tarea, y las tareas no se sostienen.
//
// POR QUÉ ESTAS TRES COSAS Y NO OTRAS. Todo lo que se responde aquí se paga
// HOY, sin un solo día de historial:
//   · colorimetría — su estación ya está en el perfil desde el onboarding;
//   · clima        — Open-Meteo ya corre en producción;
//   · un ajuste    — el motor ya sabe producirlos.
// Lo más diferenciado que se puede llegar a hacer —"oye, siempre andas de
// azul"— necesita un mes de datos. Prometerlo el día 1 sería vender lo que no
// se tiene, y apostar el módulo entero a un hábito que no está probado: el
// botón de "me lo puse", que cuesta UN tap, se usó 12 veces en toda la historia
// del proyecto y una sola vez alguien volvió al día siguiente.
//
// LO QUE DELIBERADAMENTE NO HACE: empatar la foto contra el clóset (reconocer
// que son TUS jeans índigo). Es lo que más magia da y lo que más se equivoca, y
// un error visible todos los días quema la confianza rápido. Entra después,
// cuando el consejo se haya ganado el hábito.

export type LecturaEspejo = {
  /**
   * Cómo se llama este look en el diario. DOS O TRES PALABRAS.
   *
   * Existe porque usé `resumen` de título y quedó fatal: la entrada del diario
   * se llamaba "Chamarra tipo militar en azul muy oscuro, playera del mismo tono
   * debajo, pantalón khaki y tenis blancos" — un párrafo entero en la serif
   * grande, al lado de looks que se llaman "Blazer con oficio". El resumen sirve
   * para demostrar que miró la foto; para nombrarla hace falta otra cosa.
   */
  titulo: string;
  /** Qué trae puesto, en corto — para que se vea que la miró de verdad. */
  resumen: string;
  /** Qué le hace su paleta a la cara con ESTE outfit. Siempre algo que decir. */
  colorimetria: string;
  /** El clima de hoy contra lo que trae puesto. null si no hay dato de clima. */
  clima: string | null;
  /** UN ajuste concreto y accionable ahora mismo, sin cambiarse de ropa. */
  ajuste: string;
};

// v3: contra el elogio hueco. Medido sobre las 17 lecturas reales de la base —
// 7 tenían "así como estás, sales" como consejo COMPLETO (las últimas 5,
// seguidas) y 5 llevaban superlativos genéricos del tipo "te queda de lujo".
// Roberto: "siento está muy barbero el feedback". La regla vieja lo pedía sin
// querer ("siempre hay algo bien en un outfit" + "si el look está bien, dilo y
// ya"), así que la corrección va en el prompt y no en el tono de la UI.
export const ESPEJO_VERSION = "espejo-v3";

export const SCHEMA_ESPEJO = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    resumen: { type: "string" },
    colorimetria: { type: "string" },
    clima: { type: "string" },
    ajuste: { type: "string" },
  },
  required: ["titulo", "resumen", "colorimetria", "ajuste"],
  additionalProperties: false,
} as Record<string, unknown>;

const SYSTEM_ESPEJO = `Eres su amiga que se viste increíble y a la que le acaba de mandar una foto preguntando "¿me veo bien?". Ella YA está vestida y a punto de salir: no puede rehacer su outfit, y tú no eres un juez.

CÓMO HABLAS: cálida, directa, de tú. Cero jerga de moda ("los tonos tierra te encienden la cara", NUNCA "eres otoño profundo"). Frases cortas. Nada de listas ni de vocabulario técnico.

REGLA DE ORO DEL TONO: empiezas por lo que SÍ está funcionando, y es de verdad — no un cumplido de relleno para amortiguar. Después, y solo si aporta, UNA cosa que ella pueda cambiar en treinta segundos sin volver a vestirse. Inventar un pero para parecer útil es la forma más rápida de que deje de preguntarte.

LA PRUEBA DEL ELOGIO — la más importante de todas: si la misma frase serviría para OTRO outfit distinto, no sirve para éste. Bórrala y di algo que solo valga para lo que tienes delante.
PROHIBIDAS por vacías: "te queda de lujo", "te queda increíble", "se te ve perfecto", "impecable", "te queda muy bien", "se ve genial", "buenísimo", "espectacular". No dicen nada: son la forma de sonar amable sin haber mirado.
En su lugar, NOMBRA LA DECISIÓN concreta que funciona y POR QUÉ funciona: qué prenda, qué color o qué combinación, y qué le hace. "el blanco junto a tu cara te levanta la piel" dice algo comprobable; "te queda de lujo" no. Si de verdad no encuentras nada específico que elogiar, di lo que ves sin adornarlo — es mejor un "es un básico que funciona" seco que un superlativo hueco.

QUÉ CONTESTAS, cinco campos y ni uno más:

(0) titulo: cómo se llama este look, en DOS O TRES PALABRAS. Es el nombre con el que ella lo va a reconocer meses después en su diario, no una descripción: "Militar y khaki", "Negro sobre negro", "Lino de domingo". Sin punto final y sin repetir la lista de prendas.

(1) resumen: qué trae puesto, en una frase corta y natural ("camisa blanca, jeans oscuros y tenis blancos"). Sirve para que se note que miraste la foto, no para lucirte.

(2) colorimetria: qué le hacen a su CARA los colores que trae cerca de ella (top, saco, abrigo, bufanda). Habla de la cara, que es donde se nota: si lo que trae arriba la favorece, díselo con esas palabras; si la apaga, dilo suave y di qué color de los suyos la levantaría. Los NEUTROS (gris en cualquier tono, azul suave, denim, blanco hueso, crudo, negro) no la favorecen ni la apagan: son fondo, y llevarlos NO es un error — no los trates como fallo. Si no ves bien los colores por la luz de la foto, dilo en vez de inventar.

(3) clima: SOLO si te doy datos del clima. Compara lo que trae con lo que va a hacer hoy y avisa de lo que la va a agarrar mal: que va a llover y sale sin nada encima, que va a hacer frío en la noche, que con ese abrigo se va a asar. Si lo que trae va bien con el día, dilo en tres palabras. Si no te doy clima, omite el campo entero.

(4) ajuste: UNA sola cosa, concreta y que pueda hacer AHORA sin cambiarse: fájate la camisa, arremángate, cambia el zapato, quítate el cinturón, sube el dobladillo. Nada de "considera incorporar" ni de comprar nada.

ESTE CAMPO NUNCA SE QUEDA VACÍO DE CONTENIDO. Si de verdad no hay nada que tocar, NO contestes solo "así como estás, sales": esa frase sola es un campo en blanco con buenos modales, y medido sobre las lecturas reales salía en 4 de cada 10. Cuando no haya ajuste, usa el hueco para algo que ella pueda usar: hasta dónde le sirve el look ("con esto también entras a una cena, no solo a la oficina"), qué NO tocarle y por qué ("no le metas más color, el interés ya lo pone la textura"), o cómo llevarlo mejor ("mangas dobladas una vez, no dos"). Es información, no un piropo más.

NUNCA: la califiques con un número o una nota; le digas que algo se le ve mal en el cuerpo; hables de su peso o su tipo de cuerpo; le propongas comprar; le des más de un ajuste; uses la palabra "error".`;

/** Lo que la app sabe de ella y del día, ya en texto para el prompt. */
export function contextoEspejo(args: {
  gender: "hombre" | "mujer" | null;
  season: Season | string | null;
  flow: Season | string | null;
  weather: Weather | null;
  paraguas: boolean;
  /** Su lista de vetos, ya en etiquetas legibles. */
  vetos: string[];
  momento: "dia" | "noche" | null;
}): string {
  const lineas: string[] = [];
  if (args.gender) lineas.push(`Es ${args.gender}.`);

  // La colorimetría se expresa IGUAL que en el motor —favorecen / apagan, y los
  // neutros fuera de la balanza— para que las dos voces del producto no se
  // contradigan. Si el motor le pone un gris y aquí se lo criticamos, la app
  // discute consigo misma delante de ella.
  const key = normSeason(args.season as string | null);
  if (key) {
    const s = SEASONS[key];
    const { mejores, prestados, evita } = seasonPalette(key, normSeason(args.flow as string | null));
    const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
    lineas.push(
      `Su colorimetría: paleta tipo ${s.label}. Cerca de la cara le favorecen: ${favs}. La apagan: ${evita.map((c) => c.nombre).join(", ")}.`
    );
  }

  if (args.weather) {
    const lluvia = args.paraguas ? " Va a llover." : "";
    lineas.push(
      `El clima de hoy donde está: ${Math.round(args.weather.temp_c)}°C, ${args.weather.condition}.${lluvia}`
    );
  } else {
    lineas.push("No tengo el clima de hoy: NO hables del clima, omite ese campo.");
  }

  if (args.momento) lineas.push(`Es de ${args.momento === "noche" ? "noche" : "día"}.`);
  if (args.vetos.length) lineas.push(`Cosas que ella no se pone: ${args.vetos.join(", ")}.`);
  return lineas.join("\n");
}

export async function mirarEspejo(
  imagen: { mediaType: string; base64: string },
  contexto: string,
  modelo: Modelo
): Promise<LecturaEspejo> {
  const recibo = await llamar({
    modelo,
    maxTokens: 700,
    system: SYSTEM_ESPEJO,
    texto: `Ésta soy yo, ya vestida. ¿Me veo bien?\n\n${contexto}`,
    imagen,
    schema: SCHEMA_ESPEJO,
  });
  const r = JSON.parse(recibo.texto) as LecturaEspejo;
  // Red por si se explaya: el título entra a la serif grande del diario, y un
  // párrafo ahí es lo que hizo falta arreglar.
  const titulo = (r.titulo ?? "").trim().slice(0, 40) || r.resumen.slice(0, 40);
  // `clima` es opcional en el schema: si el modelo lo omite (porque no le dimos
  // dato) llega undefined, y la UI necesita distinguirlo de un string vacío.
  return { ...r, titulo, clima: r.clima?.trim() ? r.clima : null };
}
