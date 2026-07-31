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
};

/** Los motivos de rechazo, en orden de qué tan seguido pasan. */
export const MOTIVOS = [
  { id: "no-es-el-estilo", label: "no es de este estilo" },
  { id: "fit-malo", label: "el fit está mal" },
  { id: "aburrido", label: "correcto pero soso" },
  { id: "no-es-outfit", label: "no es foto de outfit" },
] as const;
