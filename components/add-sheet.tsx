"use client";

import { useImperativeHandle, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { AddOptions } from "@/components/add-options";
import { AddPhotoFlow, type AddFlowHandle } from "@/components/add-photo-flow";
import { ImportCarreteFlow } from "@/components/import-carrete-flow";
import { Sheet } from "@/components/sheet";

// Punto único de entrada para sumar ropa (handoff: hoja "Agregar al clóset").
// Reemplaza los 3 botones sueltos: el botón "+ Agregar" abre una hoja con las 3
// formas (foto · carrete · biblioteca). Foto y carrete viven aquí en modo
// headless y se disparan vía ref; biblioteca navega a su pantalla.
// variant: "chip" = el botón compacto de acento del Clóset (default).
// "ghost" = acción secundaria a lo ancho, con borde y sin relleno — vive bajo
// el CTA del home (Hoy idle): añadir prendas es la acción #2 por frecuencia,
// pero JAMÁS debe competir visualmente con "armar mi look de hoy".
// "headless" = sin botón propio: la hoja "Más" de la tab bar la abre por ref,
// para reusar ESTA hoja en vez de repetir sus 3 formas allá (una fila, no tres).
export type AddSheetHandle = { open: () => void };

export function AddSheet({
  userId,
  variant = "chip",
  ref,
}: {
  userId: string;
  variant?: "chip" | "ghost" | "headless";
  ref?: RefObject<AddSheetHandle | null>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const photoRef = useRef<AddFlowHandle>(null);
  const carreteRef = useRef<AddFlowHandle>(null);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

  function choose(action: () => void) {
    setOpen(false);
    // Deja cerrar la hoja antes de abrir el selector de archivos / navegar.
    requestAnimationFrame(action);
  }

  return (
    <>
      {variant === "headless" ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          // Lo señala el tip que avisa que este botón tomó el lugar del bloque
          // de tres opciones. En /closet solo se renderiza la variante "chip",
          // así que no compite con la "ghost" del home.
          data-hint-target="closet-boton-agregar"
          className={
            variant === "ghost"
              ? "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm border border-line text-[15px] font-semibold text-ink transition-colors duration-200 hover:border-accent hover:text-accent"
              : "flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          }
        >
          <Icon name="mas" size={18} strokeWidth={2} />
          {variant === "ghost" ? "añadir prendas" : "agregar"}
        </button>
      )}

      {/* Flujos en modo headless: sin botón propio, los dispara la hoja. */}
      <AddPhotoFlow userId={userId} headless ref={photoRef} />
      <ImportCarreteFlow headless ref={carreteRef} />

      <Sheet open={open} onClose={() => setOpen(false)}>
        <h3 className="mx-1 mb-3 text-[19px] font-semibold text-ink">
          agregar al clóset
        </h3>
        <AddOptions
          onFoto={() => choose(() => photoRef.current?.start())}
          onCarrete={() => choose(() => carreteRef.current?.start())}
          onBiblioteca={() => choose(() => router.push("/closet/biblioteca"))}
        />
      </Sheet>
    </>
  );
}
