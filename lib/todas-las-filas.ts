// TODAS LAS FILAS, NO LAS PRIMERAS MIL (2026-10-09). La usan el admin y el freno
// global de gasto (lib/cuotas.ts).
//
// Supabase (PostgREST) devuelve como máximo 1000 filas por consulta y no avisa:
// la respuesta llega sin error, sólo más corta. Las pantallas del admin pedían
// tablas enteras así, y cuando events (2129) e items (2319) pasaron de mil, la
// actividad dejó de enseñar lo reciente, la tabla de usuarias contó clósets de
// menos y el "activos 7 días" del dashboard se topó en 1000 eventos. Lo destapó
// el filtro de borradores vacíos: una persona real sin correo cuyos eventos
// quedaron fuera de las mil parecía un borrador vacío y se escondía (46 en vez
// de 13).
//
// Esto pide de mil en mil hasta que una página llega incompleta. La consulta
// TIENE que ordenarse por una columna única (`id`): sin orden, Postgres no
// garantiza que dos páginas no se pisen o se salten filas.
//
// Si una página falla, truena: un conteo que se queda corto en silencio es
// justo el error que esto viene a quitar, y preferimos la pantalla de error.

export const TAM_PAGINA = 1000;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function todasLasFilas<T>(
  pedir: (desde: number, hasta: number) => Pagina<T>,
  tam: number = TAM_PAGINA
): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += tam) {
    const { data, error } = await pedir(desde, desde + tam - 1);
    if (error) throw new Error(`[admin] consulta paginada falló en la fila ${desde}: ${error.message}`);
    const filas = data ?? [];
    out.push(...filas);
    if (filas.length < tam) return out;
  }
}
