import { requireAdmin } from "@/lib/auth";
import { DIAS_VENTANA, diaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { fmtSegundos } from "@/lib/admin/embudo-tiempos";
import {
  MXN_POR_USD,
  PARO_MINIMO_VOLVIERON,
  PARO_MUESTRA,
  PASOS,
  costoPor,
  textoAvatar,
  textoDispositivos,
  textoPaises,
  type ResumenCampana,
} from "@/lib/admin/campana";
import { cargarCampana, desdePorDefecto } from "@/lib/admin/campana-datos";
import { estadoDelExperimento } from "@/lib/admin/hoy";
import { MODULOS, OBJETIVOS, TEXTO_ESTADO, esFilaDeCampana, type Estado } from "@/lib/admin/objetivos";
import { OPCIONES_CONOCIO, etiquetaConocio } from "@/lib/como-nos-conocio";
import { esCampanaDePrueba } from "@/lib/embudo-marcas";
import { borrarGasto, guardarGasto } from "./actions";

// CAMPAÑAS: ¿sirven los anuncios? (replanteo del admin, 2026-10-09). Une lo
// que eran Campaña y Adquisición, que contestaban lo mismo en dos pantallas.
//
// El orden es el de la lectura: primero el veredicto del plan y la tabla
// corta por campaña (gasto → cuentas → primer look → costo → volvieron), que
// es lo que decide. Lo demás, debajo y plegado: los objetivos del plan, el uso
// en la primera semana, el embudo paso por paso, lo que dicen que las trajo y
// la captura del gasto. Las definiciones viven en lib/admin/campana.ts; la
// carga en campana-datos.ts, compartida con el correo de las 8 y con Hoy.
// Postgres directo y sin RLS: se vuelve a exigir admin aquí.

export const dynamic = "force-dynamic";

const th = "px-3 py-2.5 font-medium";
const td = "px-3 py-2.5";
const inputCls =
  "min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:border-accent";
const DIA = /^\d{4}-\d{2}-\d{2}$/;

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}
function mxn(n: number | null): string {
  return n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`;
}

/** Una celda "n · % del paso anterior". */
function Paso({ n, de }: { n: number; de: number | null }) {
  return (
    <td className={`${td} text-center tabular text-ink`}>
      {n}
      {de != null && de > 0 ? <span className="block text-xs text-muted">{pct(n, de)}</span> : null}
    </td>
  );
}

const TONO: Record<Estado, string> = {
  bien: "text-success",
  vigilar: "text-warning",
  alarma: "text-error",
  "sin-datos": "text-muted",
};

/** La fila corta: lo que decide si una campaña sirve. */
function FilaCorta({ r }: { r: ResumenCampana }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className={`${td} text-left`}>
        <span className="font-medium text-ink">{r.campana === "—" ? "sin anuncio" : r.campana}</span>
        <span className="block text-xs text-muted">{r.fuente}</span>
      </td>
      <td className={`${td} text-right tabular text-ink`}>
        {mxn(r.costoMxn)}
        {r.clics != null ? <span className="block text-xs text-muted">{r.clics} clics</span> : null}
      </td>
      <td className={`${td} text-right tabular text-ink`}>{r.entraron}</td>
      <td className={`${td} text-right tabular text-ink`}>
        {r.primerLook}
        {r.entraron ? <span className="block text-xs text-muted">{pct(r.primerLook, r.entraron)}</span> : null}
      </td>
      <td className={`${td} text-right tabular text-ink`}>{mxn(costoPor(r, r.primerLook))}</td>
      <td className={`${td} text-right tabular text-ink`}>
        {r.ventanaCerrada ? `${r.volvieron} de ${r.ventanaCerrada}` : "—"}
        {r.ventanaCerrada ? (
          <span className="block text-xs text-muted">{pct(r.volvieron, r.ventanaCerrada)}</span>
        ) : r.primerLook ? (
          <span className="block text-xs text-muted">en su semana</span>
        ) : null}
      </td>
      <td className={`${td} text-right tabular text-ink`}>{r.seLoPusieron}</td>
      <td className={`${td} text-right tabular text-ink`}>${r.iaUsd.toFixed(2)}</td>
    </tr>
  );
}

/** La fila larga del embudo, paso por paso (plegada por defecto). */
function FilaLarga({ r }: { r: ResumenCampana }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className={`${td} text-left`}>
        <span className="font-medium text-ink">{r.campana}</span>
        <span className="block text-xs text-muted">{r.fuente}</span>
      </td>
      <Paso n={r.landing} de={r.clics} />
      <Paso n={r.boton} de={r.landing} />
      <td className={`${td} text-center tabular text-ink`}>
        {r.correoVisto ? `${r.correoOk} de ${r.correoVisto}` : "—"}
        {r.correoVisto ? <span className="block text-xs text-muted">{pct(r.correoOk, r.correoVisto)}</span> : null}
      </td>
      <Paso n={r.pidieronCodigo} de={r.clics} />
      <Paso n={r.entraron} de={r.pidieronCodigo || r.clics} />
      <td className={`${td} text-center tabular text-ink`}>
        {r.registro}
        {r.registrosGoogle != null ? (
          <span className="block text-xs text-muted" title="Lo que cuenta Google como registro">
            Google: {r.registrosGoogle}
          </span>
        ) : null}
      </td>
      {r.pasos.map((n, i) => (
        <Paso key={PASOS[i].etiqueta} n={n} de={i === 0 ? r.registro : r.pasos[i - 1]} />
      ))}
      <td className={`${td} text-center tabular text-ink`}>{fmtSegundos(r.ttvMedianaS)}</td>
    </tr>
  );
}

export default async function Campanas({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  await requireAdmin();
  const ahora = new Date();
  const q = (await searchParams).desde;
  const desde = q && DIA.test(q) ? q : await desdePorDefecto(ahora);
  const d = await cargarCampana(desde, ahora);
  const ayer = sumarDias(diaEnZona(ahora), -1);
  const estado = estadoDelExperimento(d.paro);
  const tonoParo = { bien: "border-success", mal: "border-error", neutro: "border-line" }[estado.tono];
  // Sin mis recorridos de prueba (utm_campaign "prueba-…", lib/embudo-marcas.ts).
  const resumen = d.resumen.filter((r) => !esCampanaDePrueba(r.campana));
  const deAnuncio = resumen.filter(esFilaDeCampana);
  const organicas = resumen.filter((r) => !esFilaDeCampana(r));
  const contestaron = d.filas.filter((f) => f.como_nos_conocio);
  const porRespuesta = [...OPCIONES_CONOCIO.map((o) => o.id), "omitido"]
    .map((id) => ({ id, n: contestaron.filter((f) => f.como_nos_conocio === id).length }))
    .filter((r) => r.n > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-ink">Campañas</h1>
        <p className="max-w-3xl text-sm text-muted">
          Del anuncio a si volvió, por campaña. El gasto y los clics se capturan abajo desde cada
          plataforma; todo lo demás sale de la base. Sin cuentas de admin ni de prueba.
        </p>
        <form className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <label htmlFor="desde">cuentas desde</label>
          <input id="desde" type="date" name="desde" defaultValue={d.desde} className={inputCls} />
          <button type="submit" className="min-h-10 rounded-lg border border-line px-3 text-ink hover:bg-bg">
            ver
          </button>
        </form>
      </header>

      <p className={`rounded-lg border bg-surface px-4 py-3 text-sm text-ink ${tonoParo}`}>
        <b>Criterio de paro:</b> {estado.frase}.{" "}
        <span className="text-xs text-muted">
          Acordado el 2026-09-10: de las primeras {PARO_MUESTRA} personas de anuncios con primer look, si
          menos de {PARO_MINIMO_VOLVIERON} vuelven en su primera semana, se para. Mira todas las
          cuentas de anuncios, no sólo las de la fecha elegida.
        </span>
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Por campaña</h2>
        {textoPaises(d.paises) ? (
          <p className="max-w-3xl text-sm text-ink">
            <b>Por país</b> (cuentas de anuncios): {textoPaises(d.paises)}.
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={`${th} text-left`}>Campaña</th>
                <th className={`${th} text-right`}>Gasto</th>
                <th className={`${th} text-right`} title="Cuentas que entraron">
                  Entraron
                </th>
                <th className={`${th} text-right`}>Primer look</th>
                <th className={`${th} text-right`} title={`Anuncio + IA, a ${MXN_POR_USD} MXN por dólar (supuesto; se cambia con MXN_POR_USD)`}>
                  Costo por primer look
                </th>
                <th className={`${th} text-right`} title={`Otro día dentro de sus primeros ${DIAS_VENTANA}, de quien ya los cumplió`}>
                  Volvieron
                </th>
                <th className={`${th} text-right`} title="Personas con al menos un fit check o 'me lo puse'">
                  Se lo pusieron
                </th>
                <th className={`${th} text-right`} title={`Lo que costó su IA en sus primeros ${DIAS_VENTANA} días`}>
                  IA (USD)
                </th>
              </tr>
            </thead>
            <tbody>
              {deAnuncio.map((r) => (
                <FilaCorta key={`${r.fuente}|${r.campana}`} r={r} />
              ))}
              {organicas.map((r) => (
                <FilaCorta key={`${r.fuente}|${r.campana}`} r={r} />
              ))}
              {resumen.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`${td} text-center text-muted`}>
                    Nadie entró desde {d.desde} y no hay gasto capturado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-xs text-muted">
          <b className="text-ink">Costo por primer look</b> = anuncio + IA a {MXN_POR_USD} MXN por dólar (supuesto; se
          cambia con MXN_POR_USD). Las filas sin anuncio son quien llegó por su cuenta o recomendada: el fondo
          contra el que se lee lo demás.
        </p>
      </section>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          Objetivos del plan P-03
        </summary>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          <p className="max-w-3xl text-xs text-muted">
            Lo que el plan escribió antes de gastar, contra lo que va pasando. Salvo el criterio de paro,
            los umbrales son estimados de confianza baja. Anuncios del {OBJETIVOS.anunciosDesde} al{" "}
            {OBJETIVOS.anunciosHasta}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className={`${th} text-left`}>Objetivo</th>
                  <th className={`${th} text-left`}>Meta</th>
                  <th className={`${th} text-left`}>Real</th>
                  <th className={`${th} text-left`}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {d.objetivos.map((o) => (
                  <tr key={o.clave} className="border-b border-line last:border-0">
                    <td className={`${td} text-left`}>
                      <span className="font-medium text-ink">{o.objetivo}</span>
                      {o.nota ? <span className="block text-xs text-muted">{o.nota}</span> : null}
                    </td>
                    <td className={`${td} text-left text-muted`}>{o.meta}</td>
                    <td className={`${td} text-left tabular text-ink`}>{o.real}</td>
                    <td className={`${td} text-left font-medium ${TONO[o.estado]}`}>{TEXTO_ESTADO[o.estado]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          Uso en su primera semana
          <span className="ml-2 text-xs font-normal text-muted">gente de anuncios con primer look</span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          {d.uso.personas === 0 ? (
            <p className="text-sm text-muted">Todavía nadie de anuncios llegó a su primer look.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-line p-3">
                <p className="text-xs text-muted">Personas</p>
                <p className="text-xl font-semibold tabular text-ink">{d.uso.personas}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-xs text-muted">Subieron ropa propia</p>
                <p className="text-xl font-semibold tabular text-ink">
                  {d.uso.conRopaPropia}{" "}
                  <span className="text-sm font-normal text-muted">{pct(d.uso.conRopaPropia, d.uso.personas)}</span>
                </p>
                <p className="text-xs text-muted">mediana: {d.uso.ropaPropiaMediana ?? "—"} prendas</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-xs text-muted">Looks por persona</p>
                <p className="text-xl font-semibold tabular text-ink">{d.uso.looksMediana ?? "—"}</p>
                <p className="text-xs text-muted">mediana</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-xs text-muted">Módulos que usaron</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-ink">
                  {MODULOS.map((m) => (
                    <li key={m.clave} className="flex justify-between gap-3">
                      <span>{m.etiqueta}</span>
                      <span className="tabular">{d.uso.modulos[m.clave]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <p className="text-sm text-ink">
            <b>Avatar</b> (cuentas desde {d.desde}): {textoAvatar(d.avatar)}.
          </p>
          {textoDispositivos(d.dispositivos) ? (
            <p className="text-sm text-ink">
              <b>Por aparato</b> (cuentas de anuncios): {textoDispositivos(d.dispositivos)}.
            </p>
          ) : null}
          {d.app ? (
            <p className="text-sm text-ink">
              <b>App instalada:</b> {pct(d.app.activas_instaladas, d.app.activas)} de las activas en 30 días la
              abren desde su ícono.{" "}
              <span className="text-xs text-muted">Decide si vale la pena mandar notificaciones.</span>
            </p>
          ) : null}
        </div>
      </details>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          El embudo paso por paso
          <span className="ml-2 text-xs font-normal text-muted">del clic al primer look, por campaña</span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          <p className="max-w-3xl text-xs text-muted">
            Bajo cada número, el % del paso anterior. <b className="text-ink">Landing</b>,{" "}
            <b className="text-ink">Botón</b> y <b className="text-ink">Correo</b> se cuentan desde el 2026-10-04 sin
            datos personales. <b className="text-ink">Registro</b> = dio su edad y es mayor, lo mismo que Google
            cuenta. El embudo de todo el onboarding, paso por paso y con tiempos, está en Embudo y retención.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className={`${th} text-left`}>Campaña</th>
                  <th className={`${th} text-center`}>Landing</th>
                  <th className={`${th} text-center`}>Botón</th>
                  <th className={`${th} text-center`}>Correo</th>
                  <th className={`${th} text-center`}>Pidieron código</th>
                  <th className={`${th} text-center`}>Entraron</th>
                  <th className={`${th} text-center`}>Registro</th>
                  {PASOS.map((p) => (
                    <th key={p.etiqueta} className={`${th} text-center`}>
                      {p.etiqueta}
                    </th>
                  ))}
                  <th className={`${th} text-center`} title="Mediana del tiempo al primer look">
                    TTV
                  </th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
                  <FilaLarga key={`${r.fuente}|${r.campana}`} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          Lo que dicen que las trajo
          <span className="ml-2 text-xs font-normal text-muted">
            {contestaron.length} de {d.filas.length} contestaron
          </span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          <p className="max-w-3xl text-xs text-muted">
            La pregunta del onboarding ve lo que el link no: la amiga que pasó el nombre, el video que
            alguien vio.
          </p>
          {porRespuesta.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {porRespuesta.map((r) => (
                <li key={r.id} className="rounded-full border border-line px-3 py-1 text-sm text-ink">
                  {etiquetaConocio(r.id)} <b className="tabular">{r.n}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Todavía nadie la ha contestado.</p>
          )}
        </div>
      </details>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          Capturar el gasto de cada plataforma
        </summary>
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
          <p className="max-w-3xl text-xs text-muted">
            Un renglón por día y campaña. La campaña se escribe igual que el <code>utm_campaign</code> del
            anuncio. Capturar otra vez el mismo día y campaña corrige lo anterior. El gasto de Google y Meta
            llega solo cada mañana; esto es para corregir o para una plataforma nueva.
          </p>
          <form action={guardarGasto} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              día
              <input type="date" name="dia" required defaultValue={ayer} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              campaña
              <input name="campana" required list="campanas-conocidas" placeholder="app-neutra" className={`${inputCls} w-44`} />
              <datalist id="campanas-conocidas">
                {d.campanasConocidas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              impresiones
              <input name="impresiones" inputMode="numeric" className={`${inputCls} w-24`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              clics
              <input name="clics" inputMode="numeric" required className={`${inputCls} w-20`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              costo MXN
              <input name="costo_mxn" inputMode="decimal" required className={`${inputCls} w-24`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              registros de Google
              <input name="registros_google" inputMode="numeric" className={`${inputCls} w-20`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              nota
              <input name="nota" maxLength={300} className={`${inputCls} w-48`} />
            </label>
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              Guardar
            </button>
          </form>
          {d.gasto.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className={`${th} text-left`}>Día</th>
                    <th className={`${th} text-left`}>Campaña</th>
                    <th className={`${th} text-center`}>Impresiones</th>
                    <th className={`${th} text-center`}>Clics</th>
                    <th className={`${th} text-center`}>MXN</th>
                    <th className={`${th} text-center`}>Registros Google</th>
                    <th className={`${th} text-left`}>Nota</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {d.gasto.map((g) => (
                    <tr key={`${g.dia}|${g.campana}`} className="border-b border-line last:border-0">
                      <td className={`${td} text-left tabular text-muted`}>{g.dia}</td>
                      <td className={`${td} text-left text-ink`}>{g.campana}</td>
                      <td className={`${td} text-center tabular text-ink`}>{g.impresiones ?? "—"}</td>
                      <td className={`${td} text-center tabular text-ink`}>{g.clics}</td>
                      <td className={`${td} text-center tabular text-ink`}>{mxn(g.costo_mxn)}</td>
                      <td className={`${td} text-center tabular text-ink`}>{g.registros_google ?? "—"}</td>
                      <td className={`${td} text-left text-muted`}>{g.nota ?? ""}</td>
                      <td className={`${td} text-right`}>
                        <form action={borrarGasto}>
                          <input type="hidden" name="dia" value={g.dia} />
                          <input type="hidden" name="campana" value={g.campana} />
                          <button type="submit" className="text-xs text-muted underline hover:text-error">
                            borrar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
