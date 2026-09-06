import { withDb } from "@/lib/db";

// CUÁNTOS CÓDIGOS DE LOGIN SE PUEDEN PEDIR.
//
// Existe desde la apertura al público (B5). Antes el único freno era un
// cooldown de 60 s pintado en el botón "reenviar": el servidor mandaba un
// correo por cada petición que le llegara. Con registro abierto, eso es una
// máquina de spam apuntando a terceros desde stailist.co.
//
// LOS NÚMEROS: una persona real pide un código, a veces dos si no le llegó, y
// muy rara vez tres (se equivocó de correo). Diez por IP y hora cubre una
// oficina o una familia detrás del mismo router. Quien pase de ahí no es una
// persona que no puede entrar; es un bucle.
//
// EL MENSAJE al topar no dice "bloqueado": dice dónde buscar el código que ya
// se mandó, porque ése es el caso real cuando alguien pide el tercero.

export const TOPE_POR_CORREO_HORA = 3;
export const TOPE_POR_IP_HORA = 10;

export const MENSAJE_RITMO =
  "ya te mandé varios códigos — revisa tu correo (y el spam). si de plano no llega, inténtalo en un rato.";

/** Decisión pura, para poder probar los bordes sin base. */
export function permitirCodigo(m: { porCorreo: number; porIp: number }): boolean {
  return m.porCorreo < TOPE_POR_CORREO_HORA && m.porIp < TOPE_POR_IP_HORA;
}

/** La IP que Vercel pone en la cabecera; null si no hay (local). */
export function ipDe(headers: { get(k: string): string | null }): string | null {
  const xff = headers.get("x-forwarded-for");
  const primera = xff?.split(",")[0]?.trim();
  return primera || headers.get("x-real-ip") || null;
}

/** Cuenta la última hora. Falla ABIERTO: si la tabla no responde, se deja pasar. */
export async function intentosUltimaHora(
  correo: string,
  ip: string | null
): Promise<{ porCorreo: number; porIp: number }> {
  try {
    return await withDb(async (c) => {
      const r = await c.query<{ por_correo: string; por_ip: string }>(
        `select
           count(*) filter (where correo = $1) as por_correo,
           count(*) filter (where $2::text is not null and ip = $2) as por_ip
         from login_intentos
         where created_at >= now() - interval '1 hour'
           and (correo = $1 or ip = $2)`,
        [correo, ip]
      );
      return { porCorreo: Number(r.rows[0]?.por_correo ?? 0), porIp: Number(r.rows[0]?.por_ip ?? 0) };
    });
  } catch {
    return { porCorreo: 0, porIp: 0 };
  }
}

/** Deja constancia. Best-effort. */
export async function anotarIntento(correo: string, ip: string | null): Promise<void> {
  try {
    await withDb((c) =>
      c.query(`insert into login_intentos (correo, ip) values ($1, $2)`, [correo, ip])
    );
  } catch {
    // sin anotar; el siguiente conteo será más bajo de lo real, no más alto
  }
}
