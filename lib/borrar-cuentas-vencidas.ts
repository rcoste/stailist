// BORRAR LAS CUENTAS CUYO BORRADO PROGRAMADO VENCIÓ (lo corre la limpieza diaria).
//
// Orquestación pura con dependencias inyectadas, para poder probar las dos
// reglas que importan sin Supabase:
// 1. ARCHIVOS PRIMERO, Y SI FALLAN NO SE TOCAN LAS FILAS. El inventario de
//    fotos sale de las filas y de la carpeta; si se borraran las filas con los
//    archivos a medias, las fotos quedarían huérfanas para siempre, sin nadie
//    que las reclame. Mejor reintentar mañana.
// 2. UNA CUENTA QUE FALLA NO FRENA A LAS DEMÁS.

export type DepsBorradoVencido = {
  /** Ids de las cuentas con `borrado_programado_para <= now()`. */
  vencidas: () => Promise<string[]>;
  /** Borra y VERIFICA vacía la carpeta de la persona en cada bucket. Lanza si no pudo. */
  borrarArchivosDe: (uid: string) => Promise<void>;
  /** Filas + usuario de auth, en transacción (lib/borrar-cuenta.ts). Lanza si falla. */
  borrarFilasDe: (uid: string) => Promise<void>;
};

export type ResultadoBorradoVencido = { borradas: string[]; fallidas: { uid: string; paso: "archivos" | "filas"; error: string }[] };

export async function borrarCuentasVencidas(deps: DepsBorradoVencido): Promise<ResultadoBorradoVencido> {
  const out: ResultadoBorradoVencido = { borradas: [], fallidas: [] };
  for (const uid of await deps.vencidas()) {
    try {
      await deps.borrarArchivosDe(uid);
    } catch (e) {
      out.fallidas.push({ uid, paso: "archivos", error: e instanceof Error ? e.message : String(e) });
      continue;
    }
    try {
      await deps.borrarFilasDe(uid);
      out.borradas.push(uid);
    } catch (e) {
      out.fallidas.push({ uid, paso: "filas", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
