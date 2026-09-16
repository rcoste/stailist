import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { origenDesdeDato } from "@/lib/origen";
import { OPCIONES_CONOCIO, etiquetaConocio } from "@/lib/como-nos-conocio";
import { SQL_MAZO, resumirMazo, type FilaMazo } from "@/lib/admin/mazo";
import {
  DIAS_VENTANA,
  EVENTOS_QUE_NO_SON_VOLVER,
  MINIMO_PARA_VOLVER_TEXTO,
  SQL_ADQUISICION,
  SQL_APP_INSTALADA,
  ZONA,
  campanaDe,
  fuenteDe,
  resumirAdquisicion,
  ventanaCerrada,
  volvioEn7Dias,
  type FilaPerfilAdquisicion,
} from "@/lib/admin/adquisicion";

// LA PANTALLA DE LA CAMPAÑA: de dónde llegó cada cuenta y si volvió.
// Las definiciones y la consulta viven en lib/admin/adquisicion.ts.
//
// POR QUÉ POSTGRES DIRECTO Y NO SUPABASE JS: la pregunta es por días con
// actividad de cada persona, y eso sale de events + items + outfits. Por la API
// de Supabase eso son miles de filas que PostgREST corta en 1000 sin avisar —
// el panel se vería bien y contaría mal. En SQL es una agregación. Sin RLS, así
// que se vuelve a exigir admin aquí aunque el layout ya lo haga: si esta
// página algún día se mueve de carpeta, no puede quedar abierta.

export const dynamic = "force-dynamic";

