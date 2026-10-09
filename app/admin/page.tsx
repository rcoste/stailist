import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { banderaDe } from "@/lib/lugar";
import { PARO_MINIMO_VOLVIERON, PARO_MUESTRA } from "@/lib/admin/campana";
import { OBJETIVOS } from "@/lib/admin/objetivos";
import { costoPorPrimerLookTotal, diasParaLaLectura, estadoDelExperimento, nombreDelDia } from "@/lib/admin/hoy";
import { cargarHoy } from "@/lib/admin/hoy-datos";

// HOY: ¿cómo va? La primera pantalla del admin desde el replanteo del
// 2026-10-09 (el porqué, en lib/admin/hoy.ts). Postgres directo y sin RLS: se
// vuelve a exigir admin aunque el layout ya lo haga.

export const dynamic = "force-dynamic";

const mxn = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`);

export default async function Hoy() {
  await requireAdmin();
  const d = await cargarHoy();
  const estado = estadoDelExperimento(d.paro);
  const faltan = diasParaLaLectura(d.hoy);
  const costo = costoPorPrimerLookTotal(d.resumen);
  const [hoy, ayer] = d.dias;
  const tono = { bien: "border-success", mal: "border-error", neutro: "border-line" }[estado.tono];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Hoy</h1>
        <p className="text-sm text-muted">
          {new Date(`${d.hoy}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
          {" · "}
          {faltan > 0 ? `la lectura del plan es el ${OBJETIVOS.anunciosHasta.slice(8)} de octubre, en ${faltan} día${faltan === 1 ? "" : "s"}` : "la lectura del plan ya llegó"}
        </p>
      </header>

      {d.alarmas.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border border-error bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-error">Una señal dejó de llegar</h2>
          {d.alarmas.map((a) => (
            <p key={a.nombre} className="text-sm text-ink">
              <b>{a.nombre}</b>: {a.detalle} <span className="text-muted">Si está roto se pierde {a.cuesta}.</span>
            </p>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">El experimento</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato titulo="primeros looks de anuncios" valor={`${d.paro.conPrimerLook} de ${PARO_MUESTRA}`} nota="la muestra del plan" />
          <Dato
            titulo="volvieron en su semana"
            valor={`${d.paro.volvieron} de ${d.paro.conPrimerLook}`}
            nota={`${d.paro.cerradas} ya cerraron su semana · la regla pide ${PARO_MINIMO_VOLVIERON}`}
          />
          <Dato titulo="costo por primer look" valor={mxn(costo)} nota="anuncio + IA, todas las campañas" />
          <Dato
            titulo="gasto de IA ayer"
            valor={`$${d.ia[1].usd.toFixed(2)}`}
            nota={d.ia[1].top ? `${d.ia[1].llamadas} llamadas · ${d.ia[1].top.correo} $${d.ia[1].top.usd.toFixed(2)}` : `${d.ia[1].llamadas} llamadas`}
          />
        </div>
        <p className={`rounded-lg border bg-surface px-4 py-3 text-sm text-ink ${tono}`}>
          <b>Criterio de paro:</b> {estado.frase}.{" "}
          <Link href="/admin/campanas" className="text-muted underline underline-offset-2 hover:text-ink">
            ver por campaña
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Desde ayer</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="px-4 py-2 text-left font-medium" />
                <th className="px-3 py-2 text-right font-medium">hoy</th>
                <th className="px-3 py-2 text-right font-medium">ayer</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <FilaDia etiqueta="empezaron el onboarding" hoy={`${hoy.nuevas} (${hoy.nuevasDeAnuncio} de anuncios)`} ayer={`${ayer.nuevas} (${ayer.nuevasDeAnuncio} de anuncios)`} />
              <FilaDia etiqueta="llegaron a su primer look" hoy={String(hoy.primerLook)} ayer={String(ayer.primerLook)} />
              <FilaDia etiqueta="subieron ropa con foto" hoy={String(hoy.subieronFotos)} ayer={String(ayer.subieronFotos)} />
              <FilaDia etiqueta="volvieron" hoy={String(d.volvieron[0].quienes.length)} ayer={String(d.volvieron[1].quienes.length)} />
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Quién volvió</h2>
        {d.volvieron.every((v) => v.quienes.length === 0) ? (
          <p className="text-sm text-muted">Nadie volvió ni hoy ni ayer.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {d.volvieron.flatMap((v) =>
              v.quienes.map((q) => (
                <li key={`${v.dia}|${q.correo}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                  <span className="w-10 shrink-0 text-xs text-muted">{nombreDelDia(v.dia, d.hoy)}</span>
                  <span className="font-semibold text-ink">{q.correo}</span>
                  <span className="rounded-full border border-success px-1.5 text-[11px] font-semibold text-success">
                    {q.primeraVez ? "volvió" : "volvió otra vez"} · {q.aLosDias === 1 ? "al día siguiente" : `a los ${q.aLosDias} días`}
                  </span>
                  <span className="text-muted">{q.origen}</span>
                  {q.cuentaParaParo ? <span className="text-xs text-muted">· cuenta para el criterio</span> : null}
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      {d.dias.map((dia) => (
        <section key={dia.dia} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Quién llegó {nombreDelDia(dia.dia, d.hoy)}
          </h2>
          {dia.llegaron.length === 0 ? (
            <p className="text-sm text-muted">Nadie empezó el onboarding {nombreDelDia(dia.dia, d.hoy)}.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {dia.llegaron.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                  <span className="w-5 shrink-0" title={l.lugar ?? "sin país"}>
                    {banderaDe(l.pais)}
                  </span>
                  <Link href={`/admin/usuarios/${l.id}`} className="font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                    {l.correo}
                  </Link>
                  <span className={l.primerLook ? "text-ink" : "text-muted"}>{l.paso}</span>
                  {l.fotos > 0 ? <span className="text-muted">· subió {l.fotos} prenda{l.fotos === 1 ? "" : "s"} con foto</span> : null}
                  <span className="text-xs text-muted">· {l.origen}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="text-xs text-muted">
        Lo mismo llega por correo a las 8 de la mañana. Sin cuentas de admin ni de prueba. “Volvió” es
        otro día de la Ciudad de México y al menos 4 horas después de empezar; el criterio de paro mira
        a las primeras {PARO_MUESTRA} personas de anuncios con primer look.
      </p>
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5">
      <span className="text-xs text-muted">{titulo}</span>
      <span className="text-xl font-bold tabular-nums text-ink">{valor}</span>
      {nota ? <span className="text-[11px] text-muted">{nota}</span> : null}
    </div>
  );
}

function FilaDia({ etiqueta, hoy, ayer }: { etiqueta: string; hoy: string; ayer: string }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 text-ink">{etiqueta}</td>
      <td className="px-3 py-2 text-right text-ink">{hoy}</td>
      <td className="px-3 py-2 text-right text-muted">{ayer}</td>
    </tr>
  );
}
