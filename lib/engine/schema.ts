// JSON Schema para structured outputs del motor. Se construye POR USUARIA:
// los item_ids van como enum con los UUIDs reales de su clóset, así el modelo
// NO PUEDE inventar prendas (la falla #1 del alfa de Replit) — el API rechaza
// cualquier id fuera del enum antes de que nos llegue.

// Schema de UN solo outfit (para el juez que revisa de uno en uno y stremea).
export function buildSingleOutfitSchema(itemIds: string[]) {
  return {
    type: "object" as const,
    properties: {
      nombre: {
        type: "string",
        description: "Nombre corto y con personalidad para el look, en español.",
      },
      item_ids: {
        type: "array",
        description: "IDs de las prendas del clóset que componen el outfit (3 a 5).",
        items: { type: "string", enum: itemIds },
      },
      explicacion: {
        type: "string",
        description: "UNA línea: por qué este look le favorece, en voz de amiga cool.",
      },
    },
    required: ["nombre", "item_ids", "explicacion"],
    additionalProperties: false,
  };
}

// Schema del JUEZ: el look final + un veredicto explícito (ok / reparado /
// rechazado) y la razón. El veredicto deja al juez señalar "esto está mal y
// no se puede arreglar con este clóset" sin tener que inventar una reparación.
export function buildCriticSchema(itemIds: string[]) {
  return {
    type: "object" as const,
    properties: {
      veredicto: {
        type: "string",
        enum: ["ok", "reparado", "rechazado"],
        description:
          "ok = estaba bien armado, lo dejas igual. reparado = intercambiaste una prenda para mejorarlo. rechazado = está mal y NO se puede arreglar con este clóset.",
      },
      razon: {
        type: "string",
        description:
          "Una línea: si reparaste, qué cambiaste y por qué; si rechazaste, por qué es irreparable con este clóset. Cadena vacía si es ok.",
      },
      nombre: {
        type: "string",
        description: "Nombre corto y con personalidad para el look, en español.",
      },
      item_ids: {
        type: "array",
        description: "IDs de las prendas del clóset que componen el outfit (3 a 5).",
        items: { type: "string", enum: itemIds },
      },
      explicacion: {
        type: "string",
        description: "UNA línea: por qué este look le favorece, en voz de amiga cool.",
      },
      tip: {
        type: "string",
        description:
          "El toque (cómo llevarlo): UN movimiento de styling concreto para llevar ESTE look mejor, o cadena vacía si el look ya está completo y no hay un toque que de verdad lo eleve. Ver reglas del sistema.",
      },
    },
    required: ["veredicto", "razon", "nombre", "item_ids", "explicacion", "tip"],
    additionalProperties: false,
  };
}

export function buildOutfitSchema(itemIds: string[]) {
  return {
    type: "object" as const,
    properties: {
      // PRIMERO en el schema a propósito: el modelo lo genera antes que los
      // outfits, así que funciona como espacio de razonamiento (borrador).
      // El caller lo ignora al parsear; nunca se muestra.
      analisis: {
        type: "string",
        description:
          "Tu borrador de trabajo (la clienta NO lo ve; 3-6 líneas, MÁXIMO 6 — cada token de más retrasa el look): neutros y colores fuertes del clóset, qué mandan clima/ocasión, qué descartas (colorimetría, vetos, estampados que pelean) y las combinaciones más fuertes que ves. Piensa aquí ANTES de armar los outfits. Y CIERRA con una línea por look nombrando su decisión de stylist en pocas palabras (\"decisión: punto grueso contra sastre\", \"decisión: el vino remata sobre gris\"); si al escribirla te sale \"ninguna\" o algo que cualquiera habría hecho sin pensar, ese look todavía no está — cámbialo antes de entregarlo.",
      },
      outfits: {
        type: "array",
        description: "Exactamente 2 o 3 outfits.",
        items: {
          type: "object",
          properties: {
            nombre: {
              type: "string",
              description:
                "Nombre corto y con personalidad para el look, en español.",
            },
            item_ids: {
              type: "array",
              description:
                "IDs de las prendas del clóset que componen el outfit (3 a 5).",
              items: { type: "string", enum: itemIds },
            },
            explicacion: {
              type: "string",
              description:
                "UNA línea: por qué este look le favorece, en voz de amiga cool.",
            },
          },
          required: ["nombre", "item_ids", "explicacion"],
          additionalProperties: false,
        },
      },
    },
    required: ["analisis", "outfits"],
    additionalProperties: false,
  };
}
