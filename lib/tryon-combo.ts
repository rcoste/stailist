import { createHash } from "node:crypto";

/**
 * La llave de una combinación probada: qué prendas, sobre qué avatar.
 *
 * Vive aquí y no en la ruta porque un route handler de Next sólo puede exportar
 * handlers y config — y esto es lógica pura que merece test propio: es lo único
 * que separa "cachear" de "servir la imagen equivocada".
 *
 * ORDENADA, porque elegir los zapatos y luego el pantalón es la misma
 * combinación que al revés. Sin ordenar, cada permutación pagaría su propia
 * generación de imagen: con 4 prendas son 24 llaves para un solo look.
 *
 * CON PREFIJO POR ORIGEN (`w:` deseo, `c:` clóset) para que la intención quede
 * escrita y no deducida. Son tablas distintas con uuids independientes.
 *
 * Y CON EL AVATAR DENTRO, que es lo que la vuelve un caché CORRECTO y no sólo un
 * caché. La imagen lleva tu cara: si te regeneras el avatar, la llave cambia
 * sola y la combinación se vuelve a dibujar con la cara nueva. Sin eso, un
 * caché te enseñaría tu cara vieja para siempre — que es el defecto que hoy
 * tiene el try-on de una sola prenda, que cachea en `wishlist_items.tryon_path`
 * sin mirar de qué avatar salió.
 */
export function llaveDeCombo(
  avatarPath: string,
  wishlistIds: string[],
  itemIds: string[]
): string {
  const partes = [
    `a:${avatarPath}`,
    ...[...wishlistIds].sort().map((id) => `w:${id}`),
    ...[...itemIds].sort().map((id) => `c:${id}`),
  ].join("|");
  // 32 hex = 128 bits. De sobra para que dos combinaciones distintas nunca
  // choquen, y corto para que la ruta del archivo se lea.
  return createHash("sha256").update(partes).digest("hex").slice(0, 32);
}
