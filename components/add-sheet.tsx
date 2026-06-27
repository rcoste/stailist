"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { AddPhotoFlow, type AddFlowHandle } from "@/components/add-photo-flow";
import { ImportCarreteFlow } from "@/components/import-carrete-flow";

// Punto único de entrada para sumar ropa (handoff: hoja "Agregar al clóset").
// Reemplaza los 3 botones sueltos: el botón "+ Agregar" abre una hoja con las 3
// formas (foto · carrete · biblioteca). Foto y carrete viven aquí en modo
// headless y se disparan vía ref; biblioteca navega a su pantalla.
export function AddSheet({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const photoRef = useRef<AddFlowHandle>(null);
  const carreteRef = useRef<AddFlowHandle>(null);

  function choose(action: () => void) {
    setOpen(false);
    // Deja cerrar la hoja antes de abrir el selector de archivos / navegar.
    requestAnimationFrame(action);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        <Icon name="mas" size={18} strokeWidth={2} />
        agregar
      </button>

      {/* Flujos en modo headless: sin botón propio, los dispara la hoja. */}
      <AddPhotoFlow userId={userId} headless ref={photoRef} />
      <ImportCarreteFlow headless ref={carreteRef} />

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-ink/40" />
          <div
            className="relative z-10 w-full max-w-[430px] rounded-t-[18px] bg-surface px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2"
            style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3.5 mt-1.5 h-1 w-9 rounded-full bg-line" />
            <h3 className="mx-1 mb-3 text-[19px] italic text-ink display">
              agregar al clóset
            </h3>
            <Option
              icon="camara"
              title="tomar una foto"
              sub="una prenda, la leo y la subo"
              onClick={() => choose(() => photoRef.current?.start())}
            />
            <Option
              icon="destello"
              title="importar del carrete"
              sub="sube fotos de tu ropa y las leo todas"
              onClick={() => choose(() => carreteRef.current?.start())}
            />
            <Option
              icon="libro"
              title="explorar la biblioteca"
              sub="marca las básicas que ya tienes"
              onClick={() => choose(() => router.push("/closet/biblioteca"))}
            />
          </div>
        </div>
      ) : null}
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
