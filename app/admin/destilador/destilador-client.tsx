"use client";

import { useEffect, useRef, useState } from "react";
import { MOTIVOS, type Referencia } from "@/lib/destilador-tipos";
import { guardarJuicio } from "./actions";

// Curaduría por swipe, pensada para el celular con una mano.
//
// El gesto manda porque esto se hace en ratos muertos —de pasajero, en una sala
// de espera— y todo tiene que caer bajo el pulgar. Misma mecánica que el deck
// de gustos (pointer events + transform, sin librerías): arrastrar decide, y
// los botones grandes son el camino garantizado cuando el gesto no sale.
//
// El teclado volvió porque las tandas grandes (300+ fotos) se curan sentado, y
// ahí arrastrar con el mouse es más lento y más cansado que una flecha. Conviven:
// el gesto para el celular, las flechas para el escritorio.
const UMBRAL = 90; // px para que cuente como decisión
const FLICK = 0.6; // px/ms — un aventón rápido decide aunque no cruce el umbral

export function DestiladorClient({
  referencias,
  estilo,
}: {
  referencias: Referencia[];
  estilo: string;
}) {
  const [fotos, setFotos] = useState(referencias);
  const [i, setI] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, activo: false });
  const [saliendo, setSaliendo] = useState<"left" | "right" | null>(null);
  // Tras un "no sirve" se ofrece el motivo SIN bloquear: si sigue swipeando, se
  // queda sin motivo y no pasa nada. Pedirlo obligatorio mataría el ritmo, que
  // es lo único que hace viable revisar 90 fotos.
  const [pidiendoMotivo, setPidiendoMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inicio = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, t: 0, vx: 0 });

  const foto = fotos[i];
  const juzgadas = fotos.filter((f) => f.sirve !== null).length;
  const sirven = fotos.filter((f) => f.sirve === true).length;

  function guardar(id: string, cambios: Parameters<typeof guardarJuicio>[1]) {
    setFotos((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...cambios } : f))
    );
    guardarJuicio(id, cambios).then((r) => {
      if ("error" in r) setError("No se guardó — revisa tu conexión.");
      else setError(null);
    });
  }

  function decidir(sirve: boolean) {
    if (!foto || saliendo) return;
    const id = foto.id;
    setSaliendo(sirve ? "right" : "left");
    guardar(id, { sirve });
    setTimeout(() => {
      setSaliendo(null);
      setDrag({ x: 0, y: 0, activo: false });
      setI((n) => n + 1);
      setPidiendoMotivo(sirve ? null : id);
    }, 200);
  }

  /**
   * "Ya vi este outfit" — sale de la destilación sin contar como rechazo.
   *
   * Una sesión de fotos produce varias tomas del mismo look, y el dedup por
   * píxeles no las caza: basta con que el modelo gire para que el hash cambie.
   * Un look repetido cuenta como patrón repetido, así que la receta acabaría
   * describiendo la sesión de fotos de alguien en vez del estilo.
   *
   * Se intentó resolver con un pase de visión que comparaba pares. Era
   * sobre-ingeniería: quien cura ya está mirando las fotos una por una, y
   * reconocer que un outfit se repite le toma medio segundo — contra doce
   * minutos de máquina y una llamada de IA por par.
   *
   * Va aparte de "no va" a propósito: la foto puede ser un ejemplo perfecto del
   * estilo, solo que ya lo contamos. Marcarla como rechazo ensuciaría la señal
   * de qué arruina un estilo.
   */
  function repetido() {
    if (!foto || saliendo) return;
    const id = foto.id;
    setSaliendo("left");
    guardar(id, { sirve: false, motivo: "mismo-outfit" });
    setTimeout(() => {
      setSaliendo(null);
      setDrag({ x: 0, y: 0, activo: false });
      setI((n) => n + 1);
      setPidiendoMotivo(null);
    }, 200);
  }

  function onDown(e: React.PointerEvent) {
    if (saliendo) return;
    inicio.current = { x: e.clientX, y: e.clientY };
    vel.current = { x: e.clientX, t: e.timeStamp, vx: 0 };
    setDrag({ x: 0, y: 0, activo: true });
    // El capture va en el CONTENEDOR, no en e.target: el target puede ser la
    // <img>, que React reutiliza entre fotos cambiándole el src — y un capture
    // sobre un nodo que cambia de contenido se pierde a media pasada.
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.activo || saliendo) return;
    const dt = e.timeStamp - vel.current.t;
    if (dt > 0) vel.current.vx = (e.clientX - vel.current.x) / dt;
    vel.current = { x: e.clientX, t: e.timeStamp, vx: vel.current.vx };
    setDrag({
      x: e.clientX - inicio.current.x,
      y: (e.clientY - inicio.current.y) * 0.4,
      activo: true,
    });
  }
  function onUp() {
    if (!drag.activo || saliendo) return;
    const flick = Math.abs(vel.current.vx) > FLICK && Math.abs(drag.x) > 24;
    if (flick || Math.abs(drag.x) > UMBRAL) decidir(drag.x > 0);
    else setDrag({ x: 0, y: 0, activo: false });
  }

  // Flechas para curar sentado: ← no va, → sirve, ↑ marca el gusto. Las mismas
  // direcciones que el gesto, para no tener que aprender dos mapas.
  //
  // El listener vive en window y no en un elemento con foco: tras cada decisión
  // la carta se desmonta, y un handler colgado de ella perdería el foco en la
  // primera flecha — se sentiría como que el teclado "se apaga" a la segunda foto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Si hay algo escribiendo (un input, un textarea), el teclado es suyo.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        decidir(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        decidir(true);
      } else if (e.key === "ArrowUp" && foto) {
        e.preventDefault();
        guardar(foto.id, { mio: !foto.mio });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        repetido();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!foto) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-lg font-semibold text-ink">Terminaste {estilo}</p>
        <p className="text-sm text-muted">
          {sirven} de {fotos.length} sirven. El estado de cada estilo está arriba.
        </p>
      </div>
    );
  }

  const x = saliendo === "right" ? 500 : saliendo === "left" ? -500 : drag.x;
  const rot = x / 18;
  const sello = Math.abs(x) > 24 ? (x > 0 ? "sirve" : "no") : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-muted">
        {/* El estilo va aquí, no solo en el panel: "1 de 34" a secas no dice de
            qué estilo, y con tres en la lista eso obliga a adivinar. */}
        <span>
          <b className="text-ink">{estilo}</b> · {i + 1} de {fotos.length}
        </span>
        <span>
          {juzgadas} juzgadas · {sirven} sirven
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-tile">
        <div
          className="h-full bg-ink transition-all duration-200"
          style={{ width: `${(juzgadas / fotos.length) * 100}%` }}
        />
      </div>

      {/* 44vh en el celular NO es un número al aire: es lo que deja los botones
          de decisión dentro de la primera pantalla, contando la cabecera del
          admin y el panel de estado. Más alto y hay que hacer scroll para
          decidir, que es justo lo que hace sentir que la herramienta pelea.
          En escritorio manda otra cosa: ahí se decide con las flechas, no con
          botones, así que la foto puede llenar la pantalla — y necesita hacerlo,
          porque lo que se juzga es el corte de la prenda. */}
      <div className="relative h-[44vh] w-full select-none sm:h-[82vh]">
        {/* La siguiente, atrás, para que se sienta una pila y no una foto suelta. */}
        {fotos[i + 1]?.url && (
          <div className="absolute inset-0 scale-95 overflow-hidden rounded-xl border border-line bg-tile opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage */}
            <img
              src={fotos[i + 1].url!}
              alt=""
              className="h-full w-full object-cover grayscale"
            />
          </div>
        )}

        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            transform: `translate(${x}px, ${drag.y}px) rotate(${rot}deg)`,
            transition: drag.activo ? "none" : "transform 200ms ease-out",
          }}
          className="absolute inset-0 touch-none overflow-hidden rounded-xl border border-line bg-tile"
        >
          {foto.url ? (
            /* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage */
            /* object-CONTAIN, no cover: recortar para llenar la carta le come
               los zapatos o el largo del pantalón, que es justo lo que hay que
               ver para decidir si el outfit sirve. Se prefiere la banda a los
               lados antes que juzgar media foto. */
            <img
              src={foto.url}
              alt="referencia"
              draggable={false}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
              No se pudo cargar la foto. Recarga la página para firmar de nuevo.
            </div>
          )}

          {sello && (
            <span
              className={`absolute top-5 rounded-full px-3 py-1.5 text-sm font-semibold uppercase tracking-wide ${
                sello === "sirve"
                  ? "left-5 bg-ink text-bg"
                  : "right-5 border border-ink bg-bg text-ink"
              }`}
            >
              {sello === "sirve" ? "sirve" : "no va"}
            </span>
          )}

          {/* Qué familia se está juzgando, SOBRE la foto: con la carta a 82vh
              el encabezado se sale de la pantalla, y "¿es buen ejemplo de
              esto?" no se puede contestar sin saber qué es "esto". Va abajo a
              la izquierda para no chocar con los sellos (arriba) ni con la
              estrella (abajo a la derecha). */}
          {/* Y con el estilo, LO QUE LA MÁQUINA LEYÓ de la foto: para qué
              ocasiones sirve, qué tan arreglada es y de qué clima. Roberto:
              "una cosa es sastre y otra para qué ocasión; no puedo decir qué tan
              bien está algo con info incompleta". Antes solo iba el estilo, y la
              ocasión se etiquetaba DESPUÉS de curar — así que nadie verificaba
              jamás esa etiqueta. Ése es el fallo que perdió el A/B de las fotos
              de inspiración: la máquina marcó "oficina" en looks casuales y no
              hubo quién la corrigiera. Aquí el mismo swipe contesta las dos
              cosas: ¿es del estilo? y ¿la máquina leyó bien la foto? */}
          <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-[65%] flex-wrap gap-1.5">
            <span className="rounded-full bg-bg/85 px-3 py-1.5 text-sm font-semibold text-ink backdrop-blur">
              {estilo}
            </span>
            {foto.registro ? (
              <span className="rounded-full bg-bg/85 px-2.5 py-1.5 text-xs text-ink backdrop-blur">
                {foto.registro}
              </span>
            ) : null}
            {foto.clima ? (
              <span className="rounded-full bg-bg/85 px-2.5 py-1.5 text-xs text-ink backdrop-blur">
                {foto.clima}
              </span>
            ) : null}
            {foto.ocasiones?.length ? (
              <span className="rounded-full bg-bg/85 px-2.5 py-1.5 text-xs text-ink backdrop-blur">
                {foto.ocasiones.join(" · ")}
              </span>
            ) : null}
          </div>

          {/* stopPropagation en pointerDown, no solo en click: el contenedor de
              la carta hace setPointerCapture al recibir el pointerdown, y un
              puntero capturado por el padre nunca completa el click en el
              botón — se veía como que la estrella no hacía nada. */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              guardar(foto.id, { mio: !foto.mio });
            }}
            aria-label="así me vestiría yo"
            className={`absolute bottom-4 right-4 rounded-full px-4 py-2.5 text-base backdrop-blur ${
              foto.mio ? "bg-ink text-bg" : "bg-bg/85 text-ink"
            }`}
          >
            ★
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => decidir(false)}
          className="flex-1 rounded-xl border border-line py-4 text-base font-semibold text-ink active:bg-tile"
        >
          No va
        </button>
        <button
          onClick={() => decidir(true)}
          className="flex-1 rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80"
        >
          Sirve
        </button>
      </div>

      {/* Más chico y aparte de los otros dos: no es una tercera opinión sobre
          la foto, es sacarla de la cuenta. Mezclarlo con "no va" perdería la
          diferencia entre "esto arruina el estilo" y "esto ya lo conté". */}
      <button
        onClick={repetido}
        className="self-center rounded-full border border-line px-4 py-2 text-sm text-muted active:bg-tile"
      >
        Ya vi este outfit
      </button>

      {pidiendoMotivo ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
          <span className="text-xs text-muted">¿Por qué no? (opcional)</span>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  guardar(pidiendoMotivo, { motivo: m.id });
                  setPidiendoMotivo(null);
                }}
                className="rounded-full border border-line px-3 py-2 text-sm text-ink active:bg-tile"
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-muted">
          <span className="hidden sm:inline">
            Flechas: ← no va · → sirve · ↑ tu gusto · ↓ ya lo vi.{" "}
          </span>
          <span className="sm:hidden">Arrastra la foto: derecha sirve, izquierda no. </span>
          El ★ es aparte — marca tu gusto sin afectar el estilo.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-line bg-surface p-3 text-center text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
