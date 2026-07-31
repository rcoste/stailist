"use client";

import { useRef, useState } from "react";
import { MOTIVOS, type Referencia } from "@/lib/destilador-tipos";
import { guardarJuicio } from "./actions";

// Curaduría por swipe, pensada para el celular con una mano.
//
// La versión de teclado servía sentado frente a la computadora, y esto se hace
// en ratos muertos —de pasajero, en una sala de espera—, así que el gesto manda
// y todo tiene que caer bajo el pulgar. Misma mecánica que el deck de gustos
// (pointer events + transform, sin librerías): arrastrar decide, y los botones
// grandes son el camino garantizado cuando el gesto no sale.
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

  if (!foto) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-lg font-semibold text-ink">Terminaste {estilo}</p>
        <p className="text-sm text-muted">
          {sirven} de {fotos.length} sirven. Cambia de estilo arriba.
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
        <span>
          {i + 1} de {fotos.length}
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

      {/* 52vh en el celular NO es un número al aire: es lo que deja los botones
          de decisión dentro de la primera pantalla, con la cabecera del admin y
          los chips arriba. Más alto y hay que hacer scroll para decidir. */}
      <div className="relative h-[52vh] w-full select-none sm:h-[70vh]">
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
            <img
              src={foto.url}
              alt="referencia"
              draggable={false}
              className="h-full w-full object-cover"
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

          <button
            onClick={() => guardar(foto.id, { mio: !foto.mio })}
            aria-label="así me vestiría yo"
            className={`absolute bottom-4 right-4 rounded-full px-3 py-2 text-sm backdrop-blur ${
              foto.mio ? "bg-ink text-bg" : "bg-bg/80 text-ink"
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
          Arrastra la foto: derecha sirve, izquierda no. El ★ es aparte — marca tu
          gusto sin afectar el estilo.
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
