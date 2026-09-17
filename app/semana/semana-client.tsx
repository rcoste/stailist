"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { fmtFechaLocal } from "@/components/weather-picker";
import { WORK_DRESS_CODES, type WorkDressCode } from "@/lib/dress-code";
import {
  diasOfrecidos,
  planInicial,
  planPorId,
  planesDelDia,
  type EstadoDia,
  type PlanSemanaId,
} from "@/lib/semana";

type Prenda = { id: string; nombre: string; imagen: string | null };
type Look = { id: string; nombre: string; prendas: Prenda[] };
type DiaServidor = { estado: EstadoDia; ocasion: string | null; look?: Look };

/** Lo que la persona eligió para un día que todavía no tiene look. */
type Eleccion = { activo: boolean; ocasion: PlanSemanaId };

/** El nombre del plan de un día ya pedido (filas viejas: su ocasión). */
const etiquetaPlan = (id: string | null) => planPorId(id)?.label ?? "";

/** La ubicación, para el pronóstico de cada día. Sin permiso se arma sin clima. */
function dondeEstoy(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 4000, maximumAge: 15 * 60 * 1000 }
    );
  });
}

/** El ancho de la casilla, para que la fecha no se corra en los días ya pedidos. */
function Hueco() {
  return <span aria-hidden className="w-6 shrink-0" />;
}

