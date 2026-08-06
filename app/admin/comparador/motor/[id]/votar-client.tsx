"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";
import { votarParMotor, completarMarcas } from "../../motor-actions";

// Votar a ciegas, un par a la vez. Las columnas se llaman "Look A / Look B" y
// el orden viene barajado del servidor: aquí NADIE sabe qué variante es cuál —
// el voto viaja como izquierda/derecha y el servidor lo resuelve.
//
// UNA PESTAÑA POR LOOK, y esa decisión manda todo lo demás. La primera versión
// apilaba los 3 looks de cada lado en dos columnas: en un celular eso deja
// ~170px por lado, así que las prendas salían a 56px ("no se ven, están muy
// chiquitas"), el try-on era lo único legible porque ocupaba el ancho completo,
// y las etiquetas de defecto caían al fondo de la columna leyéndose como si
// aplicaran a los tres looks. Mostrando UN look por lado a la vez, las prendas
// caben al doble y cada control —👍/👎, defectos, comentario, try-on— vive
// dentro del look al que pertenece.
//
// Lado a lado se queda: comparar A contra B ES la tarea, y apilarlos obligaría
// a recordar uno mientras se mira el otro.

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
  /** El evento concreto del brief (pool v2 en adelante). */
  plan: string | null;
  formalidad: string | null;
  izq: LookParaVotar[];
  der: LookParaVotar[];
  claveIzq: string;
  claveDer: string;
};

type PorLook<T> = Record<number, T>;

/** "1, 2 y 3" — el botón nombra lo que falta, no cuenta cuántos faltan. */
function listaEnEspanol(ns: number[]): string {
  if (ns.length <= 1) return String(ns[0] ?? "");
  return `${ns.slice(0, -1).join(", ")} y ${ns[ns.length - 1]}`;
}

function Lado({
  titulo,
  look,
  indice,
  marca,
  setMarca,
  defectos,
  setDefectos,
  comentario,
  setComentario,
  tryon,
  pedirTryon,
  rendereando,
}: {
  titulo: string;
  look: LookParaVotar | undefined;
  indice: number;
  marca?: "arriba" | "abajo";
  setMarca: (m: "arriba" | "abajo" | undefined) => void;
  defectos: string[];
  setDefectos: (d: string[]) => void;
  comentario?: string;
  setComentario: (c: string) => void;
  tryon?: { image?: string; error?: string };
  pedirTryon: () => void;
  rendereando: boolean;
}) {
  const alternar = (clave: string) =>
    setDefectos(
      defectos.includes(clave) ? defectos.filter((x) => x !== clave) : [...defectos, clave]
    );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>

      {!look ? (
        <p className="text-xs text-muted">este lado no armó un {indice + 1}º look</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
          {/* min-h de dos renglones: sin esto un nombre que envuelve a 3
              líneas empuja sus prendas más abajo que las del otro lado, y la
              comparación prenda-contra-prenda deja de ser posible de un
              vistazo. Es una pantalla de comparar: las dos columnas tienen que
              arrancar a la misma altura. */}
          <div className="flex min-h-[2.6rem] items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-ink">
              {look.nombre}
            </p>
            <span className="flex shrink-0 gap-1">
              <button
                onClick={() => setMarca(marca === "arriba" ? undefined : "arriba")}
                aria-label="este look sí"
                className={`rounded-full border px-2 py-0.5 text-sm ${
                  marca === "arriba" ? "border-ink bg-ink text-bg" : "border-line text-muted"
                }`}
              >
                👍
              </button>
              <button
                onClick={() => setMarca(marca === "abajo" ? undefined : "abajo")}
                aria-label="este look no"
                className={`rounded-full border px-2 py-0.5 text-sm ${
                  marca === "abajo" ? "border-error text-error" : "border-line text-muted"
                }`}
              >
                👎
              </button>
            </span>
          </div>

          {/* Las prendas, EN GRANDE. Dos por fila dentro de la columna: con un
              solo look en pantalla caben al doble que antes. */}
          <div className="grid grid-cols-2 gap-1.5">
            {look.prendas.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <span className="relative block aspect-square w-full overflow-hidden rounded-lg border border-line">
                  {p.imagen ? (
                    <Image
                      src={p.imagen}
                      alt={p.nombre}
                      fill
                      sizes="(max-width: 430px) 22vw, 120px"
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
                <span className="line-clamp-2 text-center text-[11px] leading-tight text-muted">
                  {p.nombre}
                </span>
              </div>
            ))}
          </div>

          {tryon?.image ? (
            <span className="relative block aspect-[3/4] overflow-hidden rounded-lg border border-line">
              <Image
                src={tryon.image}
                alt={`${look.nombre} en tu avatar`}
                fill
                sizes="(max-width: 430px) 45vw, 260px"
                loading="eager"
                className="object-cover"
              />
            </span>
          ) : null}
          {tryon?.error ? (
            <p className="text-xs text-error">
              {tryon.error === "sin_avatar" ? "no tienes avatar" : `sin render (${tryon.error})`}
            </p>
          ) : null}
          {!tryon?.image ? (
            <button
              disabled={rendereando}
              onClick={pedirTryon}
              className="rounded-lg border border-line py-1.5 text-xs font-semibold text-ink active:bg-tile disabled:opacity-50"
            >
              {rendereando ? "vistiendo…" : "verme con este"}
            </button>
          ) : null}

          <p className="text-xs leading-relaxed text-muted">{look.explicacion}</p>
          {look.tip ? (
            <p className="text-xs leading-relaxed text-muted">✦ {look.tip}</p>
          ) : null}

          {/* Los defectos, DENTRO del look. Antes vivían al fondo de la columna,
              después de los tres, y se leían como si aplicaran a todos. */}
          <div className="flex flex-wrap gap-1">
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

          <textarea
            value={comentario ?? ""}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            placeholder="qué le viste a este (opcional)"
            className="rounded-lg border border-line bg-bg p-2 text-xs text-ink placeholder:text-muted"
          />
        </div>
      )}
    </div>
  );
}

