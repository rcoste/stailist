// Tipos y constantes del destilador — SIN dependencias de servidor.
//
// Vive aparte de lib/destilador.ts a propósito: ese módulo usa el cliente de
// Supabase de servidor, y el componente de pantalla necesita estos tipos.
// Importar uno solo trae el otro completo y el bundle del navegador revienta.
// Ni `tsc` ni eslint lo ven — solo aparece al abrir la página.

export type Referencia = {
  id: string;
  path: string;
  /** Firmada, 1h. null si la firma falló — la pantalla lo muestra en vez de romperse. */
  url: string | null;
  /** null = pendiente; true = buena referencia del estilo; false = no sirve */
  sirve: boolean | null;
  motivo: string | null;
  /** "Así me vestiría yo": gusto personal, SEPARADO de si sirve para el estilo. */
  mio: boolean;
  nota: string | null;
};

export type Juicio = {
  sirve?: boolean | null;
  motivo?: string | null;
  mio?: boolean;
  nota?: string | null;
  revision?: string | null;
};

/**
 * Las salidas de la segunda pasada, sobre las fotos donde el humano y la
 * taxonomía discreparon.
 *
 * `destila` es la razón de existir de todo esto: "es del estilo pero no es lo
 * mío" tiene que volver a la destilación. Filtrar el estilo por el gusto de una
 * persona produce su guardarropa, no el estilo — y eso solo le sirve a ella.
 */
export const REVISIONES = [
  {
    id: "no-es-lo-mio",
    label: "Es del estilo, pero no es lo mío",
    pista: "Cuenta para el estilo, no para tu gusto",
    destila: true,
  },
  {
    id: "mal-ejecutada",
    label: "Está mal puesto",
    pista: "El estilo sí, la ejecución no",
    destila: false,
  },
  {
    id: "no-es-del-estilo",
    label: "De verdad no es de este estilo",
    pista: "Aquí el juez se equivocó",
    destila: false,
  },
] as const;

export type Discrepancia = Referencia & {
  /** Qué vio el juez de taxonomía — le da contexto a la re-decisión. */
  observado: string | null;
  ejecucion: number;
};

/**
 * Estilos cuya destilación YA pasó la prueba visual: se generaron outfits
 * usando solo el texto del recetario y se compararon contra las fotos de origen.
 *
 * Vive en código y se actualiza a mano a propósito — es un juicio humano sobre
 * imágenes, no algo que la base pueda saber. Sin esto, la única forma de saber
 * qué estilo ya está cerrado era acordarse, y eso no es un estado del sistema.
 */
export const VALIDADOS = new Set(["clasico-elegante", "minimalista"]);

/** Los motivos de rechazo, en orden de qué tan seguido pasan. */
export const MOTIVOS = [
  { id: "no-es-el-estilo", label: "no es de este estilo" },
  { id: "fit-malo", label: "el fit está mal" },
  { id: "aburrido", label: "correcto pero soso" },
  { id: "no-es-outfit", label: "no es foto de outfit" },
] as const;
