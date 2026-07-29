// Referencias de estilo PRECARGADAS: estilos de stylists reales curados a mano,
// aplicables con un tap desde la card de "estilo de referencia" (la alternativa
// sin fricción a subir fotos). El summary+tags entra al motor por el MISMO
// camino que una referencia analizada por visión (styleReferenceForEngine):
// inspira vibe y siluetas, la colorimetría de la usuaria sigue mandando el color.
//
// Fuentes de verdad (docs_para_claude/outfit-inspo/):
//   CFZ/carla-guardarropa.md · MZ-2/maria-guardarropa.md
// En UI solo nombre de pila (sin apellidos ni fotos de las personas).
export type ReferenciaPreset = {
  id: string;
  nombre: string;
  /** Una línea para el picker (voz amiga cool). */
  desc: string;
  /** Para el motor — vibe y siluetas, NO colores (la paleta la pone la usuaria). */
  summary: string;
  tags: string[];
  /**
   * Flat-lays de SU guardarropa (rutas públicas de /archetypes). Sin esto el
   * preset NO se ofrece: un nombre y un párrafo le piden a alguien adoptar un
   * estilo que no puede ver, y eso fue exactamente por lo que se apagó la
   * sección (Roberto, 2026-07-28). Estas piezas ya existen en la biblioteca —
   * son las que se sembraron de su guardarropa real.
   */
  imagenes?: string[];
  /**
   * A quién se le ofrece. Un guardarropa real es de una persona concreta: el de
   * Carla son faldas al bies, mules y tops al cuerpo — ofrecérselo a un hombre
   * es ofrecerle ropa que no se va a poner (Roberto lo vio en su propio perfil,
   * 2026-07-28). Sin `segmento` el preset es para todos.
   */
  segmento?: "hombre" | "mujer";
};

export const REFERENCIAS_PRECARGADAS: ReferenciaPreset[] = [
  {
    id: "carla",
    nombre: "Carla",
    desc: "statement y color: base limpia de neutros que remata con una pieza que habla",
    segmento: "mujer",
    summary:
      "Base minimalista de neutros rematada con UNA pieza statement por look: un pop de color vivo, un print animal o un satén con caída. Siluetas relajadas con aire de resort — pantalones anchos de lino, tops al cuerpo, faldas midi al bies — y acentos que elevan: sandalia de tacón fino, dorados en capas. Editorial pero usable: un solo protagonista por look, el resto respira.",
    tags: ["statement sobre neutros", "aire resort", "midi al bies", "print como acento", "dorados"],
    // Cuatro piezas que cuentan su gramática de un vistazo: el statement de
    // color, la base neutra relajada, el print como acento y el zapato que
    // eleva. Salen de las 47 prendas suyas ya sembradas (migración 0069).
    imagenes: [
      "/archetypes/cf-falda-satin-mostaza.png",
      "/archetypes/cf-pantalon-lino-blanco.png",
      "/archetypes/cf-jeans-leopardo.png",
      "/archetypes/cf-mules-negras.png",
    ],
  },
  {
    id: "maria",
    nombre: "María",
    desc: "effortless y neutros: relajado, básicos bien puestos, cero esfuerzo aparente",
    segmento: "mujer",
    summary:
      "Effortless de neutros: todo en fits relajados y baggy — jamás entallado — con la mezcla high-low como firma: una sudadera con pantalón sastre, un tank de costillas con blazer o trench, shorts de vestir con pieza especial. Una sola pieza protagonista por look (un accesorio con carácter o un twist en la prenda), el resto básicos impecables. Acentos western sutiles: cinturón con hebilla, bota vaquera.",
    tags: ["effortless", "fits relajados", "high-low con sastre", "básicos elevados", "western sutil"],
    // SIN imágenes a propósito: su guardarropa aún no se siembra en la
    // biblioteca, así que no hay flat-lays suyos. Mientras no los tenga, no se
    // ofrece — es la misma regla que le aplicamos a todos.
  },
];

export const referenciaPreset = (id: string): ReferenciaPreset | null =>
  REFERENCIAS_PRECARGADAS.find((r) => r.id === id) ?? null;

/**
 * Los presets que se le ofrecen a alguien. Dos filtros, los dos por la misma
 * razón —no pedir que adoptes un estilo que no puedes juzgar o no puedes usar—:
 * tiene que traer imágenes de su guardarropa Y ser de tu segmento.
 *
 * Hoy los dos presets son de mujer, así que a un hombre no se le ofrece ninguno
 * y la sección entera desaparece. Es correcto: sembrar un guardarropa de hombre
 * es el trabajo pendiente, no mostrarle el de una mujer mientras tanto.
 */
export function presetsPara(
  gender: "hombre" | "mujer" | null
): ReferenciaPreset[] {
  return REFERENCIAS_PRECARGADAS.filter(
    (r) =>
      (r.imagenes?.length ?? 0) > 0 && (!r.segmento || r.segmento === gender)
  );
}
