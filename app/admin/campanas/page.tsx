import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { DIAS_VENTANA, diaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { fmtSegundos } from "@/lib/admin/embudo-tiempos";
import { MXN_POR_USD, PASOS, costoPor, textoAvatar, textoDispositivos, textoPaises, type ResumenCampana } from "@/lib/admin/campana";
import { cargarCampana, desdePorDefecto } from "@/lib/admin/campana-datos";
import { campanaActiva, costoPorPrimerLookTotal, estadoDelExperimento } from "@/lib/admin/hoy";
import { MODULOS, OBJETIVOS, TEXTO_ESTADO, esFilaDeCampana, type Estado } from "@/lib/admin/objetivos";
import { OPCIONES_CONOCIO, etiquetaConocio } from "@/lib/como-nos-conocio";
import { esCampanaDePrueba } from "@/lib/embudo-marcas";
import { Chip, Cifra, Encabezado, Fila, Lista, Panel, Pestanas, PieDeLista, Renglon, Sub, Tabla, Td, Th, Vacio } from "../_ui";
import { borrarGasto, guardarGasto } from "./actions";

// CAMPAÑAS: ¿sirven los anuncios? (replanteo del admin, 2026-10-09; kit visual
// 2026-10-13). Une lo que eran Campaña y Adquisición, que contestaban lo mismo
// en dos pantallas.
//
// La primera vista contesta: cuatro cifras (gasto, primeros looks, costo por
// look, volvieron) y la tabla corta por campaña. Lo demás va en pestañas
// visibles, nunca en acordeones: el embudo paso por paso, los objetivos del
// plan, el uso en la primera semana, lo que dicen que las trajo y la captura
// del gasto. Las definiciones viven en lib/admin/campana.ts y en Cómo se
// cuenta; la carga en campana-datos.ts, compartida con el correo de las 8 y
// con Hoy. Postgres directo y sin RLS: se vuelve a exigir admin aquí.

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const input =
  "h-9 rounded-sm border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors duration-200 focus-visible:border-ink";
const boton =
  "inline-flex h-9 items-center rounded-sm border border-line bg-surface px-3 text-sm font-medium text-ink2 transition-colors duration-200 hover:border-ink hover:text-ink";

const VISTAS = [
  { id: "paso", label: "Paso por paso" },
  { id: "objetivos", label: "Objetivos del plan" },
  { id: "semana", label: "Primera semana" },
  { id: "trajo", label: "Qué las trajo" },
  { id: "gasto", label: "Gasto capturado" },
] as const;
type Vista = (typeof VISTAS)[number]["id"];

const TONO: Record<Estado, string> = {
  bien: "text-success",
  vigilar: "text-warning",
  alarma: "text-error",
  "sin-datos": "text-muted",
};

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}
function mxn(n: number | null): string {
  return n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`;
}
const nombre = (r: ResumenCampana) => (r.campana === "—" ? "sin anuncio" : r.campana);
const suma = (xs: ResumenCampana[], f: (r: ResumenCampana) => number | null) => xs.reduce((t, r) => t + (f(r) ?? 0), 0);

type Params = { desde?: string; ver?: string; pausadas?: string };

export default async function Campanas({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const ahora = new Date();
  const p = await searchParams;
  const desde = p.desde && DIA.test(p.desde) ? p.desde : await desdePorDefecto(ahora);
  const ver: Vista = VISTAS.some((v) => v.id === p.ver) ? (p.ver as Vista) : "paso";
  const conPausadas = p.pausadas === "1";
  const d = await cargarCampana(desde, ahora);
  const ayer = sumarDias(diaEnZona(ahora), -1);
  const estado = estadoDelExperimento(d.paro);

  // La URL de esta pantalla con los parámetros vigentes: cambiar de pestaña o
  // desplegar las pausadas no pierde la fecha elegida.
  const url = (cambios: Partial<Params>) => {
    const q = new URLSearchParams();
    const v = { desde: p.desde, ver, pausadas: conPausadas ? "1" : undefined, ...cambios };
    if (v.desde) q.set("desde", v.desde);
    if (v.ver && v.ver !== "paso") q.set("ver", v.ver);
    if (v.pausadas) q.set("pausadas", v.pausadas);
    const s = q.toString();
    return `/admin/campanas${s ? `?${s}` : ""}`;
  };

  // Sin mis recorridos de prueba (utm_campaign "prueba-…", lib/embudo-marcas.ts).
  const resumen = d.resumen.filter((r) => !esCampanaDePrueba(r.campana));
  const hoyDia = diaEnZona(ahora);
  const deAnuncio = resumen.filter(esFilaDeCampana);
  const activas = deAnuncio.filter((r) => campanaActiva(d.gasto, r.campana, hoyDia));
  const pausadas = deAnuncio.filter((r) => !campanaActiva(d.gasto, r.campana, hoyDia));
  const organicas = resumen.filter((r) => !esFilaDeCampana(r));
  const contestaron = d.filas.filter((f) => f.como_nos_conocio);
  const porRespuesta = [...OPCIONES_CONOCIO.map((o) => o.id), "omitido"]
    .map((id) => ({ id, n: contestaron.filter((f) => f.como_nos_conocio === id).length }))
    .filter((r) => r.n > 0);

  // Las cuatro cifras de arriba: sólo lo que vino de un anuncio.
  const gasto = suma(deAnuncio, (r) => r.costoMxn);
  const clics = suma(deAnuncio, (r) => r.clics);
  const entraron = suma(deAnuncio, (r) => r.entraron);
  const primerosLooks = suma(deAnuncio, (r) => r.primerLook);
  const volvieron = suma(deAnuncio, (r) => r.volvieronYa);
  const cerradas = suma(deAnuncio, (r) => r.ventanaCerrada);
  const costo = costoPorPrimerLookTotal(d.resumen);

  return (
    <>
      <Encabezado titulo="Campañas" sub="¿Sirven los anuncios? Del clic a si volvió, por campaña.">
        <form className="flex flex-wrap items-center gap-2">
          {ver !== "paso" ? <input type="hidden" name="ver" value={ver} /> : null}
          {conPausadas ? <input type="hidden" name="pausadas" value="1" /> : null}
          <label htmlFor="desde" className="text-sm text-muted">
            cuentas desde
          </label>
          <input id="desde" type="date" name="desde" defaultValue={d.desde} className={input} />
          <button type="submit" className={boton}>
            ver
          </button>
        </form>
      </Encabezado>

      <Fila cols={4}>
        <Cifra label="Gasto en anuncios" valor={mxn(gasto)} unidad="MXN" sub={`de ${mxn(OBJETIVOS.topeMxn)} del plan · ${clics} clics`} />
        <Cifra
          label="Primeros looks de anuncios"
          valor={primerosLooks}
          unidad={`de ${entraron} que entraron`}
          // Sólo el %: la frase del criterio de paro ya vive en el héroe de Hoy
          // y aquí ocupaba seis líneas en celular.
          sub={`${pct(primerosLooks, entraron)} de los que entraron`}
        />
        <Cifra label="Costo por primer look" valor={mxn(costo)} unidad="MXN" sub="anuncio + IA" />
        <Cifra
          label="Volvieron en su semana"
          valor={volvieron}
          unidad={`de ${primerosLooks}`}
          tono={estado.tono === "mal" ? "error" : volvieron > 0 ? "success" : "ink"}
          // El veredicto del plan sólo cuando ya existe ("pasa" / "no pasa"):
          // es corto y decide. Mientras no se sabe, la cuenta de semanas
          // cerradas dice más que repetir la regla (que vive en Hoy).
          sub={estado.tono === "neutro" ? `${cerradas} ya cerraron su semana` : estado.frase}
        />
      </Fila>

      <Panel titulo="Por campaña" extra={activas.length > 0 ? "activas · sin anuncio como fondo" : undefined} sinPadding className="mb-4">
        <Tabla minW="min-w-[760px]">
          <thead>
            <tr>
              <Th izq>Campaña</Th>
              <Th>Gasto</Th>
              <Th>
                <span title="Cuentas que entraron">Entraron</span>
              </Th>
              <Th>Primer look</Th>
              <Th>
                <span title={`Anuncio + IA, a ${MXN_POR_USD} MXN por dólar (supuesto; se cambia con MXN_POR_USD)`}>Costo por look</span>
              </Th>
              <Th>
                <span
                  title={`De quienes llegaron a su primer look: otro día dentro de sus primeros ${DIAS_VENTANA}, contando a quien sigue en su semana (como el criterio de paro)`}
                >
                  Volvieron
                </span>
              </Th>
              <Th>
                <span title={`Lo que costó su IA en sus primeros ${DIAS_VENTANA} días`}>IA</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {activas.map((r) => (
              <FilaCorta key={`${r.fuente}|${r.campana}`} r={r} />
            ))}
            {organicas.length > 0 ? <FilaSinAnuncio filas={organicas} /> : null}
            {conPausadas && pausadas.length > 0 ? (
              <>
                <tr>
                  <td colSpan={7} className="border-t border-line2 bg-tile px-5 py-2 text-left text-xs font-medium text-muted">
                    Pausadas · sin gasto en 3 días
                  </td>
                </tr>
                {pausadas.map((r) => (
                  <FilaCorta key={`${r.fuente}|${r.campana}`} r={r} />
                ))}
              </>
            ) : null}
            {resumen.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-4 text-left text-sm text-muted">
                  Nadie entró desde {d.desde} y no hay gasto capturado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Tabla>
        {pausadas.length > 0 ? (
          <PieDeLista>
            <Link href={url({ pausadas: conPausadas ? undefined : "1" })} className="font-semibold text-ink hover:underline">
              {conPausadas ? `ocultar las ${pausadas.length} pausadas` : `${pausadas.length} campañas pausadas`}
            </Link>{" "}
            · {pausadas.map((r) => r.campana).join(", ")}
          </PieDeLista>
        ) : null}
      </Panel>

      <Pestanas
        activa={url({ ver })}
        pestanas={VISTAS.map((v) => ({
          href: url({ ver: v.id }),
          label: v.label,
          nota: v.id === "trajo" ? contestaron.length : undefined,
        }))}
      />

      {ver === "paso" ? (
        <Panel titulo="Del clic al primer look" extra="bajo cada número, el % del paso anterior" sinPadding>
          <Tabla minW="min-w-[1100px]">
            <thead>
              <tr>
                <Th izq>Campaña</Th>
                {COLUMNAS_EMBUDO.map((c) => (
                  <Th key={c.etiqueta}>{c.title ? <span title={c.title}>{c.etiqueta}</span> : c.etiqueta}</Th>
                ))}
                <Th>
                  <span title="Mediana del tiempo al primer look">TTV</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <FilaLarga key={`${r.fuente}|${r.campana}`} r={r} pausada={pausadas.includes(r)} />
              ))}
              {resumen.length === 0 ? (
                <tr>
                  <td colSpan={2 + COLUMNAS_EMBUDO.length} className="px-5 py-4 text-left text-sm text-muted">
                    Nadie entró desde {d.desde}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Tabla>
        </Panel>
      ) : null}

      {ver === "objetivos" ? (
        <Panel
          titulo="Objetivos del plan P-03"
          extra={`anuncios del ${OBJETIVOS.anunciosDesde} al ${OBJETIVOS.anunciosHasta}`}
          sinPadding
        >
          <Tabla minW="min-w-[640px]">
            <thead>
              <tr>
                <Th izq>Objetivo</Th>
                <Th izq>Meta</Th>
                <Th>Real</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {d.objetivos.map((o) => (
                <tr key={o.clave}>
                  <Td izq>
                    <b className="font-semibold">{o.objetivo}</b>
                    {o.nota ? <Sub>{o.nota}</Sub> : null}
                  </Td>
                  <Td izq className="text-muted">
                    {o.meta}
                  </Td>
                  <Td>{o.real}</Td>
                  <Td className={`font-medium ${TONO[o.estado]}`}>{TEXTO_ESTADO[o.estado]}</Td>
                </tr>
              ))}
              {d.objetivos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-4 text-left text-sm text-muted">
                    Todavía no hay objetivos evaluados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Tabla>
        </Panel>
      ) : null}

      {ver === "semana" ? (
        <>
          {d.uso.personas === 0 ? (
            <Panel sinPadding className="mb-4">
              <Vacio>Todavía nadie de anuncios llegó a su primer look.</Vacio>
            </Panel>
          ) : (
            <Fila cols={4}>
              <Cifra label="Personas" valor={d.uso.personas} sub="de anuncios, con primer look" />
              <Cifra
                label="Subieron ropa propia"
                valor={d.uso.conRopaPropia}
                unidad={pct(d.uso.conRopaPropia, d.uso.personas)}
                sub={`mediana: ${d.uso.ropaPropiaMediana ?? "—"} prendas`}
              />
              <Cifra label="Looks por persona" valor={d.uso.looksMediana ?? "—"} sub="mediana" />
              <Panel sinPadding>
                <div className="flex flex-col gap-0.5 px-5 py-4">
                  <span className="text-xs text-muted">Módulos que usaron</span>
                  <ul className="flex flex-col text-sm text-ink">
                    {MODULOS.map((m) => (
                      <li key={m.clave} className="flex justify-between gap-3">
                        <span>{m.etiqueta}</span>
                        <span className="font-semibold tabular-nums">{d.uso.modulos[m.clave]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            </Fila>
          )}
          <Panel sinPadding>
            <Lista>
              <Linea rotulo="Avatar" nota={`cuentas desde ${d.desde}`}>
                {textoAvatar(d.avatar)}
              </Linea>
              {textoDispositivos(d.dispositivos) ? (
                <Linea rotulo="Por aparato" nota="cuentas de anuncios">
                  {textoDispositivos(d.dispositivos)}
                </Linea>
              ) : null}
              {textoPaises(d.paises) ? (
                <Linea rotulo="Por país" nota="cuentas de anuncios">
                  {textoPaises(d.paises)}
                </Linea>
              ) : null}
              {d.app ? (
                <Linea rotulo="App instalada" nota="activas en 30 días">
                  {pct(d.app.activas_instaladas, d.app.activas)} la abren desde su ícono ({d.app.activas_instaladas} de {d.app.activas})
                </Linea>
              ) : null}
            </Lista>
          </Panel>
        </>
      ) : null}

      {ver === "trajo" ? (
        <Panel titulo="Qué las trajo" extra={`${contestaron.length} de ${d.filas.length} contestaron`} sinPadding={porRespuesta.length === 0}>
          {porRespuesta.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {porRespuesta.map((r) => (
                <li key={r.id}>
                  <Chip tono="ink">
                    {etiquetaConocio(r.id)}
                    <b className="ml-1.5 tabular-nums">{r.n}</b>
                  </Chip>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Todavía nadie la ha contestado.</Vacio>
          )}
        </Panel>
      ) : null}

      {ver === "gasto" ? (
        <Panel titulo="Capturar el gasto de cada plataforma" extra="un renglón por día y campaña; repetirlo corrige" sinPadding>
          <form action={guardarGasto} className="flex flex-wrap items-end gap-2 px-5 pb-4 pt-1">
            <Campo texto="día">
              <input type="date" name="dia" required defaultValue={ayer} className={input} />
            </Campo>
            <Campo texto="campaña">
              <input name="campana" required list="campanas-conocidas" placeholder="app-neutra" className={`${input} w-44`} />
              <datalist id="campanas-conocidas">
                {d.campanasConocidas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>
            <Campo texto="impresiones">
              <input name="impresiones" inputMode="numeric" className={`${input} w-24`} />
            </Campo>
            <Campo texto="clics">
              <input name="clics" inputMode="numeric" required className={`${input} w-20`} />
            </Campo>
            <Campo texto="costo MXN">
              <input name="costo_mxn" inputMode="decimal" required className={`${input} w-24`} />
            </Campo>
            <Campo texto="registros de Google">
              <input name="registros_google" inputMode="numeric" className={`${input} w-20`} />
            </Campo>
            <Campo texto="nota">
              <input name="nota" maxLength={300} className={`${input} w-48`} />
            </Campo>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-sm bg-ink px-4 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-ink2"
            >
              Guardar
            </button>
          </form>
          {d.gasto.length > 0 ? (
            <Tabla minW="min-w-[640px]">
              <thead>
                <tr>
                  <Th izq>Día</Th>
                  <Th izq>Campaña</Th>
                  <Th>Impresiones</Th>
                  <Th>Clics</Th>
                  <Th>MXN</Th>
                  <Th>Registros Google</Th>
                  <Th izq>Nota</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {d.gasto.map((g) => (
                  <tr key={`${g.dia}|${g.campana}`}>
                    <Td izq className="text-muted">
                      {g.dia}
                    </Td>
                    <Td izq>{g.campana}</Td>
                    <Td>{g.impresiones ?? "—"}</Td>
                    <Td>{g.clics}</Td>
                    <Td>{mxn(g.costo_mxn)}</Td>
                    <Td>{g.registros_google ?? "—"}</Td>
                    <Td izq className="text-muted">
                      {g.nota ?? ""}
                    </Td>
                    <Td>
                      <form action={borrarGasto}>
                        <input type="hidden" name="dia" value={g.dia} />
                        <input type="hidden" name="campana" value={g.campana} />
                        <button type="submit" className="text-xs text-muted underline hover:text-error">
                          borrar
                        </button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          ) : (
            <Vacio>Todavía no hay gasto capturado.</Vacio>
          )}
        </Panel>
      ) : null}
    </>
  );
}

/* ───────────────────────── Filas de las tablas ───────────────────────── */

/** La fila corta: lo que decide si una campaña sirve. */
function FilaCorta({ r }: { r: ResumenCampana }) {
  const costo = costoPor(r, r.primerLook);
  return (
    <tr>
      <Td izq>
        <b className="font-semibold">{nombre(r)}</b>
        <Sub>{r.fuente}</Sub>
      </Td>
      <Td>
        {r.costoMxn != null ? <b className="font-semibold">{mxn(r.costoMxn)}</b> : "—"}
        {r.clics != null ? <Sub>{r.clics} clics</Sub> : null}
      </Td>
      <Td>{r.entraron}</Td>
      <Td>
        <b className="font-semibold">{r.primerLook}</b>
        {r.entraron ? <Sub>{pct(r.primerLook, r.entraron)}</Sub> : null}
      </Td>
      <Td>{costo != null ? mxn(costo) : "—"}</Td>
      <Td className={r.volvieronYa > 0 ? "text-success" : ""}>
        {r.entraron === 0 ? (
          "—"
        ) : (
          <>
            <b className="font-semibold">{r.volvieronYa}</b>
            <Sub>{r.ventanaCerrada ? `${r.ventanaCerrada} semanas cerradas` : "ninguna cerrada"}</Sub>
          </>
        )}
      </Td>
      <Td>US${r.iaUsd.toFixed(2)}</Td>
    </tr>
  );
}

/** Las que llegaron sin anuncio, sumadas en una fila: el fondo contra el que se lee lo demás. */
function FilaSinAnuncio({ filas }: { filas: ResumenCampana[] }) {
  const entraron = suma(filas, (r) => r.entraron);
  const primerLook = suma(filas, (r) => r.primerLook);
  const volvieronYa = suma(filas, (r) => r.volvieronYa);
  const cerradas = suma(filas, (r) => r.ventanaCerrada);
  const ia = suma(filas, (r) => r.iaUsd);
  const fuentes = [...new Set(filas.map((r) => r.fuente))].join(", ");
  const c = "bg-tile";
  return (
    <tr>
      <Td izq className={c}>
        <b className="font-semibold">Sin anuncio</b>
        <Sub>{fuentes}</Sub>
      </Td>
      <Td className={c}>—</Td>
      <Td className={c}>{entraron}</Td>
      <Td className={c}>
        <b className="font-semibold">{primerLook}</b>
        {entraron ? <Sub>{pct(primerLook, entraron)}</Sub> : null}
      </Td>
      <Td className={c}>—</Td>
      <Td className={`${c} ${volvieronYa > 0 ? "text-success" : ""}`}>
        {entraron === 0 ? (
          "—"
        ) : (
          <>
            <b className="font-semibold">{volvieronYa}</b>
            <Sub>{cerradas ? `${cerradas} semanas cerradas` : "ninguna cerrada"}</Sub>
          </>
        )}
      </Td>
      <Td className={c}>US${ia.toFixed(2)}</Td>
    </tr>
  );
}

/**
 * LAS COLUMNAS DEL PASO POR PASO, EN EL ORDEN EN QUE LA GENTE LAS VIVE.
 *
 * Desde la entrada sin correo (v0.2.345.0) el código se pide DENTRO del
 * onboarding, entre el clóset y el objetivo (app/onboarding/correo). La tabla
 * seguía con el orden de antes —clic, landing, botón, correo, código,
 * entraron— y comparaba "pidieron código" contra los clics: "Entraron" salía
 * en 277% y la fuga de las dos campañas activas caía justo ahí, en un paso que
 * no está donde la tabla decía. Las cuentas no cambian (lib/admin/campana.ts);
 * sólo el orden y contra qué paso se saca cada %.
 *
 * Cabecera y celdas salen de la misma lista para que no se puedan desalinear.
 */
const COLUMNAS_EMBUDO: { etiqueta: string; title?: string }[] = [
  { etiqueta: "Landing", title: "Navegadores que abrieron la landing (desde el 2026-10-04), contra los clics" },
  { etiqueta: "Botón", title: "Borradores que abrió el botón, contra la landing" },
  { etiqueta: "Entraron", title: "Cuentas que empezaron, contra el botón" },
  { etiqueta: "Registro", title: "Dio su edad y es mayor: lo mismo que Google cuenta como registro" },
  ...PASOS.filter((p) => p.min <= 3).map((p) => ({ etiqueta: p.etiqueta })),
  { etiqueta: "Pidieron código", title: "Pidieron su código en la pantalla del correo, contra quienes terminaron el clóset" },
  { etiqueta: "Correo ok", title: "Verificaron su correo, de quienes llegaron a esa pantalla" },
  ...PASOS.filter((p) => p.min > 3).map((p, k) => ({
    etiqueta: p.etiqueta,
    title: k === 0 ? "Contra quienes terminaron el clóset: incluye la pantalla del correo" : undefined,
  })),
];

function pasosDelEmbudo(r: ResumenCampana): { n: number; de: number | null; nota?: string }[] {
  const antes = PASOS.flatMap((p, i) => (p.min <= 3 ? [i] : []));
  const despues = PASOS.flatMap((p, i) => (p.min > 3 ? [i] : []));
  const closet = r.pasos[antes[antes.length - 1]];
  return [
    { n: r.landing, de: r.clics },
    { n: r.boton, de: r.landing },
    { n: r.entraron, de: r.boton || r.landing || r.clics },
    { n: r.registro, de: r.entraron, nota: r.registrosGoogle != null ? `Google: ${r.registrosGoogle}` : undefined },
    ...antes.map((i) => ({ n: r.pasos[i], de: i === 0 ? r.registro : r.pasos[i - 1] })),
    { n: r.pidieronCodigo, de: closet },
    { n: r.correoOk, de: r.correoVisto },
    // El primer paso de después del correo se lee contra el CLÓSET, no contra
    // "correo ok": el correo se cuenta desde el 2026-10-04 y el objetivo desde
    // siempre, así que contra el correo salía en 112%. Contra el clóset el %
    // incluye la pantalla del correo, que es justo lo que hay entre los dos.
    ...despues.map((i, k) => ({ n: r.pasos[i], de: k === 0 ? closet : r.pasos[i - 1] })),
  ];
}

/**
 * La fila larga del embudo. Cada paso trae el % del anterior y el paso con la
 * mayor caída de la fila se marca como "la fuga", para no tener que leer doce
 * porcentajes buscando el más bajo.
 *
 * DOS CONDICIONES PARA MARCARLA (2026-10-13). Sin ellas la tabla se llenaba de
 * rojo que no decía nada: "0% · la fuga" en campañas pausadas con cero
 * personas, o "25% · la fuga" en una fila de 8 visitas.
 *   · La campaña está corriendo. Una pausada ya no se va a arreglar; su fuga
 *     es historia y se lee en su porcentaje, sin pintarla.
 *   · El paso anterior trae al menos OBJETIVOS.muestraMinima personas, el
 *     mismo umbral que usa el plan: con menos, un porcentaje no dice nada.
 * El porcentaje se sigue enseñando en todos los casos; lo único que cambia es
 * cuál se pinta de rojo.
 */
function FilaLarga({ r, pausada }: { r: ResumenCampana; pausada: boolean }) {
  const pasos = pasosDelEmbudo(r);
  const tasas = pasos.map((s) => (s.de != null && s.de > 0 ? s.n / s.de : null));
  const cuenta = (i: number) => (pasos[i].de ?? 0) >= OBJETIVOS.muestraMinima;
  const fuga = pausada
    ? -1
    : tasas.reduce<number>((min, t, i) => (t != null && t < 1 && cuenta(i) && (min < 0 || t < (tasas[min] ?? 1)) ? i : min), -1);
  return (
    <tr>
      <Td izq>
        <b className="font-semibold">{nombre(r)}</b>
        <Sub>{r.fuente}</Sub>
      </Td>
      {pasos.map((s, i) => {
        const tasa = tasas[i];
        const texto = tasa == null ? s.nota : `${pct(s.n, s.de ?? 0)}${i === fuga ? " · la fuga" : ""}${s.nota ? ` · ${s.nota}` : ""}`;
        return (
          <Td key={i}>
            <b className="font-semibold">{s.n}</b>
            {texto ? <Sub>{i === fuga ? <span className="text-error">{texto}</span> : texto}</Sub> : null}
          </Td>
        );
      })}
      <Td>{fmtSegundos(r.ttvMedianaS)}</Td>
    </tr>
  );
}

/* ───────────────────────── Piezas chicas de esta pantalla ───────────────────────── */

/** Un renglón "Rótulo · nota: texto" de la primera semana. */
function Linea({ rotulo, nota, children }: { rotulo: string; nota?: string; children: ReactNode }) {
  return (
    <Renglon>
      <span className="shrink-0 text-sm">
        <b className="font-semibold text-ink">{rotulo}</b>
        {nota ? <span className="text-faint"> · {nota}</span> : null}
      </span>
      <span className="min-w-0 text-sm text-ink2">{children}</span>
    </Renglon>
  );
}

/** Un campo del formulario de gasto: rótulo chico arriba del input. */
function Campo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {texto}
      {children}
    </label>
  );
}
