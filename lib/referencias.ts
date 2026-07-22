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
};

export const REFERENCIAS_PRECARGADAS: ReferenciaPreset[] = [
  {
    id: "carla",
    nombre: "Carla",
    desc: "statement y color: base limpia de neutros que remata con una pieza que habla",
    summary:
      "Base minimalista de neutros rematada con UNA pieza statement por look: un pop de color vivo, un print animal o un satén con caída. Siluetas relajadas con aire de resort — pantalones anchos de lino, tops al cuerpo, faldas midi al bies — y acentos que elevan: sandalia de tacón fino, dorados en capas. Editorial pero usable: un solo protagonista por look, el resto respira.",
    tags: ["statement sobre neutros", "aire resort", "midi al bies", "print como acento", "dorados"],
  },
  {
    id: "maria",
    nombre: "María",
    desc: "effortless y neutros: relajado, básicos bien puestos, cero esfuerzo aparente",
    summary:
      "Effortless de neutros: todo en fits relajados y baggy — jamás entallado — con la mezcla high-low como firma: una sudadera con pantalón sastre, un tank de costillas con blazer o trench, shorts de vestir con pieza especial. Una sola pieza protagonista por look (un accesorio con carácter o un twist en la prenda), el resto básicos impecables. Acentos western sutiles: cinturón con hebilla, bota vaquera.",
    tags: ["effortless", "fits relajados", "high-low con sastre", "básicos elevados", "western sutil"],
  },
];

export const referenciaPreset = (id: string): ReferenciaPreset | null =>
  REFERENCIAS_PRECARGADAS.find((r) => r.id === id) ?? null;
