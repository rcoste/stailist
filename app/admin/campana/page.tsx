import { requireAdmin } from "@/lib/auth";
import { DIAS_VENTANA, diaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { fmtSegundos } from "@/lib/admin/embudo-tiempos";
import {
  MXN_POR_USD,
  PARO_MINIMO_VOLVIERON,
  PARO_MUESTRA,
  PASOS,
  costoPor,
  textoDispositivos,
  textoParo,
  type ResumenCampana,
} from "@/lib/admin/campana";
import { cargarCampana, desdePorDefecto } from "@/lib/admin/campana-datos";
import { MODULOS, OBJETIVOS, TEXTO_ESTADO, type Estado } from "@/lib/admin/objetivos";
import { borrarGasto, guardarGasto } from "./actions";

// LA CAMPAÑA: del clic a "volvió", por campaña. Las definiciones viven en
// lib/admin/campana.ts (y las de "volvió" en adquisicion.ts); la carga, en
// campana-datos.ts, que comparte con el correo diario para que los dos digan
// lo mismo. Postgres directo y sin RLS: se vuelve a exigir admin aquí aunque
// el layout ya lo haga.

export const dynamic = "force-dynamic";

const th = "px-3 py-2.5 font-medium";
const td = "px-3 py-2.5";
const inputCls =
  "min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:border-accent";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}
