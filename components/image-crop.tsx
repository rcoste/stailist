"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icon";

// Recortador táctil simple (sin librerías, por el design system): un recuadro
// sobre la foto que se mueve (arrastrando dentro) y se redimensiona (esquinas).
// "usar" devuelve la región recortada como dataURL JPEG. Sirve para aislarte en
// una foto de grupo antes de que la IA lea las prendas.
type Rect = { x: number; y: number; w: number; h: number }; // px de la caja mostrada
type Corner = "nw" | "ne" | "sw" | "se";
type DragMode = "move" | Corner;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN = 44; // lado mínimo del recuadro

export function ImageCrop({
  src,
  onDone,
  onCancel,
}: {
  src: string;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; orig: Rect } | null>(null);

  function dispSize() {
    const r = imgRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0 };
  }

  // Recuadro inicial: 80% centrado sobre la caja mostrada de la imagen.
  function onImgLoad() {
    const { w, h } = dispSize();
    if (!w || !h) return;
    const rw = w * 0.8;
    const rh = h * 0.8;
    setRect({ x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh });
  }

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
    if (!img || !rect) return;
    const scale = img.naturalWidth / dispSize().w; // mostrado → natural
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-on-accent/80 hover:text-on-accent"
        >
          cancelar
        </button>
        <span className="text-sm font-semibold text-on-accent">recorta a tu prenda</span>
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
            onLoad={onImgLoad}
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
    </div>
  );
}
