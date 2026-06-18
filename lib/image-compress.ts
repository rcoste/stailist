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
