"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { completarMarcas } from "../../../motor-actions";
import type { LookParaVotar } from "../votar-client";

// Marcar 👍/👎 look por look en pares YA votados. No hay botones de voto: el
// voto está sellado y esto solo completa el diagnóstico que faltaba.

export type ParParaMarcar = {
  parId: string;
  n: number;
  etiqueta: string;
  izq: LookParaVotar[];
  der: LookParaVotar[];
};

function Carta({
  look,
  marca,
  setMarca,
  comentario,
  setComentario,
}: {
  look: LookParaVotar;
  marca?: "arriba" | "abajo";
  setMarca: (m: "arriba" | "abajo" | undefined) => void;
  comentario?: string;
  setComentario: (c: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{look.nombre}</p>
        <span className="flex shrink-0 gap-1">
          <button
            onClick={() => setMarca(marca === "arriba" ? undefined : "arriba")}
            aria-label="este look sí"
            className={`rounded-full border px-2 py-0.5 text-xs ${
              marca === "arriba" ? "border-ink bg-ink text-bg" : "border-line text-muted"
            }`}
          >
            👍
          </button>
          <button
            onClick={() => setMarca(marca === "abajo" ? undefined : "abajo")}
            aria-label="este look no"
            className={`rounded-full border px-2 py-0.5 text-xs ${
              marca === "abajo" ? "border-error text-error" : "border-line text-muted"
            }`}
          >
            👎
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {look.prendas.map((p) => (
          <div key={p.id} className="flex w-14 flex-col items-center gap-1">
            <span className="relative block h-14 w-14 overflow-hidden rounded-lg border border-line">
              {p.imagen ? (
                <Image
                  src={p.imagen}
                  alt={p.nombre}
                  fill
                  sizes="56px"
                  loading="eager"
                  className="object-cover"
                />
              ) : (
                <span
                  className="absolute inset-0"
                  style={{ backgroundColor: p.swatch }}
                  aria-hidden
                />
              )}
            </span>
            <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted">
              {p.nombre}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted">{look.explicacion}</p>
      <textarea
        value={comentario ?? ""}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        placeholder="qué le viste a este (opcional)"
        className="rounded-lg border border-line bg-bg p-2 text-xs text-ink placeholder:text-muted"
      />
    </div>
  );
}

export function MarcasClient({
  corridaId,
  pares,
}: {
  corridaId: string;
  pares: ParParaMarcar[];
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [mIzq, setMIzq] = useState<Record<number, "arriba" | "abajo">>({});
  const [mDer, setMDer] = useState<Record<number, "arriba" | "abajo">>({});
  const [cIzq, setCIzq] = useState<Record<number, string>>({});
  const [cDer, setCDer] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const par = pares[idx];

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    const r = await completarMarcas(
      par.parId,
      { izq: mIzq, der: mDer },
      { izq: cIzq, der: cDer }
    );
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "no se pudo guardar");
      return;
    }
    setMIzq({});
    setMDer({});
    setCIzq({});
    setCDer({});
    if (idx + 1 < pares.length) setIdx(idx + 1);
    else router.push(`/admin/comparador/motor/${corridaId}`);
  };

  const columna = (
    titulo: string,
    looks: LookParaVotar[],
    marcas: Record<number, "arriba" | "abajo">,
    setMarcas: (m: Record<number, "arriba" | "abajo">) => void,
    comentarios: Record<number, string>,
    setComentarios: (c: Record<number, string>) => void
  ) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>
      {looks.map((l, i) => (
        <Carta
          key={i}
          look={l}
          marca={marcas[i]}
          setMarca={(m) => {
            const next = { ...marcas };
            if (m) next[i] = m;
            else delete next[i];
            setMarcas(next);
          }}
          comentario={comentarios[i]}
          setComentario={(c) => setComentarios({ ...comentarios, [i]: c })}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">Completar las marcas</h1>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {idx + 1} de {pares.length}
          </span>
        </div>
        <p className="text-sm text-muted">
          Brief: <span className="font-semibold text-ink">{par.etiqueta}</span> · estos
          pares se votaron antes de que existieran las marcas. El voto no se
          toca; sigue ciego (no se revela cuál columna es cuál).
        </p>
      </header>

      <div className="flex gap-3">
        {columna("Look A", par.izq, mIzq, setMIzq, cIzq, setCIzq)}
        {columna("Look B", par.der, mDer, setMDer, cDer, setCDer)}
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button
        disabled={guardando}
        onClick={guardar}
        className="rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
      >
        {guardando ? "Guardando…" : idx + 1 < pares.length ? "Guardar y siguiente" : "Guardar y terminar"}
      </button>
    </div>
  );
}
