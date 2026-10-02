import { clienteDeServicio } from "@/lib/supabase/servicio";

// LO ÚNICO QUE LA LLAVE DE SERVICIO HACE POR UNA PERSONA (2026-10-01).
//
// EL HUECO QUE CIERRA. Los depósitos públicos `catalog` y `destinos` y sus dos
// tablas (`catalog_renders`, `destino_imagenes`) son una biblioteca COMPARTIDA:
// la imagen que se genera para una persona la ven todas. Hasta hoy la escribía
// el navegador de cada quien, con políticas `with check (true)`: cualquier
// cuenta podía subir cualquier archivo, sobrescribir la foto de un destino o
// registrar una imagen falsa para una prenda que aún no se generaba. Con el
// registro abierto y anuncios prendidos, "cualquier cuenta" es cualquiera con
// un correo (asesor de seguridad de Supabase, alertas 0024).
//
// POR QUÉ AQUÍ SÍ ENTRA LA LLAVE, contra la regla de servicio.ts ("nunca en una
// ruta que responda a una persona"). La alternativa sin llave —apretar las
// políticas— sólo protegía lo ya generado y dejaba abierto subir archivos
// ajenos y envenenar lo que falta por generar. Roberto eligió cerrarlo entero
// (opción A). El riesgo que la regla cuida no desaparece: se acota a ESTE
// archivo.
//
// LO QUE LO HACE ACEPTABLE — y lo que no se debe aflojar:
//  · El cliente de servicio NUNCA sale de aquí: no se exporta ni se devuelve.
//  · Cada función escribe en un depósito y una tabla fijos. No hay función
//    genérica "escribe donde sea".
//  · El nombre del archivo lo arma este módulo a partir de una llave que
//    calculó el servidor, y se valida: sin diagonales ni puntos, para que nadie
//    pueda salirse de la carpeta ni pisar otra extensión.
//  · Quien llama ya comprobó la sesión y la cuota; esto no autentica a nadie.
//  · lib/contrato-llave-servicio.test.ts fija quién puede importarlo.
//
// Las LECTURAS no pasan por aquí: siguen con la sesión de la persona y las
// políticas de SELECT, que no cambiaron.

/** Minúsculas, números, guiones y guion bajo. Nada que cambie de carpeta o de extensión. */
const LLAVE_VALIDA = /^[a-z0-9][a-z0-9_-]{0,159}$/;

export function llaveSegura(llave: string): boolean {
  return LLAVE_VALIDA.test(llave);
}

type Resultado<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const SIN_LLAVE = { ok: false as const, error: "sin_llave_de_servicio" };
const LLAVE_INVALIDA = { ok: false as const, error: "llave_invalida" };

/**
 * Sube el render de una prenda ideal al depósito `catalog` y lo anota en
 * `catalog_renders`. Si otra persona subió el mismo combo en paralelo, el
 * archivo ya existe: no es error, se anota igual.
 */
export async function guardarRenderDeCatalogo(key: string, bytes: Buffer | Uint8Array): Promise<Resultado<{ path: string }>> {
  if (!llaveSegura(key)) return LLAVE_INVALIDA;
  const servicio = clienteDeServicio();
  if (!servicio) return SIN_LLAVE;
  const path = `${key}.jpg`;
  const up = await servicio.storage.from("catalog").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error && !/exist|dupl/i.test(up.error.message)) return { ok: false, error: up.error.message };
  const { error } = await servicio.from("catalog_renders").upsert({ key, path }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

/**
 * EL CANDADO de la foto de un destino: intenta crear la fila en 'generando'.
 * `creada: false` = ya existía (alguien más la tiene, o está lista, o falló).
 */
export async function crearCandadoDeDestino(slug: string, lugar: string): Promise<Resultado<{ creada: boolean }>> {
  if (!llaveSegura(slug)) return LLAVE_INVALIDA;
  const servicio = clienteDeServicio();
  if (!servicio) return SIN_LLAVE;
  const { error } = await servicio.from("destino_imagenes").insert({ slug, lugar: lugar.slice(0, 80), status: "generando" });
  return { ok: true, creada: !error };
}

/**
 * Reclama un destino en 'fallo' o en un 'generando' muerto. El WHERE re-verifica
 * el MISMO estado que se leyó (ver app/api/destino-imagen/route.ts).
 */
export async function reclamarDestino(
  slug: string,
  estadoLeido: "fallo" | "generando",
  actualizadoAntesDe: string
): Promise<Resultado<{ reclamado: boolean }>> {
  if (!llaveSegura(slug)) return LLAVE_INVALIDA;
  const servicio = clienteDeServicio();
  if (!servicio) return SIN_LLAVE;
  const { data } = await servicio
    .from("destino_imagenes")
    .update({ status: "generando", updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .eq("status", estadoLeido)
    .lt("updated_at", actualizadoAntesDe)
    .select("slug");
  return { ok: true, reclamado: !!data && data.length > 0 };
}

/** Sube la foto del destino (`<slug>.webp` o `.png`) y deja la fila en 'listo'. */
export async function guardarFotoDeDestino(
  slug: string,
  foto: { buffer: Buffer; ext: "webp" | "png"; motivo: string }
): Promise<Resultado<{ path: string }>> {
  if (!llaveSegura(slug)) return LLAVE_INVALIDA;
  const servicio = clienteDeServicio();
  if (!servicio) return SIN_LLAVE;
  const path = `${slug}.${foto.ext}`;
  const up = await servicio.storage
    .from("destinos")
    .upload(path, foto.buffer, { contentType: foto.ext === "webp" ? "image/webp" : "image/png", upsert: true });
  if (up.error) return { ok: false, error: `storage: ${up.error.message}` };
  const { error } = await servicio
    .from("destino_imagenes")
    .update({ status: "listo", path, motivo: foto.motivo.slice(0, 300), updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

/** Deja el destino en 'fallo' con el motivo: el próximo viaje a ese lugar lo reintenta. */
export async function marcarDestinoFallido(slug: string, motivo: string): Promise<void> {
  if (!llaveSegura(slug)) return;
  const servicio = clienteDeServicio();
  if (!servicio) return;
  await servicio
    .from("destino_imagenes")
    .update({ status: "fallo", motivo: motivo.slice(0, 220), updated_at: new Date().toISOString() })
    .eq("slug", slug);
}
