"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";
import { votarParMotor } from "../../motor-actions";

// Votar a ciegas, un par a la vez. Las columnas se llaman "Look A / Look B" y
// el orden viene barajado del servidor: aquí NADIE sabe qué variante es cuál —
// el voto viaja como izquierda/derecha y el servidor lo resuelve.
//
// Los defectos por lado son la cosecha real del vistazo: cada tag confirmado
// es candidato a regla comprobable en código (reglas-ejecucion.ts). Marcar un
// defecto NO obliga a votar en contra — un look puede romper el clima y aun
// así ser el mejor de los dos.

export type LookParaVotar = {
  nombre: string;
  explicacion: string;
  tip: string | null;
  prendas: { id: string; nombre: string; swatch: string; imagen: string | null }[];
};

export type ParParaVotar = {
  parId: string;
  n: number;
  etiqueta: string;
  izq: LookParaVotar[];
  der: LookParaVotar[];
};

function CartaLook({ look }: { look: LookParaVotar }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <p className="text-sm font-semibold text-ink">{look.nombre}</p>
      <div className="flex flex-wrap gap-1.5">
        {look.prendas.map((p) => (
          <div key={p.id} className="flex w-14 flex-col items-center gap-1">
            {p.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imagen}
                alt={p.nombre}
                className="h-14 w-14 rounded-lg border border-line object-cover"
              />
            ) : (
              <div
                className="h-14 w-14 rounded-lg border border-line"
                style={{ backgroundColor: p.swatch }}
              />
            )}
            <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted">
              {p.nombre}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted">{look.explicacion}</p>
      {look.tip ? (
        <p className="text-xs leading-relaxed text-muted">✦ {look.tip}</p>
      ) : null}
    </div>
  );
}

function Columna({
  titulo,
  looks,
  defectos,
  setDefectos,
}: {
  titulo: string;
  looks: LookParaVotar[];
  defectos: string[];
  setDefectos: (d: string[]) => void;
}) {
  const alternar = (clave: string) =>
    setDefectos(
      defectos.includes(clave)
        ? defectos.filter((x) => x !== clave)
        : [...defectos, clave]
    );
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>
      {looks.map((l, i) => (
        <CartaLook key={i} look={l} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {DEFECTOS_MOTOR.map((d) => (
          <button
            key={d.clave}
            onClick={() => alternar(d.clave)}
            className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
              defectos.includes(d.clave)
                ? "border-error text-error"
                : "border-line text-muted"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function VotarClient({
  pares,
  yaHechos,
  total,
  tamano,
}: {
  pares: ParParaVotar[];
  yaHechos: number;
  total: number;
  tamano: string;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [defIzq, setDefIzq] = useState<string[]>([]);
  const [defDer, setDefDer] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const par = pares[idx];

  const votar = async (eleccion: "izq" | "der" | "empate") => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    const r = await votarParMotor(par.parId, eleccion, { izq: defIzq, der: defDer }, nota);
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "no se pudo guardar el voto");
      return;
    }
    setDefIzq([]);
    setDefDer([]);
    setNota("");
    if (idx + 1 < pares.length) setIdx(idx + 1);
    else router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">
            ¿Cuál quedó mejor?
          </h1>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {yaHechos + idx + 1} de {total}
          </span>
        </div>
        <p className="text-sm text-muted">
          Brief: <span className="font-semibold text-ink">{par.etiqueta}</span>
          {tamano === "vistazo"
            ? " · vistazo: caza defectos, aquí no se corona a nadie"
            : ""}
        </p>
      </header>

      <div className="flex gap-3">
        <Columna titulo="Look A" looks={par.izq} defectos={defIzq} setDefectos={setDefIzq} />
        <Columna titulo="Look B" looks={par.der} defectos={defDer} setDefectos={setDefDer} />
      </div>

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="nota del par (lo que no cabe en un tag)"
        className="rounded-xl border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
      />

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="grid grid-cols-3 gap-2">
        <button
          disabled={guardando}
          onClick={() => votar("izq")}
          className="rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
        >
          Gana A
        </button>
        <button
          disabled={guardando}
          onClick={() => votar("empate")}
          className="rounded-xl border border-line py-4 text-base font-semibold text-ink active:bg-tile disabled:opacity-50"
        >
          Empate
        </button>
        <button
          disabled={guardando}
          onClick={() => votar("der")}
          className="rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
        >
          Gana B
        </button>
      </div>
      <p className="text-xs text-muted">
        Cada voto se guarda solo. Marcar un defecto no te obliga a votar en
        contra: un look puede romper algo y aun así ser el mejor de los dos.
      </p>
    </div>
  );
}
