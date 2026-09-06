// LA PUERTA DE LAS FOTOS QUE ENTRAN.
//
// POR QUÉ EXISTE
// Ocho rutas recibían la foto igual: una data-URL, un regex `image/\w+`, y
// derecho al modelo. Eso aceptaba `image/svg+xml`, aceptaba 4 MB de basura, y
// —lo importante— confiaba en el tipo que DECLARA el cliente sin mirar nunca
// los bytes. En `estilo-referencia` ese tipo declarado se guardaba tal cual en
// el bucket, así que un archivo podía quedar almacenado diciendo ser algo que
// no era.
//
// LOS BYTES MANDAN, NO LA ETIQUETA. Un JPEG empieza por /9j/, un PNG por iVBOR
// y un WebP por UklGR (en base64). Si la etiqueta y los bytes no coinciden,
// gana lo que los bytes dicen: la etiqueta la escribe quien manda la petición y
// los bytes hay que fabricarlos.
//
// EL TOPE ES EL MISMO QUE EL DEL BUCKET (3 MB, migración 0151) a propósito: si
// aquí pasara algo que allá se rechaza, el fallo aparecería tarde y como un
// error de Storage sin explicación.

/** 3 MB ya decodificados. Una foto comprimida por la app ronda 150-400 KB. */
export const MAX_BYTES = 3 * 1024 * 1024;

export type MediaTypeImagen = "image/jpeg" | "image/png" | "image/webp";

export type MotivoRechazo = "falta" | "formato" | "tipo" | "grande";

export type ImagenEntrante =
  | { ok: true; mediaType: MediaTypeImagen; b64: string; bytes: number }
  | { ok: false; motivo: MotivoRechazo };

/**
 * Qué es de verdad, según sus primeros bytes. null si no es ninguno de los
 * tres que el producto admite.
 *
 * Se mira el base64 directamente (sin decodificar) porque el prefijo es estable
 * y así no se paga decodificar 3 MB para descubrir que era un PDF.
 */
export function tipoRealDe(b64: string): MediaTypeImagen | null {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  return null;
}

/** Cuántos bytes ocupa un base64 ya decodificado, sin decodificarlo. */
export function bytesDeBase64(b64: string): number {
  const relleno = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - relleno;
}

/**
 * Lee la data-URL que mandó el cliente y decide si se le puede dar de comer a
 * un modelo. Devuelve el tipo REAL, no el declarado.
 */
export function leerImagenEntrante(dataUrl: string | undefined | null): ImagenEntrante {
  if (!dataUrl) return { ok: false, motivo: "falta" };
  const m = dataUrl.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
  if (!m) return { ok: false, motivo: "formato" };
  const b64 = m[2];
  const bytes = bytesDeBase64(b64);
  // El tamaño se mira ANTES que el tipo: si alguien manda 50 MB, la respuesta
  // útil es "pesa demasiado", no "no reconozco el formato".
  if (bytes > MAX_BYTES) return { ok: false, motivo: "grande" };
  const mediaType = tipoRealDe(b64);
  if (!mediaType) return { ok: false, motivo: "tipo" };
  return { ok: true, mediaType, b64, bytes };
}

/** Lo que se le dice a la persona. Nunca "error 400". */
export const MOTIVO_IMAGEN: Record<MotivoRechazo, string> = {
  falta: "no me llegó la foto — inténtalo de nuevo.",
  formato: "esa foto no la pude leer. prueba con otra.",
  tipo: "necesito una foto de verdad (JPG, PNG o WebP).",
  grande: "esa foto pesa demasiado. tómala de nuevo o elige otra.",
};
