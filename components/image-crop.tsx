"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";

// Recortador táctil simple (sin librerías, por el design system): un recuadro
// sobre la foto que se mueve (arrastrando dentro) y se redimensiona (esquinas).
// "usar" devuelve la región recortada como dataURL JPEG. Sirve para aislarte en
// una foto de grupo antes de que la IA lea las prendas.
type Rect = { x: number; y: number; w: number; h: number }; // px de la caja mostrada
type Corner = "nw" | "ne" | "sw" | "se";
type DragMode = "move" | Corner;

/** `document` no existe en el render del servidor; el portal espera al cliente. */
function useMontado(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN = 44; // lado mínimo del recuadro

export function ImageCrop({
  src,
  onDone,
  onCancel,
  title = "recorta a tu prenda",
}: {
  src: string;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
  /** Copy del encabezado (prendas vs cara). */
  title?: string;
}) {
  const montado = useMontado();
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; orig: Rect } | null>(null);
  // Último tamaño MOSTRADO conocido. Sirve para dos cosas: crear el recuadro en
  // cuanto la imagen tenga medidas, y re-escalarlo si esas medidas cambian.
  const disp = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  function dispSize() {
    const r = imgRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0 };
  }

  // El recuadro NO puede depender solo de onLoad. Ese evento se dispara cuando la
  // imagen termina de decodificar, que puede ser ANTES de que el layout le dé
  // tamaño (pasa con data URLs, imágenes en caché, o si el contenedor aún no se
  // midió). El código anterior hacía `if (!w || !h) return` y no reintentaba
  // nunca: sin recuadro, "usar" salía por su propio guard sin hacer nada y la
  // persona veía su foto sin recortar, como si el ajuste se hubiera perdido.
  //
  // Un ResizeObserver sobre la imagen cubre todos los casos: la primera medida
  // válida crea el recuadro, y cualquier cambio posterior (girar el teléfono,
  // aparecer el teclado) lo re-escala en proporción para que la selección siga
  // encuadrando lo mismo.
  const ajustar = useCallback(() => {
    const { w, h } = dispSize();
    if (!w || !h) return;
    const prev = disp.current;
    disp.current = { w, h };
    setRect((r) => {
      if (!r) {
        const rw = w * 0.8;
        const rh = h * 0.8;
        return { x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh };
      }
      if (!prev.w || !prev.h || (prev.w === w && prev.h === h)) return r;
      const fx = w / prev.w;
      const fy = h / prev.h;
      return { x: r.x * fx, y: r.y * fy, w: r.w * fx, h: r.h * fy };
    });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(img);
    return () => ro.disconnect();
  }, [ajustar, src]);

  function start(e: React.PointerEvent, mode: DragMode) {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: rect };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const { w: bw, h: bh } = dispSize();
    if (d.mode === "move") {
      setRect({
        ...d.orig,
        x: clamp(d.orig.x + dx, 0, bw - d.orig.w),
        y: clamp(d.orig.y + dy, 0, bh - d.orig.h),
      });
      return;
    }
    // Redimensión por esquina: mueve el borde arrastrado, respeta el opuesto.
    let x = d.orig.x;
    let y = d.orig.y;
    let x2 = d.orig.x + d.orig.w;
    let y2 = d.orig.y + d.orig.h;
    if (d.mode === "nw" || d.mode === "sw") x = clamp(d.orig.x + dx, 0, x2 - MIN);
    if (d.mode === "ne" || d.mode === "se") x2 = clamp(x2 + dx, x + MIN, bw);
    if (d.mode === "nw" || d.mode === "ne") y = clamp(d.orig.y + dy, 0, y2 - MIN);
    if (d.mode === "sw" || d.mode === "se") y2 = clamp(y2 + dy, y + MIN, bh);
    setRect({ x, y, w: x2 - x, h: y2 - y });
  }

  function end() {
    drag.current = null;
  }

  function usar() {
    const img = imgRef.current;
    const { w: dw } = dispSize();
    // Sin recuadro o sin medidas no se puede recortar. Antes esto salía en
    // silencio y parecía que el botón no servía; ahora al menos no rompe y el
    // caso ya no debería ocurrir (ver el ResizeObserver de arriba).
    if (!img || !rect || !dw) return;
    const scale = img.naturalWidth / dw; // mostrado → natural
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w * scale));
    canvas.height = Math.max(1, Math.round(rect.h * scale));
    canvas
      .getContext("2d")
      ?.drawImage(
        img,
        rect.x * scale,
        rect.y * scale,
        rect.w * scale,
        rect.h * scale,
        0,
        0,
        canvas.width,
        canvas.height
      );
    onDone(canvas.toDataURL("image/jpeg", 0.85));
  }

  const handle = (corner: Corner, pos: string) => (
    <span
      onPointerDown={(e) => start(e, corner)}
      onPointerMove={move}
      onPointerUp={end}
      className={`absolute h-6 w-6 touch-none rounded-full border-2 border-on-accent bg-accent ${pos}`}
    />
  );

  // VA POR PORTAL AL BODY, y no donde lo cuelguen.
  //
  // Los dos flujos que lo abren —el carrete de prendas y el espejo— lo
  // renderizan DENTRO de su hoja. Una hoja es `fixed inset-0 z-50` con una
  // animación de transform, así que: (1) el recortador, siendo descendiente, no
  // puede pintarse por encima del contexto de apilamiento de su hoja aunque
  // también pida z-50, y (2) mientras corre esa animación el transform del
  // ancestro se vuelve el bloque contenedor de sus `fixed` y lo encierra dentro
  // de la caja de la hoja.
  //
  // Resultado, que Roberto fotografió probando el multiupload: la barra de
  // "cancelar / recorta a tu prenda / usar" asomando DEBAJO de la hoja de
  // "revisa tus fotos", con las dos capas visibles a la vez y el recortador
  // inservible.
  //
  // Portarlo al body lo arregla en los tres sitios de una vez y, más
  // importante, deja de depender de dónde lo monten: quien añada un cuarto no
  // tiene que enterarse de nada. Es la misma lección que ya costó el drawer que
  // no cerraba (los fixed hijos de la tab bar, que también lleva translate).
  //
  // LA GRADA: z-[75]. El proyecto apila así — 50 hojas normales, 60 y 70 hojas
  // a pantalla completa (viaje, try-on, cartera), 80 los hints. El recortador
  // tiene que ganarle a CUALQUIER hoja, porque siempre se abre desde una y la
  // hoja sigue viva detrás (al cancelar se vuelve a ella). Empatar a 50, que es
  // lo que hacía, era justo el bug.
  if (!montado) return null;
  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-on-accent/80 hover:text-on-accent"
        >
          cancelar
        </button>
        <span className="text-sm font-semibold text-on-accent">{title}</span>
        <button
          type="button"
          onClick={usar}
          className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep"
        >
          <Icon name="check" size={15} strokeWidth={2.2} /> usar
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-3 pb-4">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="Foto a recortar"
            onLoad={ajustar}
            className="max-h-[75dvh] max-w-full select-none"
            draggable={false}
          />
          {rect ? (
            <div
              onPointerDown={(e) => start(e, "move")}
              onPointerMove={move}
              onPointerUp={end}
              className="absolute touch-none border-2 border-on-accent"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                // Oscurece TODO lo de afuera del recuadro con una sombra gigante.
                boxShadow: "0 0 0 9999px rgba(10,10,10,0.6)",
              }}
            >
              {handle("nw", "-left-3 -top-3")}
              {handle("ne", "-right-3 -top-3")}
              {handle("sw", "-bottom-3 -left-3")}
              {handle("se", "-bottom-3 -right-3")}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
