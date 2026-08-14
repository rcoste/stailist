import type { Formalidad } from "@/lib/formalidad";

// PERFILES DE OCASIÓN — para lo que la persona ESCRIBE, no para lo que elige.
//
// EL CASO QUE LO PIDIÓ (Roberto, 2026-08-14): "me voy el fin de semana a un
// viñedo con mis amigos" y el look que salió fue polo, lino y mocasines de
// suela lisa. Country club, no viñedo. Y no fue culpa del modelo.
//
// LO QUE PASABA: el campo libre del wizard manda `objective: "diario"`. Un fin
// de semana en el campo le llegaba al motor como UN DÍA NORMAL en el que además
// se mencionó un viñedo, con una sola línea de andamiaje:
//
//     Tiene en mente: "Ida a viñedos con mis amigos" — afina el look a ese plan.
//
// Mientras tanto, elegir un chip ("una boda") traía piso de formalidad, el
// perfil de la ocasión —dónde te sientas, cuánto caminas, si hay fotos— y hasta
// el contexto mexicano del prompt. El texto libre era ciudadano de segunda.
//
// Y AHÍ ES DONDE APARECEN LAS NECESIDADES NO CUBIERTAS: en toda la historia del
// producto el campo libre se usó tres veces, y las tres son casos que la rejilla
// de chips no tiene — dos viñedos y un día de gym. Los 8 chips son todos
// urbanos y sociales (comida, cena, cita, fiesta, boda...). Cero campo, cero
// playa, cero ejercicio.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA REGLA DE ORO DE ESTE ARCHIVO: SE DESCRIBE LA SITUACIÓN, NO EL ATUENDO.
//
// "Se camina sobre tierra y grava, hay sol directo y refresca al atardecer" es
// un HECHO del lugar. "Ponte guayabera y sombrero de palma" es MI estereotipo de
// San Miguel de Allende, y en este proyecto ya escribí tres veces reglas de
// vestimenta con un default equivocado metido de contrabando. Los hechos los
// puedo verificar; mi idea de cómo se viste alguien en un viñedo, no.
//
// Además funciona mejor: de "suela lisa sobre grava" el motor deduce solo que
// los mocasines no van, y lo hace CON EL CLÓSET Y EL GUSTO de esa persona
// delante, que es información que este archivo no tiene.
// ─────────────────────────────────────────────────────────────────────────────
//
// NO ES UN CHIP NUEVO. La rejilla no crece: esto se infiere de lo que la persona
// ya escribió.
//
// NO SUSTITUYE a `PLANES_ESCRITOS` de lib/eventos.ts, aunque se parezcan: aquel
// PROMUEVE el texto a un tipo de evento del catálogo (escribir "un funeral" te
// deja igual que si hubieras elegido el chip, con su formalidad y su regla del
// color). Esto de aquí es para lo que NO tiene chip ni lo va a tener, y por eso
// sólo corre cuando no hay uno elegido.

export type PerfilOcasion = {
  key: string;
  /** Para leer un log o un test y saber de qué se habla. */
  label: string;
  /**
   * Cómo lo escribe la gente. Se prueba contra el texto SIN acentos y en
   * minúsculas (ver `reconocerOcasion`), así que aquí van sin acentos.
   */
  palabras: RegExp;
  /**
   * Piso de formalidad SOLO si la ocasión de verdad lo impone y el vocabulario
   * que ya existe lo describe bien. `null` es la respuesta correcta casi
   * siempre: inventarle un piso a "día de campo" sería empujar al motor con una
   * escala (casual→gala) que no es el eje del problema ahí. El eje es el
   * terreno, y eso lo carga `situacion`.
   */
  formalidadPiso: Formalidad | null;
  /** LA SITUACIÓN. Hechos del lugar, nunca prendas. */
  situacion: string;
};

export const PERFILES_OCASION: PerfilOcasion[] = [
  {
    key: "campo",
    label: "día de campo (viñedo, rancho, hacienda)",
    // "bodega" NO entra: en México es casi siempre un almacén, no una vinícola.
    palabras:
      /\b(vinedos?|vinicola|rancho|hacienda|finca|dia de campo|en el campo|al campo)\b/,
    formalidadPiso: null,
    situacion:
      "un día de campo (viñedo, rancho o hacienda): se está AFUERA casi todo el tiempo y se camina sobre tierra, grava o pasto — la suela lisa de ciudad se resbala y se ensucia, y el calzado que no puede pisar tierra delata que no entendiste a dónde ibas. Sol directo buena parte del día y baja la temperatura al caer la tarde, así que hace falta algo que abrigue y se pueda quitar sin cargarlo. Se está de pie, se camina y se come al aire libre; hay fotos. El registro es relajado pero cuidado: ni el look de estar en casa ni el de una comida de ciudad",
  },
  {
    key: "naturaleza",
    label: "caminata o naturaleza",
    palabras:
      /\b(senderismo|hiking|caminata|excursion|montana|cerro|bosque|cascada|acampar|camping)\b/,
    formalidadPiso: null,
    situacion:
      "una caminata en naturaleza: el terreno es irregular y se camina mucho, así que el calzado manda sobre todo lo demás y la ropa tiene que dejar moverse. Cambia la temperatura entre el sol y la sombra y entre la mañana y la tarde — se resuelve por capas, no con una prenda gruesa. Lo que se ensucia se ensucia; aquí la ropa delicada es un error",
  },
  {
    key: "playa",
    label: "playa o alberca",
    palabras: /\b(playa|alberca|piscina|mar|costa|caribe|snorkel)\b/,
    // Aquí SÍ hay piso, y no lo invento: "playa" ya es un nivel de
    // lib/formalidad.ts, con su regla ya medida en el prompt (la corrida de la
    // boda de playa que devolvió blazer marino y zapato de suela para la arena).
    formalidadPiso: "playa",
    situacion:
      "playa o alberca: hay sol directo, arena o piso mojado y calor húmedo. La ropa se moja y se llena de arena, así que el material importa más que el corte. Aquí el error caro es arreglarse de más, no de menos",
  },
  {
    key: "ejercicio",
    label: "ejercicio",
    palabras:
      /\b(gym|gimnasio|ejercicio|entrenar|entrenamiento|correr|running|pesas|yoga|crossfit|spinning|futbol|padel|tenis)\b/,
    formalidadPiso: null,
    situacion:
      "ejercicio: se suda y hay que poder moverse en todos los ejes. Manda el material (que respire y seque) y el calzado correcto para lo que se va a hacer. La ropa de calle aquí no sirve, por bonita que sea",
  },
];

/**
 * ¿Lo que escribió nombra una de estas situaciones?
 *
 * Es determinista y gratis a propósito: la comparación por palabras cubre los
 * casos que ya sabemos nombrar, sin una llamada de IA, sin latencia y —lo que
 * importa aquí— con tests que fijan el comportamiento. Lo que NO reconozca sigue
 * viajando como texto libre tal cual, que es la promesa del campo: nada se
 * bloquea, nada se reescribe. Sólo se le suma andamiaje cuando lo hay.
 */
export function reconocerOcasion(texto: string | null | undefined): PerfilOcasion | null {
  if (!texto?.trim()) return null;
  const t = texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return PERFILES_OCASION.find((p) => p.palabras.test(t)) ?? null;
}
