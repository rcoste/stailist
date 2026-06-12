// JSON Schema para structured outputs del motor. Se construye POR USUARIA:
// los item_ids van como enum con los UUIDs reales de su clóset, así el modelo
// NO PUEDE inventar prendas (la falla #1 del alfa de Replit) — el API rechaza
// cualquier id fuera del enum antes de que nos llegue.

export function buildOutfitSchema(itemIds: string[]) {
  return {
    type: "object" as const,
    properties: {
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
    required: ["outfits"],
    additionalProperties: false,
  };
}
