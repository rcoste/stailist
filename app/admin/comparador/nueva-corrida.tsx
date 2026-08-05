"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { estimado, type Modo } from "@/lib/comparador/tipos";
import { formatoUsd } from "@/lib/proveedores/precios";
import { abrirCorrida, cambiarEstado } from "./actions";

// Subir fotos, elegir quién compite, VER EL COSTO, y correr.
//
// El costo va antes del botón a propósito. La lección de agosto no fue "los
// modelos son caros" —la app entera costaba $17 al mes— sino que nadie veía el
// gasto hasta que llegaba la factura.

type ModeloUI = { id: string; etiqueta: string; proveedor: string; listo: boolean };

const MODOS: { modo: Modo; label: string; ayuda: string }[] = [
  {
    modo: "varias",
    label: "Foto con varias prendas",
    ayuda: "tú vestido, o el clóset sobre la cama · así entraron 303 de tus prendas",
  },
  {
    modo: "una",
    label: "Foto de una prenda",
    ayuda: "una sola prenda en el cuadro · así entraron 5",
  },
];

export function NuevaCorrida({ modelos }: { modelos: ModeloUI[] }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("varias");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [fotos, setFotos] = useState<{ nombre: string; dataUrl: string }[]>([]);
  const [avance, setAvance] = useState<{ hechas: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const costo = useMemo(
    () => estimado(elegidos, fotos.length, modo),
    [elegidos, fotos.length, modo]
  );

  const alternar = (id: string) =>
    setElegidos((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  const agregar = async (archivos: FileList | null) => {
    if (!archivos) return;
    const nuevas = await Promise.all(
      [...archivos].slice(0, 12).map(
        (f) =>
          new Promise<{ nombre: string; dataUrl: string }>((res) => {
            const r = new FileReader();
            r.onload = () => res({ nombre: f.name, dataUrl: String(r.result) });
            r.readAsDataURL(f);
          })
      )
    );
    setFotos((xs) => [...xs, ...nuevas].slice(0, 12));
  };

  const lanzar = () =>
    empezar(async () => {
      setError(null);
      const r = await abrirCorrida(modo, elegidos, fotos);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      const trabajos = r.fotos.flatMap((f) =>
        elegidos.map((modeloId) => ({ fotoId: f.id, modeloId }))
      );
      setAvance({ hechas: 0, total: trabajos.length });
      let i = 0;
      let hechas = 0;
      // De a 3 en paralelo: leer varias prendas devuelve mucho texto y tarda,
      // y disparar 40 de golpe topa con los límites de ritmo de los proveedores.
      const obreros = Array.from({ length: 3 }, async () => {
        while (i < trabajos.length) {
          const t = trabajos[i++];
          try {
            await fetch("/api/admin/comparador/leer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ corridaId: r.id, ...t }),
            });
          } catch {
            // Una lectura caída no tumba la corrida; se ve como hueco al calificar.
          }
          hechas++;
          setAvance({ hechas, total: trabajos.length });
        }
      });
      await Promise.all(obreros);
      await cambiarEstado(r.id, "juzgando");
      router.push(`/admin/comparador/${r.id}`);
    });

  if (avance) {
    const pct = Math.round((avance.hechas / avance.total) * 100);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">
          Leyendo… {avance.hechas} de {avance.total}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-tile">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted">
          No cierres esta pantalla: las lecturas se piden desde aquí. Si la
          cierras, lo que falte no se pide ni se cobra.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Nueva corrida</h2>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Qué se prueba</p>
        <div className="flex flex-col gap-2">
          {MODOS.map((m) => (
            <button
              key={m.modo}
              onClick={() => setModo(m.modo)}
              className={`rounded-xl border p-3 text-left ${
                modo === m.modo ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <span className="block text-sm font-semibold text-ink">{m.label}</span>
              <span className="block text-xs text-muted">{m.ayuda}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fotos</p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => agregar(e.target.files)}
        />
        <button
          onClick={() => input.current?.click()}
          className="rounded-xl border border-dashed border-line py-6 text-sm font-medium text-muted"
        >
          {fotos.length ? `${fotos.length} foto${fotos.length > 1 ? "s" : ""} · agregar más` : "Elegir fotos"}
        </button>
        {fotos.length ? (
          <div className="flex flex-wrap gap-2">
            {fotos.map((f, n) => (
              <button
                key={n}
                onClick={() => setFotos((xs) => xs.filter((_, k) => k !== n))}
                title="quitar"
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.dataUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Quiénes compiten</p>
        <div className="flex flex-wrap gap-2">
          {modelos.map((m) => (
            <button
              key={m.id}
              disabled={!m.listo}
              onClick={() => alternar(m.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                elegidos.includes(m.id)
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line text-ink"
              } disabled:opacity-40`}
              title={m.listo ? undefined : `falta la llave de ${m.proveedor}`}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
        {modelos.some((m) => !m.listo) ? (
          <p className="text-xs text-muted">Los apagados necesitan su llave en el servidor.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3">
        <span className="text-sm text-muted">Cuesta más o menos</span>
        <span className="text-base font-semibold text-ink">
          {elegidos.length < 2 || !fotos.length ? "—" : formatoUsd(costo)}
        </span>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button
        disabled={pendiente || elegidos.length < 2 || !fotos.length}
        onClick={lanzar}
        className="rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
      >
        {pendiente ? "Subiendo…" : "Correr"}
      </button>
    </div>
  );
}