export function VotarClient({
  pares,
  yaHechos,
  total,
  tamano,
  modo = "votar",
  corridaId,
}: {
  pares: ParParaVotar[];
  yaHechos: number;
  total: number;
  tamano: string;
  /**
   * "votar": el par no tiene voto todavía y se decide aquí.
   * "marcar": el par YA se votó y solo falta el diagnóstico look por look.
   *
   * Es un modo y no una segunda pantalla porque la primera versión SÍ fue una
   * segunda pantalla: prendas a 56px, sin try-on, sin etiquetas de defecto y
   * con los looks apilados. Mirar un look para juzgarlo es el mismo trabajo
   * las dos veces; que se vea distinto según de dónde entraste solo hacía la
   * marca peor que el voto.
   */
  modo?: "votar" | "marcar";
  corridaId: string;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [look, setLook] = useState(0);
  const [marcIzq, setMarcIzq] = useState<PorLook<"arriba" | "abajo">>({});
  const [marcDer, setMarcDer] = useState<PorLook<"arriba" | "abajo">>({});
  const [defIzq, setDefIzq] = useState<PorLook<string[]>>({});
  const [defDer, setDefDer] = useState<PorLook<string[]>>({});
  const [comIzq, setComIzq] = useState<PorLook<string>>({});
  const [comDer, setComDer] = useState<PorLook<string>>({});
  const [votos, setVotos] = useState<PorLook<"izq" | "der" | "empate">>({});
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Try-on por VARIANTE y por índice de look. La respuesta no dice izq/der
  // para no delatar el ciego; se mapea abajo con las claves del servidor.
  const [tryon, setTryon] = useState<
    Record<string, PorLook<{ image?: string; error?: string }>>
  >({});
  const [renderizando, setRenderizando] = useState<number | null>(null);

  const par = pares[idx];
  const nLooks = Math.max(par.izq.length, par.der.length);

  // Pide el look `indice` de LOS DOS lados. Nunca uno solo: si un lado tuviera
  // render y el otro no, la comparación mediría el formato, no el look.
  const verEnAvatar = async (indice: number) => {
    if (renderizando !== null) return;
    setRenderizando(indice);
    setError(null);
    try {
      const r = await fetch("/api/admin/comparador/tryon-par", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parId: par.parId, indice }),
      });
      const json = (await r.json()) as {
        porVariante?: Record<string, { image?: string; error?: string }>;
        error?: string;
      };
      if (json.error) setError(json.error);
      else {
        const porVariante = json.porVariante ?? {};
        setTryon((prev) => {
          const next = { ...prev };
          for (const [clave, v] of Object.entries(porVariante)) {
            next[clave] = { ...(next[clave] ?? {}), [indice]: v };
          }
          return next;
        });
      }
    } catch {
      setError("no se pudo generar el try-on");
    } finally {
      setRenderizando(null);
    }
  };

  const votar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    const r =
      modo === "marcar"
        ? await completarMarcas(
            par.parId,
            { izq: marcIzq, der: marcDer },
            { izq: comIzq, der: comDer },
            { izq: defIzq, der: defDer }
          )
        : await votarParMotor(
            par.parId,
            votos,
            { izq: defIzq, der: defDer },
            nota,
            { izq: marcIzq, der: marcDer },
            { izq: comIzq, der: comDer }
          );
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "no se pudo guardar");
      return;
    }
    setMarcIzq({});
    setMarcDer({});
    setDefIzq({});
    setDefDer({});
    setComIzq({});
    setComDer({});
    setVotos({});
    setNota("");
    setTryon({});
    setLook(0);
    if (idx + 1 < pares.length) setIdx(idx + 1);
    else if (modo === "marcar") router.push(`/admin/comparador/motor/${corridaId}`);
    else router.refresh();
  };

  const marcados = Object.keys(marcIzq).length + Object.keys(marcDer).length;

  // Los looks que SE PUEDEN comparar: los dos lados armaron uno con ese índice.
  // Si un lado solo trajo dos looks, el tercero no tiene contra qué medirse y
  // exigir un voto ahí sería pedir algo imposible.
  const comparables = Array.from({ length: nLooks }, (_, i) => i).filter(
    (i) => par.izq[i] && par.der[i]
  );
  // Marcando, la puerta la cierra el 👍/👎 de CADA look existente (los dos
  // lados, aunque uno tenga menos): la marca es diagnóstico por look, no una
  // comparación, así que un look sin par de enfrente igual se puede juzgar.
  const sinMarca = Array.from({ length: nLooks }, (_, i) => i).filter(
    (i) => (par.izq[i] && !marcIzq[i]) || (par.der[i] && !marcDer[i])
  );
  const faltan = modo === "marcar" ? sinMarca : comparables.filter((i) => !votos[i]);
  // El guardado se abre hasta calificar todo. Antes bastaba con un voto:
  // Roberto votaba el primero, el par se guardaba, y los looks 2 y 3 se
  // quedaban sin ver — 99 de 119 en el primer veredicto. El botón que deja
  // avanzar a medias termina midiendo lo que nadie miró.
  const listo =
    faltan.length === 0 && (modo === "marcar" || Object.keys(votos).length > 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">
            {modo === "marcar" ? "Completar las marcas" : "¿Cuál quedó mejor?"}
          </h1>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {yaHechos + idx + 1} de {total}
          </span>
        </div>
        <p className="text-sm text-muted">
          Brief: <span className="font-semibold text-ink">{par.etiqueta}</span>
          {tamano === "vistazo" && modo === "votar"
            ? " · vistazo: caza defectos, aquí no se corona a nadie"
            : ""}
          {modo === "marcar"
            ? " · este par ya se votó; falta el diagnóstico look por look. Sigue ciego: no se revela cuál columna es cuál."
            : ""}
        </p>
        {/* El evento concreto, tal cual lo recibió el motor. Sin esto, "evento"
            a secas no se puede calificar: una boda y una cena con amigos no
            comparten piso de formalidad ni calzado. */}
        {par.plan ? (
          <p className="text-sm text-ink">
            Pidió: “{par.plan}”
            {par.formalidad ? (
              <span className="text-muted"> · {par.formalidad}</span>
            ) : null}
          </p>
        ) : null}
      </header>

      {/* Pestañas por look: cada lado muestra UNO a la vez, y así las prendas
          caben grandes. El punto marca los que ya llevan 👍/👎. */}
      <div className="flex gap-2">
        {Array.from({ length: nLooks }, (_, i) => (
          <button
            key={i}
            onClick={() => setLook(i)}
            className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${
              look === i ? "border-accent bg-accent-soft text-ink" : "border-line text-muted"
            }`}
          >
            Look {i + 1}
            {faltan.includes(i) ? "" : " ✓"}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <Lado
          titulo="Look A"
          look={par.izq[look]}
          indice={look}
          marca={marcIzq[look]}
          setMarca={(m) => {
            const next = { ...marcIzq };
            if (m) next[look] = m;
            else delete next[look];
            setMarcIzq(next);
          }}
          defectos={defIzq[look] ?? []}
          setDefectos={(d) => setDefIzq({ ...defIzq, [look]: d })}
          comentario={comIzq[look]}
          setComentario={(c) => setComIzq({ ...comIzq, [look]: c })}
          tryon={tryon[par.claveIzq]?.[look]}
          pedirTryon={() => verEnAvatar(look)}
          rendereando={renderizando === look}
        />
        <Lado
          titulo="Look B"
          look={par.der[look]}
          indice={look}
          marca={marcDer[look]}
          setMarca={(m) => {
            const next = { ...marcDer };
            if (m) next[look] = m;
            else delete next[look];
            setMarcDer(next);
          }}
          defectos={defDer[look] ?? []}
          setDefectos={(d) => setDefDer({ ...defDer, [look]: d })}
          comentario={comDer[look]}
          setComentario={(c) => setComDer({ ...comDer, [look]: c })}
          tryon={tryon[par.claveDer]?.[look]}
          pedirTryon={() => verEnAvatar(look)}
          rendereando={renderizando === look}
        />
      </div>

      {/* El voto del LOOK visible, pegado a lo que se está viendo. Antes los
          botones estaban al final de la página y se leían como si aplicaran al
          look en pantalla cuando en realidad cubrían los tres: Roberto votó 16
          pares guiándose solo por el primero sin saberlo.

          Marcando NO hay botones de voto, y no es un olvido: estos pares ya
          tienen voto y su corrida ya se puede leer con el reveal encendido.
          Re-votar con el marcador a la vista no completa una medición, la
          edita — es justo lo que el pre-registro existe para impedir. Si un
          par de esos se quiere volver a juzgar, se vuelve a correr. */}
      {modo === "votar" ? (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          ¿Cuál gana en el look {look + 1}?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["izq", "empate", "der"] as const).map((op) => (
            <button
              key={op}
              onClick={() =>
                setVotos((prev) => {
                  const next = { ...prev };
                  if (next[look] === op) delete next[look];
                  else next[look] = op;
                  return next;
                })
              }
              className={`rounded-xl border py-3 text-sm font-semibold ${
                votos[look] === op
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink active:bg-tile"
              }`}
            >
              {op === "izq" ? "Gana A" : op === "der" ? "Gana B" : "Empate"}
            </button>
          ))}
        </div>
      </div>
      ) : null}

      {modo === "votar" ? (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          ¿Por qué? (opcional, de todo el par)
        </p>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="qué te decidió, qué te chocó, qué le faltó al otro — con tus palabras"
          className="rounded-xl border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
        />
      </div>
      ) : null}

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button
        disabled={guardando || !listo}
        onClick={votar}
        className="rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
      >
        {guardando
          ? "Guardando…"
          : faltan.length === 1
            ? `Falta ${modo === "marcar" ? "marcar" : "votar"} el look ${faltan[0] + 1}`
            : faltan.length
              ? `Faltan los looks ${listaEnEspanol(faltan.map((i) => i + 1))}`
              : modo === "marcar"
                ? idx + 1 < pares.length
                  ? "Guardar y siguiente"
                  : "Guardar y terminar"
                : "Guardar el par"}
      </button>
      <p className="text-xs text-muted">
        {modo === "marcar" ? (
          <>
            Marca 👍/👎 los {nLooks * 2} looks del par (los dos lados) para
            guardar: la marca es diagnóstico look por look, y una a medias deja
            el marcador diciendo “0 👎” cuando lo que pasó es que nadie los
            miró. El voto de este par no se toca —ya está emitido y su corrida
            ya se puede leer—; esto solo completa lo que falta. Llevas{" "}
            {marcados} de {nLooks * 2}.
          </>
        ) : (
          <>
            Votas look contra look, y para guardar hay que votar{" "}
            {comparables.length === 1 ? "el que hay" : `los ${comparables.length}`}:
            el resultado del PAR sale por mayoría, así que un par decidido solo
            por el primero deja los otros sin mirar. La unidad de la prueba
            sigue siendo el par, porque los looks de un lado salen de una sola
            llamada al motor y no son votos independientes. El 👍/👎 es aparte y
            sigue siendo opcional — llevas {marcados} en este par.
          </>
        )}
      </p>
    </div>
  );
}
