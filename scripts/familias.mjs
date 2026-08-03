// Las 10 familias generables — la fuente de verdad de la taxonomía v2.
//
// POR QUÉ 10 Y NO LAS 9 DE ANTES
// La taxonomía v1 mezclaba tres tipos de cosa como si fueran lo mismo: familias
// reales (sastre), paletas (tonos-tierra) y cualidades (casual-effortless). La
// auditoría de 2026-08-03 lo midió: de 362 fotos de invierno, tonos-tierra se
// llevó 52 y sastre 1 — el color le ganaba la casilla a la construcción. Y
// además el conjunto salía de lo que se cosechó primero, no del espacio real:
// 15 de las 25 cartas del deck (streetwear, gorpcore, hipster, utility...) no
// tenían NI UNA referencia.
//
// Estas familias se derivan del DECK —que sí fue diseñado para cubrir el
// espacio de gustos— agrupando sus cartas por vocabulario de prendas. Una
// familia es generable: nombra prendas, no cualidades ni colores. El color y el
// clima son DIMENSIONES aparte (columnas paleta y clima en referencias).
//
// La usan el clasificador de cosecha y el re-clasificador de la base; compartir
// las descripciones evita que una misma foto cuente como de una familia en un
// script y de otra en el siguiente.

export const FAMILIAS = {
  sastre: {
    nombre: "Sastre",
    cartas: ["sastre", "glam-noche"],
    descripcion:
      "Sastrería como protagonista: traje completo o saco estructurado con pantalón de vestir. Construcción visible, corbata opcional.",
  },
  "clasico-arreglado": {
    nombre: "Clásico arreglado",
    cartas: ["clasico-elegante", "smart-casual", "academia"],
    descripcion:
      "Arreglado sin sastrería completa: camisa, polo o suéter fino con pantalón de tela o jeans limpios. Mocasines o zapato limpio. Nunca traje completo, nunca deportivo.",
  },
  "casual-limpio": {
    nombre: "Casual limpio",
    cartas: ["minimalista", "casual-effortless", "coreano", "monocromatico"],
    descripcion:
      "Prendas simples sin ornamento: camiseta o tejido liso, pantalón limpio, tenis blancos o minimalistas. Paleta contenida, cero logos, silueta de recta a holgada controlada.",
  },
  preppy: {
    nombre: "Preppy",
    cartas: ["preppy", "nautico"],
    descripcion:
      "Campus americano y náutica: polo, rugby, camisa oxford, chinos, náuticos o mocasines. Rayas, escudos, suéter al hombro.",
  },
  edgy: {
    nombre: "Edgy",
    cartas: ["edgy", "grunge"],
    descripcion:
      "Registro oscuro con filo: negro dominante, cuero, botas, mezclilla rota o siluetas duras. Incluye lo grunge noventero desaliñado a propósito.",
  },
  "street-urbano": {
    nombre: "Street urbano",
    cartas: ["streetwear", "y2k"],
    descripcion:
      "Streetwear: oversized, hoodies y camisetas gráficas, sneakers voluminosos, baggy. Incluye el registro Y2K dosmilero. Los logos y gráficos son parte del lenguaje, no un defecto.",
  },
  deportivo: {
    nombre: "Deportivo",
    cartas: ["athleisure", "gorpcore"],
    descripcion:
      "Ropa técnica y de rendimiento usada en la calle: athleisure (pants, sudadera técnica, tenis de correr) y gorpcore (impermeables de montaña, softshell, trail).",
  },
  utilitario: {
    nombre: "Utilitario",
    cartas: ["utility"],
    descripcion:
      "Workwear y utility: cargo, chamarras de trabajo (chore coat), denim crudo, botas de trabajo, bolsillos funcionales, lona y materiales rudos.",
  },
  "thrift-vintage": {
    nombre: "Thrift / vintage",
    cartas: ["hipster", "vintage"],
    descripcion:
      "Ropa con pasado o que lo evoca: pana, tejidos de abuelo, camisas retro, mezclas de época encontradas en thrift. Se ve elegido de segunda mano con ojo, no disfraz de época.",
  },
  "resort-boho": {
    nombre: "Resort / boho",
    cartas: ["coastal", "boho"],
    descripcion:
      "Lino, blancos y texturas sueltas de playa o de espíritu libre: camisa de lino abierta, pantalón fluido, sandalias o alpargatas, collares o texturas artesanales en el caso boho.",
  },
};

/** Mapeo de los estilos v1 que se renombran o fusionan. */
export const RENOMBRES_V1 = {
  "smart-casual": "clasico-arreglado",
  "clasico-elegante": "clasico-arreglado",
  minimalista: "casual-limpio",
  "casual-effortless": "casual-limpio",
  // sastre, preppy y edgy conservan su nombre.
  // tonos-tierra y color-protagonista NO se renombran: se disuelven — cada foto
  // se re-clasifica por visión a la familia que de verdad le toca.
};
