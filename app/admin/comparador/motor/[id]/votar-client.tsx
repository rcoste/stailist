"use client";

import Image from "next/image";
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
  claveIzq: string;
  claveDer: string;
};

function CartaLook({
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
  setComentario?: (c: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{look.nombre}</p>
        {/* Marca por look: dice CUÁL arrastró el voto del par. No es un voto
            aparte — los tres looks salen de una sola llamada al motor. */}
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
      {/* Miniaturas por next/image, como el clóset: tus renders propios son
          JPGs a tamaño completo en el bucket privado, y pintarlos con <img>
          crudo bajaba ~400 KB por prenda para un cuadro de 56 px. Las del
          catálogo (públicas, en CDN) aparecían al instante y las tuyas se
          quedaban cargando — que es justo lo que se veía en el celular. */}
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
                  // eager, no lazy: aquí comparar las prendas ES la tarea, y
                  // una miniatura que aparece al hacer scroll llega tarde para
                  // votar. Ya optimizadas pesan ~3 KB, así que pedir las ~26 de
                  // golpe cuesta menos que UNA sola sin optimizar.
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
      {look.tip ? (
        <p className="text-xs leading-relaxed text-muted">✦ {look.tip}</p>
      ) : null}
      {/* El porqué de ESTE look. El 👍/👎 dice cuál arrastró el voto; esto
          dice qué tuvo, que es lo único que se vuelve regla. */}
      {setComentario ? (
        <textarea
          value={comentario ?? ""}
          onChange={(e) => setComentario(e.target.value)}
          rows={2}
          placeholder="qué le viste a este (opcional)"
          className="rounded-lg border border-line bg-bg p-2 text-xs text-ink placeholder:text-muted"
        />
      ) : null}
    </div>
  );
}

function Columna({
  titulo,
  looks,
  defectos,
  setDefectos,
  tryon,
  marcas,
  setMarcas,
  comentarios,
  setComentarios,
}: {
  titulo: string;
  looks: LookParaVotar[];
  defectos: string[];
  setDefectos: (d: string[]) => void;
  tryon?: { image?: string; error?: string };
  marcas: Record<number, "arriba" | "abajo">;
  setMarcas: (m: Record<number, "arriba" | "abajo">) => void;
  comentarios: Record<number, string>;
  setComentarios: (c: Record<number, string>) => void;
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
      {/* El try-on del PRIMER look, cuando se pidió. Va arriba: es lo que
          decide de un vistazo, y las prendas siguen abajo como referencia. */}
      {tryon?.image ? (
        <span className="relative block aspect-[3/4] overflow-hidden rounded-xl border border-line">
          <Image
            src={tryon.image}
            alt={`${titulo} en tu avatar`}
            fill
            sizes="(max-width: 430px) 50vw, 300px"
            loading="eager"
            className="object-cover"
          />
        </span>
      ) : null}
      {tryon?.error ? (
        <p className="text-xs text-error">
          {tryon.error === "sin_avatar"
            ? "no tienes avatar todavía"
            : `no salió el render (${tryon.error})`}
        </p>
      ) : null}
      {looks.map((l, i) => (
        <CartaLook
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
  const [marcIzq, setMarcIzq] = useState<Record<number, "arriba" | "abajo">>({});
  const [marcDer, setMarcDer] = useState<Record<number, "arriba" | "abajo">>({});
  const [comIzq, setComIzq] = useState<Record<number, string>>({});
  const [comDer, setComDer] = useState<Record<number, string>>({});
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El try-on del par actual, por VARIANTE (la respuesta no dice izq/der para
  // no delatar el ciego; se mapea abajo con las claves que mandó el servidor).
  const [tryon, setTryon] = useState<Record<string, { image?: string; error?: string }> | null>(null);
  const [renderizando, setRenderizando] = useState(false);

  const par = pares[idx];

  const verEnAvatar = async () => {
    if (renderizando) return;
    setRenderizando(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/comparador/tryon-par", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parId: par.parId }),
      });
      const json = (await r.json()) as {
        porVariante?: Record<string, { image?: string; error?: string }>;
        error?: string;
      };
      if (json.error) setError(json.error);
      else setTryon(json.porVariante ?? null);
    } catch {
      setError("no se pudo generar el try-on");
    } finally {
      setRenderizando(false);
    }
  };

  const votar = async (eleccion: "izq" | "der" | "empate") => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    const r = await votarParMotor(
      par.parId,
      eleccion,
      { izq: defIzq, der: defDer },
      nota,
      { izq: marcIzq, der: marcDer },
      { izq: comIzq, der: comDer }
    );
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "no se pudo guardar el voto");
      return;
    }
    setDefIzq([]);
    setDefDer([]);
    setMarcIzq({});
    setMarcDer({});
    setComIzq({});
    setComDer({});
    setNota("");
    setTryon(null); // el try-on es de ESTE par; el siguiente empieza sin él
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
        <Columna
          titulo="Look A"
          looks={par.izq}
          defectos={defIzq}
          setDefectos={setDefIzq}
          tryon={tryon?.[par.claveIzq]}
          marcas={marcIzq}
          setMarcas={setMarcIzq}
          comentarios={comIzq}
          setComentarios={setComIzq}
        />
        <Columna
          titulo="Look B"
          looks={par.der}
          defectos={defDer}
          setDefectos={setDefDer}
          tryon={tryon?.[par.claveDer]}
          marcas={marcDer}
          setMarcas={setMarcDer}
          comentarios={comDer}
          setComentarios={setComDer}
        />
      </div>

      {!tryon ? (
        <button
          disabled={renderizando}
          onClick={verEnAvatar}
          className="rounded-xl border border-line py-3 text-sm font-semibold text-ink active:bg-tile disabled:opacity-50"
        >
          {renderizando ? "Vistiendo tu avatar… (20-40s)" : "Ver los dos en mi avatar"}
        </button>
      ) : null}
      {!tryon ? (
        <p className="text-xs text-muted">
          Los dos lados se rendean juntos, con el mismo avatar. Pídelo solo
          cuando las prendas no te alcancen para decidir: un render feo puede
          hundir un look correcto, y ese ruido entra a tu voto.
        </p>
      ) : null}

      {/* El PORQUÉ, en grande y con su propio título: es el dato más valioso
          de la corrida. "Ganó A" no se convierte en nada; "ganó A porque el
          otro puso botines de gamuza con lluvia" es una regla. */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          ¿Por qué elegiste ese? (la comparación)
        </p>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="qué te decidió, qué te chocó, qué le faltó al otro — con tus palabras"
          className="rounded-xl border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
        />
      </div>

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
