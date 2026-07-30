// Reduce una imagen al lado mayor `max` y la reencoda a JPEG. Solo navegador
// (usa Image + canvas). Compartido por todas las subidas (avatar, prendas).
export function comprimir(file: Blob, max = 1280, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > max) {
        height = (height * max) / width;
        width = max;
      } else if (height > max) {
        width = (width * max) / height;
        height = max;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(img.src);
          b ? resolve(b) : reject(new Error("no_blob"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("img_decode"));
    };
    img.src = URL.createObjectURL(file);
  });
}

// Igual, pero devuelve un dataURL — el formato que come /api/analizar-prenda.
// 1280px es el mismo tamaño del import del clóset: suficiente para que la IA lea
// la tela, sin reventar el payload con una foto de 12 MP.
export async function comprimirADataUrl(
  file: Blob,
  max = 1280,
  quality = 0.85
): Promise<string> {
  const blob = await comprimir(file, max, quality);
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read_failed"));
    fr.readAsDataURL(blob);
  });
}
