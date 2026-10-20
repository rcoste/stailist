// LA MEDICIÓN EN SECO DE LA VITRINA DE UNIQLO (2026-10-21).
//
// Uso:
//   npx tsx scripts/vitrina-medicion.ts                 nueva corrida + juez
//   npx tsx scripts/vitrina-medicion.ts --sin-juez      sólo consulta y guarda
//   npx tsx scripts/vitrina-medicion.ts --juzgar <id>   (re)anuda el juez de una corrida
//
// Qué hace: lee de la base los huecos reales ("falta" en capsule_match de los
// viajes vivos, deleted_at null), pide a la API de Uniqlo los 20 candidatos
// por hueco y mercado con LA MISMA consulta que usa la vitrina (terminoDe +
// consultarUniqlo, limit 20), marca cuáles dos eligió `elegirPrendas`, lo
// guarda en vitrina_medicion_* (migración 0183) y le pregunta al juez barato
// (MODELO_JUEZ_VITRINA) por cada candidato si es la pieza que pide el hueco.
// Roberto califica después en /admin/vitrina-medicion.
//
// No toca la vitrina ni nada de producción: sólo lee trips/profiles y escribe
// en sus propias tablas. El recibo del juez se guarda en la fila del candidato
// (no en ai_calls: es laboratorio, no uso real — ver lib/recibos.ts).
import { readFileSync } from "node:fs";
import { withDb } from "../lib/db";
import type { CapsuleMatch, CapsuleOverrides, CapsuleTarget } from "../lib/capsule";
import { consultarUniqlo, LIMITE_RESPUESTA, type Consulta, type Mercado, type Segmento } from "../lib/vitrina-uniqlo";
import { armarCandidatos, huecosDeViaje, type CandidatoMedicion, type HuecoMedicion } from "../lib/evales/vitrina-medicion";
import { JUEZ_VITRINA_VERSION, juzgarCandidato } from "../lib/evales/juez-vitrina";
import { MODELO_JUEZ_VITRINA } from "../lib/models";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const MERCADOS: Mercado[] = ["us", "jp", "kr"];
const CONCURRENCIA_JUEZ = 6;

// Fuera de Next no existe la Data Cache: se quitan `cache`/`next` del init y
// queda un fetch plano con el mismo timeout. La URL y los parámetros son los
// de producción porque los arma consultarUniqlo.
const fetchPlano: typeof fetch = (url, init) => fetch(url, { signal: init?.signal });

type HuecoGuardado = HuecoMedicion & { id: string; n: number };

async function nuevaCorrida(): Promise<string> {
  const viajes = await withDb(async (c) => {
    const { rows } = await c.query(
      `select t.id, t.capsule_target, t.capsule_match, t.overrides, p.gender
         from public.trips t join public.profiles p on p.id = t.user_id
        where t.deleted_at is null and t.capsule_target is not null and t.capsule_match is not null
          and p.gender in ('hombre', 'mujer')
        order by t.created_at`
    );
    return rows as { id: string; capsule_target: CapsuleTarget; capsule_match: CapsuleMatch; overrides: CapsuleOverrides | null; gender: Segmento }[];
  });
  console.log(`viajes vivos con maleta: ${viajes.length}`);

  const huecos: (HuecoMedicion & { tripId: string; viajeN: number })[] = [];
  let viajeN = 0;
  for (const v of viajes) {
    const hs = huecosDeViaje(v.capsule_target, v.capsule_match, v.overrides, v.gender);
    if (hs.length === 0) continue;
    viajeN++;
    for (const h of hs) huecos.push({ ...h, tripId: v.id, viajeN });
  }
  const conTermino = huecos.filter((h) => h.termino);
  console.log(`huecos: ${huecos.length} en ${viajeN} viajes; con término de búsqueda: ${conTermino.length}`);
  const sinTermino = huecos.filter((h) => !h.termino).map((h) => h.tipo);
  if (sinTermino.length) console.log(`  sin término (la vitrina no los busca): ${[...new Set(sinTermino)].join(", ")}`);

  // Una consulta por (mercado, término): muchos huecos comparten "sweater".
  const consultas = new Map<string, Consulta>();
  const errores: string[] = [];
  const claves = [...new Set(conTermino.map((h) => h.termino!))];
  for (const m of MERCADOS) {
    for (const q of claves) {
      const r = await consultarUniqlo(m, q, {
        fetchImpl: fetchPlano,
        onError: (mercado, msg) => {
          errores.push(`${mercado} ${q}: ${msg}`);
        },
      });
      consultas.set(`${m}|${q}`, r);
      process.stdout.write(`  ${m} ${q}: ${r.items.length}\n`);
    }
  }
  if (errores.length) console.log(`consultas con error (${errores.length}): ${errores.join(" · ")}`);

  const corridaId = await withDb(async (c) => {
    await c.query("begin");
    try {
      const { rows } = await c.query(
        `insert into public.vitrina_medicion_corridas (modelo_juez, version_juez, mercados, nota)
         values ($1, $2, $3, $4) returning id`,
        [MODELO_JUEZ_VITRINA.id, JUEZ_VITRINA_VERSION, MERCADOS, `limit ${LIMITE_RESPUESTA}; ${huecos.length} huecos de ${viajeN} viajes`]
      );
      const id = rows[0].id as string;
      let nCandidatos = 0;
      for (let i = 0; i < huecos.length; i++) {
        const h = huecos[i];
        const { rows: hr } = await c.query(
          `insert into public.vitrina_medicion_huecos
             (corrida_id, n, viaje_n, trip_id, item_index, segmento, nombre, tipo, color_familia, temporada, formalidad, visual, porque, termino)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
          [id, i + 1, h.viajeN, h.tripId, h.itemIndex, h.segmento, h.nombre, h.tipo, h.colorFamilia, h.temporada, h.formalidad, h.visual, h.porque, h.termino]
        );
        const huecoId = hr[0].id as string;
        if (!h.termino) continue;
        for (const m of MERCADOS) {
          const items = consultas.get(`${m}|${h.termino}`)?.items ?? [];
          const candidatos = armarCandidatos(items, h, m);
          for (const k of candidatos) {
            await c.query(
              `insert into public.vitrina_medicion_candidatos
                 (hueco_id, mercado, orden, product_id, nombre, color, display_code, genero, precio, precio_texto, foto, url, rating, elegida, motivo)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
              [huecoId, m, k.orden, k.productId, k.nombre, k.color, k.displayCode, k.genero, k.precio, k.precioTexto, k.foto, k.url, k.rating, k.elegida, k.motivo]
            );
            nCandidatos++;
          }
        }
      }
      await c.query(`update public.vitrina_medicion_corridas set n_huecos = $2, n_candidatos = $3 where id = $1`, [id, huecos.length, nCandidatos]);
      await c.query("commit");
      console.log(`corrida ${id}: ${huecos.length} huecos, ${nCandidatos} candidatos`);
      return id;
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  });
  return corridaId;
}