function mxn(n: number | null): string {
  return n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`;
}

/** Una celda "n · % del paso anterior": dónde se cae la gente, de un vistazo. */
function Paso({ n, de }: { n: number; de: number | null }) {
  return (
    <td className={`${td} text-center tabular text-ink`}>
      {n}
      {de != null && de > 0 ? <span className="block text-xs text-muted">{pct(n, de)}</span> : null}
    </td>
  );
}

/** El estado siempre en palabras; el color sólo acompaña. */
const TONO: Record<Estado, string> = {
  bien: "text-success",
  vigilar: "text-warning",
  alarma: "text-error",
  "sin-datos": "text-muted",
};

function Fila({ r }: { r: ResumenCampana }) {
  const pasos = r.pasos;
  return (
    <tr className="border-b border-line last:border-0">
      <td className={`${td} text-left`}>
        <span className="font-medium text-ink">{r.campana}</span>
        <span className="block text-xs text-muted">{r.fuente}</span>
      </td>
      <td className={`${td} text-center tabular text-ink`}>
        {r.clics ?? "—"}
        <span className="block text-xs text-muted">{mxn(r.costoMxn)}</span>
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
      {pasos.map((n, i) => (
        <Paso key={PASOS[i].etiqueta} n={n} de={i === 0 ? r.registro : pasos[i - 1]} />
      ))}
      <td className={`${td} text-center tabular text-ink`}>{fmtSegundos(r.ttvMedianaS)}</td>
      <td className={`${td} text-center tabular text-ink`}>
        {r.ventanaCerrada ? `${r.volvieron} de ${r.ventanaCerrada}` : "—"}
        {r.ventanaCerrada ? <span className="block text-xs text-muted">{pct(r.volvieron, r.ventanaCerrada)}</span> : null}
      </td>
      <td className={`${td} text-center tabular text-ink`}>{r.seLoPusieron}</td>
      <td className={`${td} text-center tabular text-ink`}>
        ${r.iaUsd.toFixed(2)}
        {r.entraron ? <span className="block text-xs text-muted">${(r.iaUsd / r.entraron).toFixed(2)} c/u</span> : null}
      </td>
      <td className={`${td} text-center tabular text-ink`}>
        {mxn(costoPor(r, r.primerLook))}
        <span className="block text-xs text-muted">volvió: {mxn(costoPor(r, r.volvieron))}</span>
      </td>
    </tr>
  );
}

export default async function AdminCampana({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  await requireAdmin();
  const ahora = new Date();
  const q = (await searchParams).desde;
  const desde = q && DIA.test(q) ? q : await desdePorDefecto(ahora);
  const d = await cargarCampana(desde, ahora);
  const ayer = sumarDias(diaEnZona(ahora), -1);
  const paroTono =
    d.paro.estado === "no-pasa" ? "border-error text-error" : d.paro.estado === "pasa" ? "border-success" : "border-line";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-semibold text-ink">Campaña</h1>
        <p className="max-w-3xl text-sm text-muted">
          Del clic a si volvió, por campaña. Clics, costo y los registros que dice Google
          se capturan abajo, a mano, desde Google Ads; todo lo demás sale de la base. El
          mismo resumen llega por correo cada mañana a las 8. Cuentas de admin y de prueba
          fuera.
        </p>
        <form className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <label htmlFor="desde">desde</label>
          <input id="desde" type="date" name="desde" defaultValue={d.desde} className={inputCls} />
          <button type="submit" className="min-h-10 rounded-lg border border-line px-3 text-ink hover:bg-bg">
            ver
          </button>
        </form>
      </div>

      <div className={`flex flex-col gap-1 rounded-lg border bg-surface p-4 ${paroTono}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Criterio de paro</h2>
        <p className="text-sm font-medium text-ink">{textoParo(d.paro)}</p>
        <p className="text-xs text-muted">
          Acordado el 2026-09-10: de las primeras {PARO_MUESTRA} personas de anuncios con primer
          look, si menos de {PARO_MINIMO_VOLVIERON} vuelven en su primera semana, se para y no se
          escala. Mira todas las cuentas de anuncios, no sólo las del rango de fechas.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Objetivos del plan P-03</h2>
        <p className="max-w-3xl text-xs text-muted">
          Lo que el plan escribió antes de gastar, contra lo que va pasando. Salvo el criterio
          de paro (un acuerdo), los umbrales son estimados de confianza baja: la primera
          semana de datos los pone a prueba. Anuncios del {OBJETIVOS.anunciosDesde} al{" "}
          {OBJETIVOS.anunciosHasta}. El CTR necesita las impresiones del día, abajo.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[900px] border-collapse text-sm">
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

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Uso en su primera semana
        </h2>
        <p className="max-w-3xl text-xs text-muted">
          Gente de anuncios que llegó a su primer look, en sus primeros {DIAS_VENTANA} días. Sin
          meta a propósito: la primera semana fija la referencia. Se lee junto a “volvió”: si no
          vuelven, ¿subieron su ropa, vieron más de un look, descubrieron algo más?{" "}
          <b className="text-ink">Ropa propia</b> = prendas de foto, no los básicos del checklist.
        </p>
        {d.uso.personas === 0 ? (
          <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
            Todavía nadie de anuncios llegó a su primer look.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs text-muted">Personas</p>
              <p className="text-h2 font-semibold tabular text-ink">{d.uso.personas}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs text-muted">Subieron ropa propia</p>
              <p className="text-h2 font-semibold tabular text-ink">
                {d.uso.conRopaPropia}{" "}
                <span className="text-sm font-normal text-muted">{pct(d.uso.conRopaPropia, d.uso.personas)}</span>
              </p>
              <p className="text-xs text-muted">mediana: {d.uso.ropaPropiaMediana ?? "—"} prendas</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs text-muted">Looks por persona</p>
              <p className="text-h2 font-semibold tabular text-ink">{d.uso.looksMediana ?? "—"}</p>
              <p className="text-xs text-muted">mediana</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
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
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">El embudo</h2>
        {/* La pregunta por la que las campañas incluyen computadoras. */}
        {textoDispositivos(d.dispositivos) ? (
          <p className="max-w-3xl text-sm text-ink">
            <b>Por aparato</b> (cuentas de anuncios): {textoDispositivos(d.dispositivos)}.{" "}
            <span className="text-xs text-muted">Se guarda desde el 2026-10-01.</span>
          </p>
        ) : null}
        <p className="max-w-3xl text-xs text-muted">
          Bajo cada número, el % del paso anterior. <b className="text-ink">Pidieron código</b> =
          personas nuevas, una vez al día (se cuenta desde el 2026-09-23).{" "}
          <b className="text-ink">Registro</b> = dio su edad y es mayor, lo mismo que Google
          cuenta. <b className="text-ink">Volvió</b> = otro día dentro de sus primeros{" "}
          {DIAS_VENTANA}, sólo de quien ya los cumplió. <b className="text-ink">IA</b> = lo que
          costó en sus primeros {DIAS_VENTANA} días. <b className="text-ink">Costo</b> = anuncio +
          IA a {MXN_POR_USD} MXN por dólar (supuesto; se cambia con MXN_POR_USD).
        </p>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={`${th} text-left`}>Campaña</th>
                <th className={`${th} text-center`}>Clics · MXN</th>
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
                <th className={`${th} text-center`}>Volvió</th>
                <th className={`${th} text-center`} title="Personas con al menos un fit check o 'me lo puse'">
                  Se lo puso
                </th>
                <th className={`${th} text-center`}>IA (USD)</th>
                <th className={`${th} text-center`}>Costo por primer look</th>
              </tr>
            </thead>
            <tbody>
              {d.resumen.map((r) => (
                <Fila key={`${r.fuente}|${r.campana}`} r={r} />
              ))}
              {d.resumen.length === 0 ? (
                <tr>
                  <td colSpan={10 + PASOS.length} className={`${td} text-center text-muted`}>
                    Nadie entró desde {d.desde} y no hay gasto capturado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Capturar lo de cada plataforma
        </h2>
        <p className="max-w-3xl text-xs text-muted">
          Un renglón por día y campaña, de Google Ads, Meta y TikTok. La campaña se escribe
          igual que el <code>utm_campaign</code> de la URL del anuncio; en Instagram empieza con{" "}
          <code>ig-</code> y en TikTok con <code>tt-</code>, para que el mismo enfoque no mezcle
          su gasto entre canales. Capturar otra vez el mismo día y
          campaña corrige lo anterior. <b className="text-ink">Registros de Google</b> es
          opcional y sirve para comparar: si Google ve muchos menos que la columna Registro, la
          atribución se está perdiendo entre navegadores y se decide con este panel.
        </p>
        <form action={guardarGasto} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            día
            <input type="date" name="dia" required defaultValue={ayer} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            campaña
            <input
              name="campana"
              required
              list="campanas-conocidas"
              placeholder="hombres-diario"
              className={`${inputCls} w-44`}
            />
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
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
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
    </div>
  );
}
