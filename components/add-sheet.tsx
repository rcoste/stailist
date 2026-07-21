"use client";

import { useImperativeHandle, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
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
          data-hint-target="closet-agregar"
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
        <Option
          icon="camara"
          title="sube una prenda"
          sub="una foto de algo suelto, tipo unos tenis"
          onClick={() => choose(() => photoRef.current?.start())}
        />
        <Option
          icon="destello"
          title="sube varias de golpe"
          sub="fotos de tu ropa o con la ropa puesta; saco cada prenda"
          onClick={() => choose(() => carreteRef.current?.start())}
        />
        <Option
          icon="libro"
          title="explora la biblioteca"
          sub="marca los básicos que ya tienes"
          onClick={() => choose(() => router.push("/closet/biblioteca"))}
        />
      </Sheet>
    </>
  );
}

function Option({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: IconName;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2.5 flex w-full items-center gap-3.5 rounded-sm border border-line bg-surface px-3.5 py-3.5 text-left transition-colors hover:border-accent"
    >
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-sm border border-line text-ink">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <span className="display text-[13.5px] text-muted">{sub}</span>
      </span>
      <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
    </button>
  );
}
