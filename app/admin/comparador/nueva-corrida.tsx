"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { estimado, type Modo } from "@/lib/comparador/tipos";
import { formatoUsd } from "@/lib/proveedores/precios";
import { comprimirADataUrl } from "@/lib/image-compress";
import { toUsableImage } from "@/lib/image-file";
import { abrirCorrida, subirFoto, cambiarEstado } from "./actions";

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
  const [avance, setAvance] = useState<{ hechas: number; total: number; etapa: "subiendo" | "leyendo" } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const costo = useMemo(
    () => estimado(elegidos, fotos.length, modo),
    [elegidos, fotos.length, modo]
  );

  const alternar = (id: string) =>
    setElegidos((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  // Convertir y comprimir ANTES de mandar, con los mismos ayudantes que usa el
  // import del clóset. No es un lujo, son dos fallas seguras:
  //   HEIC   — las fotos de iPhone llegan en un formato que ni los navegadores
  //            no-WebKit ni las APIs de visión saben decodificar.
  //   TAMAÑO — una foto de celular pesa 3-5 MB y en base64 crece un tercio más.
  //            Las acciones de servidor de Next cortan a 1 MB, así que la
  //            petición ni siquiera llegaba: devolvía error de servidor a secas.
  // 1280px es lo mismo que usa el clóset: alcanza para que el modelo lea la
  // tela y el color, sin reventar el envío.
  const agregar = async (archivos: FileList | null) => {
    if (!archivos) return;
    setError(null);
    setPreparando(true);
    try {
      const nuevas: { nombre: string; dataUrl: string }[] = [];
      for (const f of [...archivos].slice(0, 12)) {
        const usable = await toUsableImage(f);
        nuevas.push({ nombre: f.name, dataUrl: await comprimirADataUrl(usable) });
      }
      setFotos((xs) => [...xs, ...nuevas].slice(0, 12));
    } catch {
      setError("No pude leer alguna de esas fotos. Prueba con otra.");
    } finally {
      setPreparando(false);
    }
  };

  const lanzar = () =>
    empezar(async () => {
      setError(null);
      const r = await abrirCorrida(modo, elegidos);
      if ("error" in r) {
        setError(r.error);
        return;
      }

      // Una foto por llamada: juntas pasan el límite de 1 MB de las acciones
      // de servidor y la petición muere antes de llegar.
      setAvance({ hechas: 0, total: fotos.length, etapa: "subiendo" });
      const subidas: string[] = [];
      for (const [n, f] of fotos.entries()) {
        const s = await subirFoto(r.id, n + 1, f.dataUrl);
        if ("error" in s) {
          setError(`No pude subir la foto ${n + 1}: ${s.error}`);
          setAvance(null);
          return;
        }
        subidas.push(s.id);
        setAvance({ hechas: n + 1, total: fotos.length, etapa: "subiendo" });
      }

      const trabajos = subidas.flatMap((fotoId) =>
        elegidos.map((modeloId) => ({ fotoId, modeloId }))
      );
      setAvance({ hechas: 0, total: trabajos.length, etapa: "leyendo" });
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
          setAvance({ hechas, total: trabajos.length, etapa: "leyendo" });
        }
      });
      await Promise.all(obreros);
      await cambiarEstado(r.id, "juzgando");
      router.push(`/admin/comparador/${r.id}`);
    });

  if (avance) {
    const pct = Math.round((avance.hechas / avance.total) * 100);
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">
          {avance.etapa === "subiendo" ? "Subiendo fotos" : "Leyendo"}… {avance.hechas} de{" "}
          {avance.total}
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
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Nueva corrida</h2>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Qué se prueba</p>
        <div className="flex flex-col gap-2">
          {MODOS.map((m) => (
            <button
              key={m.modo}
              onClick={() => setModo(m.modo)}
              className={`rounded-sm border p-3 text-left ${
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
          disabled={preparando}
          onClick={() => input.current?.click()}
          className="rounded-sm border border-dashed border-line py-6 text-sm font-medium text-muted disabled:opacity-50"
        >
          {preparando
            ? "Preparando las fotos…"
            : fotos.length
              ? `${fotos.length} foto${fotos.length > 1 ? "s" : ""} · agregar más`
              : "Elegir fotos"}
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

      <div className="flex items-center justify-between gap-3 rounded-lg bg-bg p-3">
        <span className="text-sm text-muted">Cuesta más o menos</span>
        <span className="text-base font-semibold text-ink">
          {elegidos.length < 2 || !fotos.length ? "—" : formatoUsd(costo)}
        </span>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button
        disabled={pendiente || preparando || elegidos.length < 2 || !fotos.length}
        onClick={lanzar}
        className="rounded-sm bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
      >
        {pendiente ? "Subiendo…" : "Correr"}
      </button>
    </div>
  );
}
