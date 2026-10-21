import { withDb } from "@/lib/db";
import type { Mercado, Segmento } from "@/lib/vitrina-uniqlo";
import { resumenMedicion, type MotivoDescarte, type ResumenMedicion, type VotoFila } from "./vitrina-medicion";

// LEER LA MEDICIÓN DE LA VITRINA PARA LA PANTALLA. Sin RLS: sólo la llaman
// páginas y acciones que ya exigieron admin (requireAdmin), como el resto del
// admin v2. Nada de aquí devuelve trip_id ni cuentas: la pantalla conoce el
// índice del viaje y del hueco, nada más.

export type CorridaResumen = {
  id: string;
  creada: string;
  modeloJuez: string;
  versionJuez: string;
  mercados: Mercado[];
  nHuecos: number;
  nCandidatos: number;
  nota: string | null;
};

export type HuecoUI = {
  id: string;
  n: number;
  viajeN: number;
  segmento: Segmento;
  nombre: string;
  tipo: string;
  colorFamilia: string;
  temporada: string | null;
  formalidad: string | null;
  visual: string | null;
  porque: string | null;
  termino: string | null;
  /** Cuántos candidatos tiene y cuántos ya calificó Roberto (todos los mercados). */
  candidatos: number;
  votados: number;
  /** ¿Roberto ya encontró al menos uno correcto? */
  conAcierto: boolean;
};

export type CandidatoUI = {
  id: string;
  mercado: Mercado;
  orden: number;
  nombre: string;
  color: string | null;
  genero: string | null;
  precioTexto: string | null;
  foto: string | null;
  url: string | null;
  rating: number | null;
  elegida: boolean;
  motivo: MotivoDescarte | null;
  cercana: boolean;
  tonoCercano: string | null;
  juez: boolean | null;
  juezLinea: string | null;
  juezError: string | null;
  roberto: boolean | null;
};

const iso = (v: unknown) => new Date(v as string).toISOString();

export async function listarCorridas(): Promise<CorridaResumen[]> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select id, creada, modelo_juez, version_juez, mercados, n_huecos, n_candidatos, nota
         from public.vitrina_medicion_corridas order by creada desc limit 20`
    );
    return rows.map((r) => ({
      id: r.id,
      creada: iso(r.creada),
      modeloJuez: r.modelo_juez,
      versionJuez: r.version_juez,
      mercados: r.mercados as Mercado[],
      nHuecos: Number(r.n_huecos),
      nCandidatos: Number(r.n_candidatos),
      nota: r.nota,
    }));
  });
}

export async function cargarCorrida(corridaId: string): Promise<{
  huecos: HuecoUI[];
  resumen: ResumenMedicion;
  /** Lo mismo que `resumen`, pero sólo con los candidatos de un mercado. */
  resumenPorMercado: Record<Mercado, ResumenMedicion>;
  costoJuezUsd: number;
} | null> {
  return withDb(async (c) => {
    const { rows: hs } = await c.query(
      `select id, n, viaje_n, segmento, nombre, tipo, color_familia, temporada, formalidad, visual, porque, termino
         from public.vitrina_medicion_huecos where corrida_id = $1 order by n`,
      [corridaId]
    );
    if (hs.length === 0) return null;
    const { rows: votos } = await c.query(
      `select k.hueco_id, h.n, k.mercado, k.elegida, k.cercana, k.juez, k.roberto, k.juez_costo_usd
         from public.vitrina_medicion_candidatos k
         join public.vitrina_medicion_huecos h on h.id = k.hueco_id
        where h.corrida_id = $1`,
      [corridaId]
    );
    const filas: (VotoFila & { huecoId: string; mercado: Mercado; costo: number })[] = votos.map((v) => ({
      huecoId: v.hueco_id,
      huecoN: Number(v.n),
      mercado: v.mercado as Mercado,
      elegida: Boolean(v.elegida),
      cercana: Boolean(v.cercana),
      juez: v.juez === null ? null : Boolean(v.juez),
      roberto: v.roberto === null ? null : Boolean(v.roberto),
      costo: v.juez_costo_usd === null ? 0 : Number(v.juez_costo_usd),
    }));
    const porHueco = new Map<string, { candidatos: number; votados: number; conAcierto: boolean }>();
    for (const f of filas) {
      const acc = porHueco.get(f.huecoId) ?? { candidatos: 0, votados: 0, conAcierto: false };
      acc.candidatos++;
      if (f.roberto !== null) acc.votados++;
      if (f.roberto === true) acc.conAcierto = true;
      porHueco.set(f.huecoId, acc);
    }
    const huecos: HuecoUI[] = hs.map((h) => ({
      id: h.id,
      n: Number(h.n),
      viajeN: Number(h.viaje_n),
      segmento: h.segmento,
      nombre: h.nombre,
      tipo: h.tipo,
      colorFamilia: h.color_familia,
      temporada: h.temporada,
      formalidad: h.formalidad,
      visual: h.visual,
      porque: h.porque,
      termino: h.termino,
      ...(porHueco.get(h.id) ?? { candidatos: 0, votados: 0, conAcierto: false }),
    }));
    const mercados: Mercado[] = ["us", "jp", "kr"];
    const resumenPorMercado = Object.fromEntries(
      mercados.map((m) => [m, resumenMedicion(filas.filter((f) => f.mercado === m), huecos.length)])
    ) as Record<Mercado, ResumenMedicion>;
    return {
      huecos,
      resumen: resumenMedicion(filas, huecos.length),
      resumenPorMercado,
      costoJuezUsd: filas.reduce((s, f) => s + f.costo, 0),
    };
  });
}

export async function cargarCandidatos(huecoId: string, mercado: Mercado): Promise<CandidatoUI[]> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `select id, mercado, orden, nombre, color, genero, precio_texto, foto, url, rating, elegida, motivo, cercana, tono_cercano,
              juez, juez_linea, juez_error, roberto
         from public.vitrina_medicion_candidatos where hueco_id = $1 and mercado = $2 order by orden`,
      [huecoId, mercado]
    );
    return rows.map((r) => ({
      id: r.id,
      mercado: r.mercado as Mercado,
      orden: Number(r.orden),
      nombre: r.nombre,
      color: r.color,
      genero: r.genero,
      precioTexto: r.precio_texto,
      foto: r.foto,
      url: r.url,
      rating: r.rating === null ? null : Number(r.rating),
      elegida: Boolean(r.elegida),
      motivo: r.motivo as MotivoDescarte | null,
      cercana: Boolean(r.cercana),
      tonoCercano: r.tono_cercano,
      juez: r.juez === null ? null : Boolean(r.juez),
      juezLinea: r.juez_linea,
      juezError: r.juez_error,
      roberto: r.roberto === null ? null : Boolean(r.roberto),
    }));
  });
}

/** El voto de Roberto sobre un candidato; null lo borra. */
export async function guardarVoto(candidatoId: string, veredicto: boolean | null): Promise<void> {
  await withDb((c) =>
    c.query(
      `update public.vitrina_medicion_candidatos
          set roberto = $2, roberto_el = case when $2::boolean is null then null else now() end
        where id = $1`,
      [candidatoId, veredicto]
    )
  );
}
