// Normaliza una foto recién elegida a un formato que TODO el mundo entiende.
// Las fotos de iPhone vienen en HEIC/HEIF, que ni los navegadores no-WebKit ni
// la API de visión de Claude pueden decodificar → las convertimos a JPEG en el
// navegador. Cualquier otro formato pasa intacto. heic2any se carga SOLO cuando
// de verdad hay un HEIC (dynamic import), para no inflar el bundle.
export async function toUsableImage(file: File): Promise<Blob> {
  // HEIC a menudo llega con file.type vacío → también revisamos la extensión.
  const isHeic =
    /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;

  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}
