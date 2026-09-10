import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { origenDesdeDato } from "@/lib/origen";
import {
  DIAS_VENTANA,
  EVENTOS_QUE_NO_SON_VOLVER,
  MINIMO_PARA_VOLVER_TEXTO,
  SQL_ADQUISICION,
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
  const filas: FilaPerfilAdquisicion[] = crudas.map((r) => ({
    id: r.id,
    email: r.email,
    gender: r.gender,
    onboarding_step: Number(r.onboarding_step ?? 0),
    inicio: new Date(r.inicio).toISOString(),
    dia_inicio: r.dia_inicio,
    dias: r.dias,
    origen: r.origen,
  }));
  const ahora = new Date();
  const resumen = resumirAdquisicion(filas, ahora);
  const recientes = filas.slice(0, 30);
  const conRastro = filas.filter((f) => origenDesdeDato(f.origen)).length;

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