async function leerSemana(
  hoy: string,
  donde: { lat: number; lon: number } | null
): Promise<Record<string, DiaServidor> | null> {
  // La ubicación viaja también aquí: si la fila se cortó, esta lectura la
  // retoma y los días que faltan necesitan su pronóstico.
  const coords = donde ? `&lat=${donde.lat}&lon=${donde.lon}` : "";
  try {
    const r = await fetch(`/api/semana?fechaLocal=${hoy}${coords}`, { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { dias: Record<string, DiaServidor> }).dias;
  } catch {
    return null; // sin red: se reintenta en el siguiente ciclo
  }
}

/**
 * Se monta SÓLO en el cliente (ver semana-montaje.tsx): los días salen de la
 * fecha local del teléfono, que el servidor no conoce. Por eso hoy y las
 * elecciones iniciales se calculan en el primer render, sin efectos.
 */
export function SemanaClient({
  prendas,
  minimo,
  gender,
  codigoTrabajo,
}: {
  prendas: number;
  minimo: number;
  gender: "hombre" | "mujer";
  /** Su código de vestimenta del trabajo; null = nunca se le ha preguntado. */
  codigoTrabajo: string | null;
}) {
  const [hoy] = useState(() => fmtFechaLocal(new Date()));
  const dias = useMemo(() => diasOfrecidos(hoy), [hoy]);

  const [servidor, setServidor] = useState<Record<string, DiaServidor>>({});
  // Lunes a viernes marcados; el fin de semana, a un toque. Cada día con su
  // plan por defecto (lib/semana: planInicial).
  const [elecciones, setElecciones] = useState<Record<string, Eleccion>>(() =>
    Object.fromEntries(
      dias.map((d) => [d.fecha, { activo: !d.finDeSemana, ocasion: planInicial(d.finDeSemana, codigoTrabajo) }])
    )
  );
  // El día cuya lista de planes está abierta. Una a la vez: con todas abiertas
  // la semana vuelve a ser el formulario que se quiso evitar.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [donde, setDonde] = useState<{ lat: number; lon: number } | null>(null);
  // "Trabajo" sin código de vestimenta arma una oficina genérica: se pregunta
  // una vez, aquí mismo, como lo hace el wizard la primera vez.
  const [codigo, setCodigo] = useState<WorkDressCode | null>(null);
  const codigoEfectivo = codigoTrabajo ?? codigo;

  useEffect(() => {
    let vivo = true;
    void leerSemana(hoy, donde).then((d) => {
      if (vivo && d) setServidor(d);
    });
    return () => {
      vivo = false;
    };
  }, [hoy, vuelta, donde]);

  const enCamino = Object.values(servidor).some(
    (d) => d.estado === "en_fila" || d.estado === "generando"
  );
  useEffect(() => {
    if (!enCamino) return;
    const t = setInterval(() => setVuelta((v) => v + 1), 5000);
    return () => clearInterval(t);
  }, [enCamino]);

  // Un día con look listo o en camino ya no se elige: se muestra.
  const libre = (fecha: string) => {
    const e = servidor[fecha]?.estado;
    return !e || e === "error";
  };
  const porPedir = dias.filter((d) => libre(d.fecha) && elecciones[d.fecha]?.activo);
  const pideCodigo =
    !codigoTrabajo && porPedir.some((d) => planPorId(elecciones[d.fecha].ocasion)?.objective === "oficina");

  function elegirCodigo(c: WorkDressCode) {
    setCodigo(c);
    // "con cliente" sólo existe para "depende del día": si eligió otro código,
    // esos días vuelven a ser trabajo normal en vez de quedar con un plan que
    // el motor ignoraría.
    if (c !== "variable") {
      setElecciones((p) =>
        Object.fromEntries(
          Object.entries(p).map(([f, e]) => [f, e.ocasion === "cliente" ? { ...e, ocasion: "oficina" } : e])
        )
      );
    }
  }

  async function armar() {
    if (porPedir.length === 0) return;
    setEnviando(true);
    setAviso(null);
    const aqui = await dondeEstoy();
    setDonde(aqui);
    try {
      const r = await fetch("/api/semana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaLocal: hoy,
          dias: porPedir.map((d) => ({ fecha: d.fecha, ocasion: elecciones[d.fecha].ocasion })),
          ...(aqui ?? {}),
          ...(pideCodigo && codigo ? { workDressCode: codigo } : {}),
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string; mensaje?: string };
      if (!r.ok) {
        setAviso(
          data.error === "cuota"
            ? (data.mensaje ?? "ya armaste muchos looks hoy. vuelve mañana.")
            : data.error === "pocas_prendas"
              ? `necesito al menos ${minimo} prendas para armarte la semana.`
              : "no pude empezar tu semana. intenta otra vez."
        );
      }
    } catch {
      setAviso("no pude empezar tu semana. revisa tu conexión.");
    }
    setVuelta((v) => v + 1);
    setEnviando(false);
  }

  const faltan = minimo - prendas;

  return (
    // pb-44: la barra fija del botón (+ la tab bar) tapaba el último párrafo.
    <div className="flex flex-col gap-6 pb-44 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold leading-[1.04] tracking-[-0.025em] text-ink">
          tu semana,{" "}
          <em className="font-display font-normal italic tracking-normal">armada</em>
        </h1>
        <p className="text-[15px] leading-snug text-muted">
          dime qué te toca cada día y te dejo un look listo para ese plan. cuando
          llegue el día, amanece como tu look de hoy.
        </p>
      </div>

      {faltan > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-[15px] leading-snug text-ink">
            para armarte una semana sin repetir el mismo look necesito al menos {minimo} prendas
            tuyas. llevas {prendas}: te faltan {faltan}.
          </p>
          <Link
            href="/closet"
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            añadir prendas <Icon name="flecha" size={17} />
          </Link>
        </div>
      ) : null}

      <ul className="flex flex-col border-t border-line">
        {dias.map((d) => {
          const s = servidor[d.fecha];
          const el = elecciones[d.fecha];
          const etiqueta = (
            <span className="flex w-14 shrink-0 flex-col">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{d.dia}</span>
              <span className="tabular text-[22px] font-bold leading-none text-ink">{d.numero}</span>
            </span>
          );

          if (s && s.estado === "listo" && s.look) {
            return (
              <li key={d.fecha} className="flex items-center gap-3 border-b border-line py-3.5">
                <Hueco />
                {etiqueta}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="flex items-baseline gap-2">
                    <b className="truncate text-[15px] text-ink">{s.look.nombre}</b>
                    <span className="shrink-0 text-[12px] text-muted">{etiquetaPlan(s.ocasion)}</span>
                  </span>
                  <span className="flex gap-1.5">
                    {s.look.prendas.slice(0, 5).map((p) => (
                      <span key={p.id} className="h-11 w-11 overflow-hidden rounded-md bg-tile">
                        {p.imagen ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagen} alt={p.nombre} className="h-full w-full object-cover mix-blend-multiply" />
                        ) : null}
                      </span>
                    ))}
                  </span>
                </div>
              </li>
            );
          }

          if (s && (s.estado === "en_fila" || s.estado === "generando")) {
            return (
              <li key={d.fecha} className="flex items-center gap-3 border-b border-line py-3.5">
                <Hueco />
                {etiqueta}
                <span className="flex min-w-0 flex-col">
                  <span className={`text-[15px] ${s.estado === "generando" ? "shimmer-txt" : "text-muted"}`}>
                    {s.estado === "generando" ? "armando tu look…" : "en fila"}
                  </span>
                  {/* Qué pidió: sin esto, "en fila" no decía para qué. */}
                  <span className="text-[12px] text-muted">{etiquetaPlan(s.ocasion)}</span>
                </span>
              </li>
            );
          }

          const activo = !!el?.activo;
          const planes = planesDelDia(d.finDeSemana, codigoEfectivo);
          const listaAbierta = abierto === d.fecha;
          return (
            <li key={d.fecha} className="flex flex-col gap-2.5 border-b border-line py-3.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={activo}
                  aria-label={`${d.dia} ${d.numero}`}
                  onClick={() => {
                    setElecciones((p) => ({ ...p, [d.fecha]: { ...p[d.fecha], activo: !activo } }));
                    if (activo && listaAbierta) setAbierto(null);
                  }}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                    activo ? "border-ink bg-accent text-on-accent" : "border-line bg-surface"
                  }`}
                >
                  {activo ? <Icon name="check" size={15} /> : null}
                </button>
                {etiqueta}
                {s?.estado === "error" ? (
                  <span className="text-[13px] text-muted">no salió — vuelve a pedirlo</span>
                ) : null}
                {/* EL PLAN DEL DÍA, a un toque. Marcado: su plan como etiqueta
                    que se cambia. Sin marcar el fin de semana: la pregunta, que
                    es lo que no quedaba claro ("¿qué pasa el fin de semana?").
                    Entre semana sin marcar no se pregunta nada: lo apagó. */}
                {activo || d.finDeSemana ? (
                  <button
                    type="button"
                    onClick={() => setAbierto(listaAbierta ? null : d.fecha)}
                    aria-expanded={listaAbierta}
                    className={`ml-auto flex min-h-10 items-center gap-1.5 rounded-sm border px-3 text-[13.5px] font-semibold transition-colors ${
                      activo ? "border-line bg-surface text-ink hover:border-ink" : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    {activo ? planPorId(el.ocasion)?.label : "¿tienes plan?"}
                    <Icon name="chevron" size={13} rotate={listaAbierta ? 270 : 90} />
                  </button>
                ) : null}
              </div>
              {listaAbierta ? (
                <div className="flex flex-wrap gap-2 pl-9" role="radiogroup" aria-label={`plan del ${d.dia}`}>
                  {planes.map((o) => {
                    const on = activo && el?.ocasion === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          // Elegir un plan también marca el día: nadie elige
                          // "cena con amigos" para que no se arme.
                          setElecciones((p) => ({
                            ...p,
                            [d.fecha]: { activo: true, ocasion: o.id as PlanSemanaId },
                          }));
                          setAbierto(null);
                        }}
                        className={`rounded-sm border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                          on ? "border-ink bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-ink"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pideCodigo ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[15px] font-bold text-ink">¿cómo te vistes para trabajar?</p>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="código de vestimenta del trabajo">
            {WORK_DRESS_CODES.map((c) => {
              const on = codigo === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => elegirCodigo(c.key)}
                  className={`flex flex-col rounded-sm border px-3.5 py-2.5 text-left transition-colors ${
                    on ? "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]" : "border-line hover:border-ink"
                  } bg-surface`}
                >
                  <b className="text-[15px] text-ink">{c[gender]}</b>
                  <span className="text-[12.5px] text-muted">{c.ejemplos}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {aviso ? <p className="text-[14px] text-ink">{aviso}</p> : null}
      {enCamino ? (
        <p className="text-[14px] leading-snug text-muted">
          puedes cerrar la app: te dejo cada día listo aunque no estés aquí.
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 mx-auto w-full max-w-[430px] bg-bg px-4 pb-2 pt-2 lg:bottom-4">
        <button
          type="button"
          onClick={() => void armar()}
          disabled={enviando || faltan > 0 || porPedir.length === 0 || (pideCodigo && !codigo)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-40"
        >
          {enviando
            ? "empezando…"
            : porPedir.length === 0
              ? Object.keys(servidor).length > 0
                ? "marca otro día si quieres sumarlo"
                : "marca al menos un día"
              : `armar ${porPedir.length === 1 ? "1 día" : `${porPedir.length} días`}`}
          {!enviando && porPedir.length > 0 ? <Icon name="destello" size={18} /> : null}
        </button>
      </div>
    </div>
  );
}