async function juzgar(corridaId: string) {
  type Pendiente = { id: string; hueco: HuecoGuardado; candidato: CandidatoMedicion };
  const pendientes = await withDb(async (c) => {
    const { rows } = await c.query(
      `select k.id, k.nombre, k.color, k.genero, k.precio_texto,
              h.nombre as h_nombre, h.segmento, h.color_familia, h.temporada, h.formalidad, h.visual, h.porque
         from public.vitrina_medicion_candidatos k
         join public.vitrina_medicion_huecos h on h.id = k.hueco_id
        where h.corrida_id = $1 and k.juez is null and k.juez_error is null
        order by h.n, k.mercado, k.orden`,
      [corridaId]
    );
    return rows.map(
      (r): Pendiente => ({
        id: r.id,
        hueco: { nombre: r.h_nombre, segmento: r.segmento, colorFamilia: r.color_familia, temporada: r.temporada, formalidad: r.formalidad, visual: r.visual, porque: r.porque } as HuecoGuardado,
        candidato: { nombre: r.nombre, color: r.color, genero: r.genero, precioTexto: r.precio_texto } as CandidatoMedicion,
      })
    );
  });
  console.log(`juez: ${pendientes.length} candidatos por juzgar (${MODELO_JUEZ_VITRINA.etiqueta}, ${JUEZ_VITRINA_VERSION})`);
  let hechos = 0;
  let fallos = 0;
  let costo = 0;
  let cursor = 0;
  const trabajador = async () => {
    while (cursor < pendientes.length) {
      const p = pendientes[cursor++];
      try {
        const v = await juzgarCandidato(null, p.hueco, p.candidato);
        costo += v.recibo.costoUsd ?? 0;
        await withDb((c) =>
          c.query(
            `update public.vitrina_medicion_candidatos set juez = $2, juez_linea = $3, juez_costo_usd = $4, juez_ms = $5, juez_error = null where id = $1`,
            [p.id, v.esLaPieza, v.linea, v.recibo.costoUsd, v.recibo.ms]
          )
        );
      } catch (e) {
        fallos++;
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        await withDb((c) => c.query(`update public.vitrina_medicion_candidatos set juez_error = $2 where id = $1`, [p.id, msg]));
      }
      hechos++;
      if (hechos % 100 === 0) console.log(`  ${hechos}/${pendientes.length} · fallos ${fallos} · $${costo.toFixed(3)}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCIA_JUEZ }, trabajador));
  console.log(`juez listo: ${hechos} juzgados, ${fallos} fallos, $${costo.toFixed(3)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--juzgar");
  if (i >= 0) {
    const id = args[i + 1];
    if (!id) throw new Error("--juzgar necesita el id de la corrida");
    await juzgar(id);
    return;
  }
  const id = await nuevaCorrida();
  if (!args.includes("--sin-juez")) await juzgar(id);
  console.log(`listo → /admin/vitrina-medicion?c=${id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
