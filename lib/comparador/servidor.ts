import { createClient } from "@/lib/supabase/server";
import type { FotoComparada, Lectura, Veredicto, Modo } from "./tipos";

// Cargar una corrida de la base. Va aparte de tipos.ts porque toca Supabase del
// servidor: si viviera junto a las funciones puras, la pantalla de calificar
// —que es del cliente— arrastraría el cliente de servidor al navegador.

/**
 * Barajeo estable a partir de un texto: el mismo id siempre da el mismo orden.
 *
 * ES EL CIEGO, y por eso tiene que ser estable. Las columnas se muestran como
 * "Modelo A, B, C" y el orden se sortea POR FOTO: sin eso, tres fotos bastan
 * para deducir cuál es cuál y a partir de ahí el juicio deja de ser sobre las
 * lecturas. Y si el orden cambiara al recargar, media calificación quedaría
 * contra la columna equivocada.
 */
function barajarSembrado<T>(xs: T[], semilla: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function cargarCorrida(corridaId: string): Promise<{
  modo: Modo;
  modelos: string[];
  estado: string;
  fotos: FotoComparada[];
} | null> {
  const supabase = await createClient();

  const { data: corrida } = await supabase
    .from("comparador_corridas")
    .select("modo, modelos, estado")
    .eq("id", corridaId)
    .maybeSingle();
  if (!corrida) return null;

  const [fotosRes, lecturasRes] = await Promise.all([
    supabase.from("comparador_fotos").select("id, path, n").eq("corrida_id", corridaId),
    supabase.from("comparador_lecturas").select("*").eq("corrida_id", corridaId),
  ]);

  const rutas = (fotosRes.data ?? []).map((f) => f.path as string);
  const firmadas = new Map<string, string>();
  if (rutas.length) {
    const { data: urls } = await supabase.storage.from("prendas").createSignedUrls(rutas, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
  }

  type FilaLectura = {
    foto_id: string;
    modelo_id: string;
    salida: unknown;
    error: string | null;
    costo_usd: string | number | null;
    ms: number | null;
    veredicto: Veredicto | null;
  };
  const porFoto = new Map<string, FilaLectura[]>();
  for (const l of (lecturasRes.data ?? []) as unknown as FilaLectura[]) {
    if (!porFoto.has(l.foto_id)) porFoto.set(l.foto_id, []);
    porFoto.get(l.foto_id)!.push(l);
  }

  const fotos: FotoComparada[] = (fotosRes.data ?? [])
    .map((f) => {
      const lecturas: Lectura[] = (porFoto.get(f.id as string) ?? []).map((l) => ({
        modeloId: l.modelo_id,
        salida: l.salida,
        error: l.error,
        costoUsd: l.costo_usd != null ? Number(l.costo_usd) : null,
        ms: l.ms,
        veredicto: l.veredicto,
      }));
      return {
        fotoId: f.id as string,
        n: f.n as number,
        url: firmadas.get(f.path as string) ?? null,
        lecturas: barajarSembrado(lecturas, f.id as string),
      };
    })
    .sort((a, b) => a.n - b.n);

  return {
    modo: corrida.modo as Modo,
    modelos: corrida.modelos as string[],
    estado: corrida.estado as string,
    fotos,
  };
}
