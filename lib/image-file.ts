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

  // heic2any decodifica en el hilo principal y lo bloquea varios segundos
  // (~5-15s en una foto de iPhone). Sin cederle un frame al navegador, el
  // estado de carga que el caller acaba de poner ("Guardando tu foto…") NO
  // alcanza a pintarse y la app se ve congelada/muerta — el usuario cree que
  // "no la agarró". Este respiro garantiza que la UI pinte antes del bloqueo.
  // OJO: rAF se CONGELA en pestañas en segundo plano (si el usuario cambia de
  // app a media subida), así que NO se puede esperar solo a rAF — colgaría la
  // conversión para siempre. setTimeout sí dispara estando oculta; corremos
  // ambos y seguimos con el que llegue primero.
  await new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    setTimeout(go, 60); // red de seguridad — dispara aunque la pestaña esté oculta
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(go)); // pinta rápido si está visible
    }
  });

  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}
