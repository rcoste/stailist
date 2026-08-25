import { createClient } from "@/lib/supabase/server";
import { formatoUsd } from "@/lib/proveedores/precios";
import {
  fmtMs,
  resumenPorTarea,
  totales,
  type AiCall,
  type ResumenTarea,
} from "@/lib/ai-calls";
import { TAREAS_SIN_MEDIR } from "@/lib/cobertura-recibos";

// EL PANEL DE LAS LLAMADAS DE IA: cuánto tardan, qué cuestan y cuándo truenan.
//
// POR QUÉ EXISTE, con el caso que lo motivó: el 2026-08-13 se descubrió que el
// precalentado de imágenes de esenciales llevaba DOS SEMANAS roto en
// producción, pagando renders que se abortaban solos. No lo cazó ninguna
// alerta: lo cazó una revisión de código, de casualidad. La tabla `ai_calls`
// ya existía y nadie la leía.
//
// Un panel de admin no habría evitado ese bug —la llamada "salía bien"— pero sí
// habría enseñado el síntoma: un montón de renders por visita para una pantalla
// que seguía en gris.
//
// LA REGLA DE ESTA PANTALLA: no presumir de saber más de lo que sabe. Enseña
// arriba qué NO está instrumentado, porque una pantalla de observabilidad que
// calla sus huecos es peor que ninguna — se lee como "todo está bien" cuando
// dice "no estoy mirando".

export const dynamic = "force-dynamic";

// Tope de filas a traer. La tabla no tiene retención automática todavía; con el
// volumen real (decenas al día) esto cubre semanas, y evita que la pantalla se
// vuelva impagable el día que no.
const TOPE = 2000;

