"use client";

import { useState } from "react";
import { REVISIONES, type Discrepancia } from "@/lib/destilador-tipos";
import { resolverDiscrepancia } from "./actions";

// Segunda pasada: solo las fotos donde el humano dijo "no sirve" y la taxonomía
// dice que SÍ son del estilo.
//
// Aquí NO hay swipe, a propósito. La primera pasada era binaria y el gesto la
// hacía rápida; ésta tiene tres salidas que significan cosas distintas y la
// respuesta correcta pide leer. Un gesto rápido es justo lo que produjo el
// problema que esto viene a arreglar.
export function RevisionClient({ items }: { items: Discrepancia[] }) {
  // La cola NO se re-calcula al resolver: quitar la foto de la lista mientras se
  // avanza reordenaría lo que queda bajo el dedo. Solo avanza el índice; la
  // lista se rearma en la siguiente carga.
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const foto = items[i];
  const estilo = foto?.path.split("/")[1] ?? "";

  function resolver(revision: string) {
    if (!foto) return;
    const id = foto.id;
    setI((n) => n + 1);
    resolverDiscrepancia(id, revision).then((r) => {
      if ("error" in r) setError("No se guardó — revisa tu conexión.");
      else setError(null);
    });
  }

  if (!foto) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-lg font-semibold text-ink">Revisión terminada</p>
        <p className="text-sm text-muted">
          {items.length === 0
            ? "No quedan discrepancias por revisar."
            : `Revisaste ${items.length}. Avísame y re-destilo con lo que quedó.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">
          Segunda vuelta <span className="text-muted">· {estilo}</span>
        </span>
        <span className="text-sm text-muted">
          {i + 1} de {items.length}
        </span>
      </div>

      {/* 34vh: las tres opciones hay que LEERLAS, y con la foto más grande se
          salían de la pantalla en el celular. Aquí la foto es contexto, no el
          protagonista — ya se juzgó una vez. */}
      <div className="relative h-[34vh] w-full overflow-hidden rounded-xl border border-line bg-tile sm:h-[48vh]">
        {foto.url ? (
          /* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage */
          <img
            src={foto.url}
            alt="referencia"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
            No se pudo cargar. Recarga para firmar de nuevo.
          </div>
        )}
      </div>

      {foto.observado && (
        <p className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">
          <span className="text-ink">Esta sí es {estilo}.</span> {foto.observado}.
          La rechazaste — ¿por qué?
        </p>
      )}

      <div className="flex flex-col gap-2">
        {REVISIONES.map((r) => (
          <button
            key={r.id}
            onClick={() => resolver(r.id)}
            className="flex flex-col items-start gap-0.5 rounded-xl border border-line px-4 py-3 text-left active:bg-tile"
          >
            <span className="text-base font-semibold text-ink">{r.label}</span>
            <span className="text-xs text-muted">{r.pista}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-line bg-surface p-3 text-center text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