const th = "px-3 py-2.5 font-medium";
const td = "px-3 py-2.5";

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${n} de ${d} (${Math.round((n / d) * 100)}%)`;
}

export default async function AdminAdquisicion() {
  await requireAdmin();
  const crudas = await withDb(async (c) => (await c.query(SQL_ADQUISICION, [EVENTOS_QUE_NO_SON_VOLVER])).rows);
  const mazo = resumirMazo(
    (await withDb(async (c) => (await c.query(SQL_MAZO)).rows)) as FilaMazo[]
  );
  const app = (await withDb(async (c) => (await c.query(SQL_APP_INSTALADA)).rows[0])) as
    | { cuentas: number; instaladas: number; activas: number; activas_instaladas: number }
    | undefined;
  const filas: FilaPerfilAdquisicion[] = crudas.map((r) => ({
    id: r.id,
    email: r.email,
    gender: r.gender,
    onboarding_step: Number(r.onboarding_step ?? 0),
    inicio: new Date(r.inicio).toISOString(),
    dia_inicio: r.dia_inicio,
    dias: r.dias,
    origen: r.origen,
    como_nos_conocio: r.como_nos_conocio ?? null,
  }));
  const ahora = new Date();
  const resumen = resumirAdquisicion(filas, ahora);
  const recientes = filas.slice(0, 30);
  const conRastro = filas.filter((f) => origenDesdeDato(f.origen)).length;
  // Lo que dicen: sólo quien vio la pregunta (existe desde v0.2.330.0).
  const contestaron = filas.filter((f) => f.como_nos_conocio);
  const porRespuesta = [...OPCIONES_CONOCIO.map((o) => o.id), "omitido"]
    .map((id) => ({ id, n: contestaron.filter((f) => f.como_nos_conocio === id).length }))
    .filter((r) => r.n > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-semibold text-ink">Adquisición</h1>
        <p className="max-w-3xl text-sm text-muted">
          De dónde llegó cada cuenta y si volvió. Google y TikTok cuentan clics y
          registros; lo que decide si una campaña sirve es la última columna.{" "}
          <b className="text-ink">Volvió</b> = hizo algo otro día dentro de sus
          primeros {DIAS_VENTANA} (hora CDMX, y al menos {MINIMO_PARA_VOLVER_TEXTO}{" "}
          después de arrancar), y sólo cuenta a quien ya cumplió esos {DIAS_VENTANA}{" "}
          días. Cuentas de admin y de prueba fuera. {conRastro} de {filas.length}{" "}
          con origen guardado (se guarda desde el 2026-09-10).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Por fuente y campaña
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={`${th} text-left`}>Fuente</th>
                <th className={`${th} text-left`}>Campaña</th>
                <th className={`${th} text-center`}>Cuentas</th>
                <th className={`${th} text-center`} title="hombres / mujeres">
                  H / M
                </th>
                <th className={`${th} text-center`}>Primer look</th>
                <th className={`${th} text-center`} title={`De quienes ya cumplieron ${DIAS_VENTANA} días`}>
                  Volvió en {DIAS_VENTANA} días
                </th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={`${r.fuente}|${r.campana}`} className="border-b border-line last:border-0">
                  <td className={`${td} text-left font-medium text-ink`}>{r.fuente}</td>
                  <td className={`${td} text-left text-muted`}>{r.campana}</td>
                  <td className={`${td} text-center tabular text-ink`}>{r.cuentas}</td>
                  <td className={`${td} text-center tabular text-muted`}>
                    {r.hombres} / {r.mujeres}
                  </td>
                  <td className={`${td} text-center tabular text-ink`}>{pct(r.primerLook, r.cuentas)}</td>
                  <td className={`${td} text-center tabular text-ink`}>
                    {pct(r.volvieron, r.ventanaCerrada)}
                    {r.cuentas > r.ventanaCerrada ? (
                      <span className="block text-xs text-muted">
                        {r.cuentas - r.ventanaCerrada} aún en su semana
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {resumen.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${td} text-center text-muted`}>
                    Todavía no hay cuentas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          App instalada
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          Quién abre stailist desde su ícono y no desde el navegador. Decide si vale la pena
          mandar notificaciones: en iPhone sólo le llegan a quien la instaló. Se mide desde el
          2026-09-16 y cuenta a quien la ABRIÓ instalada desde entonces, así que los primeros
          días sube sin que nadie instale nada.
        </p>
        {app ? (
          <p className="text-sm text-ink">
            <b className="tabular">{pct(app.activas_instaladas, app.activas)}</b> de las activas en
            30 días · <span className="tabular">{pct(app.instaladas, app.cuentas)}</span> de todas
            las cuentas
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Lo que dicen que las trajo
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          La pregunta del onboarding, que ve lo que el link no: la amiga que pasó el
          nombre, el video que alguien vio y escribió a mano. {contestaron.length} de{" "}
          {filas.length} cuentas la vieron (existe desde el 2026-09-16).
        </p>
        {porRespuesta.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {porRespuesta.map((r) => (
              <li key={r.id} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink">
                {etiquetaConocio(r.id)} <b className="tabular">{r.n}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Todavía nadie la ha contestado.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          El mazo de swipes
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          ¿Las cartas atrevidas del arranque espantan a alguien? Si hay abandono o escape temprano
          en hombres, se cambia sólo la primera vuelta (una carta clásica por Streetwear o
          Hipster). Si no, el orden se queda: rechazar una carta también mide. Llegó = ya dio su
          edad, que se pide justo antes. Medido el 2026-09-16: 7 de 7 hombres terminaron, 1 usó el
          escape; vale la pena repetirlo con ~20 hombres de la campaña.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {mazo.map((g) => (
            <div key={g.genero} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
              <p className="text-sm text-ink">
                <b className="capitalize">{g.genero === "hombre" ? "hombres" : "mujeres"}</b> ·
                terminaron <span className="tabular">{pct(g.terminaron, g.llegaron)}</span> · escape{" "}
                <span className="tabular">{pct(g.escape, g.conVotos)}</span> · likes{" "}
                <span className="tabular">{g.pctLikes === null ? "—" : `${g.pctLikes}%`}</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className={`${th} text-left`}>#</th>
                      <th className={`${th} text-left`}>Carta</th>
                      <th className={`${th} text-center`}>Likes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.cartas.map((c) => (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className={`${td} text-left tabular text-muted`}>{c.posicion}</td>
                        <td className={`${td} text-left text-ink`}>{c.nombre}</td>
                        <td className={`${td} text-center tabular text-ink`}>
                          {c.votos ? `${c.likes} de ${c.votos}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Últimas 30 cuentas
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={`${th} text-left`}>Arrancó</th>
                <th className={`${th} text-left`}>Cuenta</th>
                <th className={`${th} text-left`}>Fuente</th>
                <th className={`${th} text-left`}>Campaña</th>
                <th className={`${th} text-left`}>Dijo</th>
                <th className={`${th} text-center`}>Primer look</th>
                <th className={`${th} text-center`}>Volvió</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((f) => {
                const o = origenDesdeDato(f.origen);
                const cerrada = ventanaCerrada(f.dia_inicio, ahora);
                const volvio = volvioEn7Dias(f.dia_inicio, f.dias);
                return (
                  <tr key={f.id} className="border-b border-line last:border-0">
                    <td className={`${td} text-left tabular text-muted`}>
                      {new Date(f.inicio).toLocaleDateString("es-MX", {
                        timeZone: ZONA,
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className={`${td} text-left`}>
                      <Link href={`/admin/usuarios/${f.id}`} className="font-medium text-ink underline">
                        {f.email ?? f.id.slice(0, 8)}
                      </Link>
                      <span className="block text-xs text-muted">{f.gender ?? "sin género"}</span>
                    </td>
                    <td className={`${td} text-left text-ink`}>{fuenteDe(o)}</td>
                    <td className={`${td} text-left text-muted`}>{campanaDe(o)}</td>
                    <td className={`${td} text-left text-ink`}>{etiquetaConocio(f.como_nos_conocio)}</td>
                    <td className={`${td} text-center`}>{f.onboarding_step >= 5 ? "sí" : "—"}</td>
                    <td className={`${td} text-center`}>
                      {volvio ? "sí" : cerrada ? "no" : <span className="text-muted">en su semana</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
