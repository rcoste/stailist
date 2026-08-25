"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatoUsd } from "@/lib/proveedores/precios";
import { cambiarEstadoMotor } from "../../motor-actions";

// Generar los lados por BLOQUES, con el gasto a la vista y un freno de mano.
//
// Cada lado es una corrida completa del motor de producción (generar + jueces),
// 25-45s. Se piden de a uno al servidor (60s de Vercel por función) con dos a
// la vez, y cada 3 pares la pantalla se detiene a preguntar si sigues: el
// costo corre mientras generas, y un experimento que va mal se corta a la
// tercera, no a la cuadragésima.

type Trabajo = { parId: string; variante: string; n: number };

const LADOS_POR_BLOQUE = 6; // 3 pares

export function GenerarClient({
  corridaId,
  tamano,
  trabajos,
  hechos,
  total,
  estimado,
}: {
  corridaId: string;
  tamano: string;
  trabajos: Trabajo[];
  hechos: number;
  total: number;
  estimado: number | null;
}) {
  const router = useRouter();
  // Índices de `trabajos` con fila YA persistida en el servidor (ok o fallo
  // anotado). Un fetch que murió SIN fila no entra: sigue pendiente y se
  // reintenta — contarlo como avance fue justo el bug que congelaba lados.
  const [persistidos, setPersistidos] = useState<Set<number>>(new Set());
  const [fase, setFase] = useState<"listo" | "generando" | "pausa">("listo");
  const [fallos, setFallos] = useState<string[]>([]);
  const [notaAborto, setNotaAborto] = useState("");
  const [abortando, setAbortando] = useState(false);
  const detener = useRef(false);

  const corriendo = useRef(false);

  const correrBloque = async () => {
    // Guard de reentrada: dos clicks antes del re-render lanzarían el mismo
    // bloque dos veces — 4 pipelines Opus concurrentes sobre los MISMOS lados.
    if (corriendo.current) return;
    corriendo.current = true;
    setFase("generando");
    detener.current = false;
    const pendientes = trabajos
      .map((t, idx) => ({ t, idx }))
      .filter(({ idx }) => !persistidos.has(idx));
    const bloque = pendientes.slice(0, LADOS_POR_BLOQUE);
    let i = 0;
    const nuevos = new Set(persistidos);
    // Dos a la vez: un lado tarda 25-45s y los proveedores aguantan dos; más
    // sería apostar contra los límites de ritmo con el modelo más caro.
    const obreros = Array.from({ length: 2 }, async () => {
      while (i < bloque.length && !detener.current) {
        const { t, idx } = bloque[i++];
        try {
          const r = await fetch("/api/admin/comparador/generar-lado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ corridaId, parId: t.parId, variante: t.variante }),
          });
          const json = (await r.json()) as { ok?: boolean; fallo?: string; error?: string };
          if (json.error) {
            // Sin fila en el servidor (400/409/500): queda pendiente.
            setFallos((xs) => [...xs, `par ${t.n}: ${json.error}`]);
          } else {
            if (json.fallo) setFallos((xs) => [...xs, `par ${t.n}: ${json.fallo}`]);
            nuevos.add(idx); // ok o fallo ANOTADO: hay fila, ya no se reintenta
          }
        } catch {
          setFallos((xs) => [...xs, `par ${t.n}: la petición no llegó (se reintenta)`]);
        }
        setPersistidos(new Set(nuevos));
      }
    });
    await Promise.all(obreros);
    corriendo.current = false;

    // Al terminar NO se cambia el estado: se recarga y el servidor decide la
    // fase por los DATOS. Si algún lado murió sin dejar fila (red caída, kill
    // de 60s), sigue pendiente y esta pantalla reaparece para reintentarlo —
    // cambiar a "juzgando" aquí lo dejaría ingenerable.
    if (nuevos.size >= trabajos.length) {
      router.refresh();
      return;
    }
    setFase("pausa");
  };

  const abortar = async () => {
    setAbortando(true);
    detener.current = true;
    await cambiarEstadoMotor(corridaId, "juzgando", notaAborto.trim() || "abortada a media generación");
    router.refresh();
  };

  const avance = hechos + persistidos.size;
  const pct = total ? Math.round((avance / total) * 100) : 0;
  const paresListos = Math.floor(avance / 2);
  const paresPendientes = Math.ceil((trabajos.length - persistidos.size) / 2);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink">Generando la corrida</h1>
        <p className="text-sm text-muted">
          {tamano === "vistazo" ? "Vistazo" : "Veredicto"} · {total / 2} pares ·
          dos motores sobre los mismos días de tu clóset.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">
          {avance} de {total} lados (~{paresListos} pares listos)
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-tile">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>

        {fase === "listo" ? (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-bg p-3">
              <span className="text-sm text-muted">Lo que falta cuesta más o menos</span>
              <span className="text-base font-semibold text-ink">
                {estimado === null ? "—" : formatoUsd(estimado)}
              </span>
            </div>
            <button
              onClick={correrBloque}
              className="rounded-sm bg-ink py-4 text-base font-semibold text-bg active:opacity-80"
            >
              Generar {hechos > 0 ? "los siguientes" : "los primeros"}{" "}
              {Math.ceil(Math.min(LADOS_POR_BLOQUE, trabajos.length) / 2)} pares
            </button>
          </>
        ) : null}

        {fase === "generando" ? (
          <p className="text-xs text-muted">
            Cada lado es el motor completo (stylist + jueces), 25-45s. No cierres
            esta pantalla: lo que no se pide, no se cobra.
          </p>
        ) : null}

        {/* La pausa tiene que gritar cuántos pares FALTAN. La primera versión
            solo decía "6 de 12 lados" y ponía el botón de parar justo debajo:
            Roberto cortó una corrida a la mitad creyendo que ya había
            terminado, y los 3 briefs restantes (frío, calor, lluvia) nunca se
            midieron. El progreso se cuenta en PARES, que es la unidad que se
            vota; los lados son detalle de implementación. */}
        {fase === "pausa" ? (
          <>
            <p className="text-sm font-semibold text-ink">
              Faltan {paresPendientes} {paresPendientes === 1 ? "par" : "pares"} por
              generar de {Math.round(total / 2)}.
            </p>
            <button
              onClick={correrBloque}
              className="rounded-sm bg-ink py-4 text-base font-semibold text-bg active:opacity-80"
            >
              Generar {Math.min(LADOS_POR_BLOQUE / 2, paresPendientes)} más
            </button>
          </>
        ) : null}

        {fase === "pausa" && fallos.length > 0 ? (
          <p className="text-xs text-muted">
            Los lados que murieron sin registrarse siguen pendientes y entran
            en el siguiente bloque.
          </p>
        ) : null}
      </div>

      {fallos.length ? (
        <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-error">Lados que fallaron</p>
          {fallos.map((f, i) => (
            <p key={i} className="text-xs text-muted">
              {f}
            </p>
          ))}
          <p className="text-xs text-muted">
            Un lado caído no tumba la corrida: su par no se vota y el fallo
            queda en el marcador.
          </p>
        </div>
      ) : null}

      {/* Detrás de un disclosure: parar es la EXCEPCIÓN, no el siguiente paso.
          Abierto y en negrita se lee como "ya acabé, sigue aquí". */}
      {fase !== "listo" ? (
        <details className="rounded-lg border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            Parar antes de tiempo
          </summary>
          <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted">
            Se vota con los pares que ya existen y los que falten quedan sin
            medir. Deja una nota de por qué — dentro de tres meses nadie se
            acuerda.
          </p>
          <input
            value={notaAborto}
            onChange={(e) => setNotaAborto(e.target.value)}
            placeholder="por qué se corta (ej: la variante B rompe clima en todos)"
            className="rounded-sm border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
          />
          <button
            disabled={abortando}
            onClick={abortar}
            className="rounded-sm border border-line py-3 text-sm font-semibold text-ink active:bg-tile disabled:opacity-50"
          >
            {abortando ? "Cerrando…" : "Parar y votar con lo que hay"}
          </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