function Stat({
  label,
  value,
  hint,
  alerta,
}: {
  label: string;
  value: string;
  hint?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border bg-surface p-4 ${
        alerta ? "border-error" : "border-line"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className={`text-h1 font-semibold ${alerta ? "text-error" : "text-ink"}`}>
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export default async function AdminIA() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_calls")
    .select(
      "created_at, tarea, proveedor, modelo, version, ms, tokens_entrada, tokens_salida, costo_usd, ok"
    )
    .order("created_at", { ascending: false })
    .limit(TOPE);

  const filas = (data ?? []) as AiCall[];
  const t = totales(filas, Date.now());
  const porTarea = resumenPorTarea(filas);
  const ultimosFallos = filas.filter((f) => !f.ok).slice(0, 12);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Llamadas de IA</h1>
        <p className="text-sm text-muted">
          Cuánto tardan, qué cuestan y cuándo truenan. Últimas{" "}
          <span className="tabular">{filas.length}</span> llamadas registradas.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-error bg-surface p-4 text-sm text-error">
          No pude leer los recibos: {error.message}
        </p>
      ) : null}

      {/* El hueco, ARRIBA y no al pie: mientras queden tareas sin medir, este
          panel es una vista parcial y decir eso es parte del dato. */}
      {TAREAS_SIN_MEDIR.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-warning bg-surface p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink">
            Esto todavía no se ve aquí
          </span>
          <p className="text-sm text-muted">
            <span className="tabular">{TAREAS_SIN_MEDIR.length}</span>{" "}
            {TAREAS_SIN_MEDIR.length === 1 ? "camino habla" : "caminos hablan"} con un
            modelo sin pasar por la puerta común, así que no dejan recibo. Sus tiempos,
            su costo y sus fallos no están en los números de abajo.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {TAREAS_SIN_MEDIR.map((t) => (
              <li
                key={t}
                className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Gasto 24h"
          value={formatoUsd(t.costo24h)}
          hint={`${t.llamadas24h} llamadas`}
        />
        <Stat
          label="Gasto registrado"
          value={formatoUsd(t.costo)}
          hint={`${t.llamadas} llamadas`}
        />
        <Stat
          label="Fallos"
          value={`${t.tasaFallo}%`}
          hint={`${t.fallos} de ${t.llamadas}`}
          alerta={t.tasaFallo >= 5}
        />
        <Stat
          label="Tareas medidas"
          value={String(porTarea.length)}
          hint={
            TAREAS_SIN_MEDIR.length > 0
              ? `${TAREAS_SIN_MEDIR.length} sin instrumentar`
              : "todas instrumentadas"
          }
        />
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-muted">
          Todavía no hay recibos. Aparecen solos en cuanto alguien use la app.
        </p>
      ) : (
        <>
          <TablaTareas filas={porTarea} />
          {ultimosFallos.length > 0 ? <TablaFallos filas={ultimosFallos} /> : null}
        </>
      )}
    </div>
  );
}

// Una fila por tarea. La mediana es la espera típica; el p95 es la de quien
// tuvo mala suerte, que es la que decide si una pantalla necesita aviso de
// "esto tarda". El tiempo de los fallos va aparte a propósito.
function TablaTareas({ filas }: { filas: ResumenTarea[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Por tarea
      </h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-3 py-2.5 text-left font-medium">Tarea</th>
              <th className="px-3 py-2.5 text-center font-medium">Llamadas</th>
              <th className="px-3 py-2.5 text-center font-medium" title="Mediana de las que salieron bien">
                Típico
              </th>
              <th className="px-3 py-2.5 text-center font-medium" title="El 5% más lento">
                p95
              </th>
              <th className="px-3 py-2.5 text-center font-medium">Fallos</th>
              <th className="px-3 py-2.5 text-center font-medium" title="Costo medio por llamada con precio conocido">
                Por llamada
              </th>
              <th className="px-3 py-2.5 text-center font-medium">Total</th>
              <th className="px-3 py-2.5 text-left font-medium">Modelo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.tarea} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5 text-left font-medium text-ink">{f.tarea}</td>
                <td className="px-3 py-2.5 text-center tabular text-ink">{f.llamadas}</td>
                <td className="px-3 py-2.5 text-center tabular text-ink">
                  {fmtMs(f.msMediana)}
                </td>
                <td className="px-3 py-2.5 text-center tabular text-muted">
                  {fmtMs(f.msP95)}
                </td>
                <td className="px-3 py-2.5 text-center tabular">
                  {f.fallos === 0 ? (
                    <span className="text-muted/50">—</span>
                  ) : (
                    <span className={f.tasaFallo >= 5 ? "text-error" : "text-warning"}>
                      {f.fallos} ({f.tasaFallo}%)
                      {f.msMedianaFallo > 0 ? (
                        <span className="block text-[11px] text-muted">
                          truena en {fmtMs(f.msMedianaFallo)}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center tabular text-muted">
                  {formatoUsd(f.costoPorLlamada)}
                </td>
                <td className="px-3 py-2.5 text-center tabular text-ink">
                  {formatoUsd(f.costoTotal)}
                </td>
                <td className="px-3 py-2.5 text-left text-[12px] text-muted">
                  {f.modelos.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Los fallos recientes, uno por renglón. Sin esto, la tasa de fallo dice que
// algo truena pero no qué — y el "qué" es lo único accionable.
function TablaFallos({ filas }: { filas: AiCall[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Últimos fallos
      </h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-3 py-2.5 text-left font-medium">Cuándo</th>
              <th className="px-3 py-2.5 text-left font-medium">Tarea</th>
              <th className="px-3 py-2.5 text-left font-medium">Modelo</th>
              <th className="px-3 py-2.5 text-center font-medium">Tardó</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-left text-muted">
                  {new Date(f.created_at).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-3 py-2.5 text-left font-medium text-ink">{f.tarea}</td>
                <td className="px-3 py-2.5 text-left text-[12px] text-muted">{f.modelo}</td>
                <td className="px-3 py-2.5 text-center tabular text-muted">
                  {fmtMs(f.ms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
