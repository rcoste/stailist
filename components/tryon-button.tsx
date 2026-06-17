"use client";

import Image from "next/image";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { TryonModal } from "@/components/tryon-modal";
import { useTryon } from "@/lib/use-tryon";

// Try-on en presentación "suelta" (thumbnail + botón). La usa el wow del
// onboarding. En Hoy el try-on vive dentro de la OutfitCard (ver use-tryon +
// outfit-card). La lógica es compartida vía useTryon.
export function TryonButton({
  outfitId,
  userId,
  initialImage = null,
}: {
  outfitId: string;
  userId: string;
  initialImage?: string | null;
}) {
  const t = useTryon({ outfitId, userId, initialImage, revealMode: "modal" });

  // Vista grande (modal). Cierra → vuelve al thumbnail (no a la nada).
  if (t.mode === "full" && t.image) {
    return (
      <>
        <TryonModal
          image={t.image}
          onClose={t.closeFull}
          onChangePhoto={t.pickPhoto}
        />
        {t.fileInput}
      </>
    );
  }

  if (t.mode === "sin_avatar") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">
          Para verte con el look, sube una foto tuya de cuerpo completo
        </p>
        <p className="text-xs text-muted">
          De pie, buena luz, fondo simple. Solo una vez — la reusamos para todos
          tus looks.
        </p>
        <button
          type="button"
          onClick={t.pickPhoto}
          className="min-h-11 rounded-sm bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
        >
          Subir mi foto
        </button>
        {t.fileInput}
      </div>
    );
  }

  // Cargando: botón con spinner.
  if (t.mode === "gen" || t.mode === "up") {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled
          className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-accent bg-accent-soft text-sm font-medium text-ink disabled:opacity-60"
        >
          <Spinner className="h-4 w-4" />
          {t.mode === "up" ? "Guardando tu foto…" : "Creando tu look… (~20s)"}
        </button>
        {t.fileInput}
      </div>
    );
  }

  // Ya hay try-on: thumbnail persistente, tappable para ver en grande.
  if (t.image) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={t.openFull}
          className="flex items-center gap-3 rounded-lg border border-accent bg-accent-soft p-2 text-left transition-colors duration-200 hover:bg-accent/10"
        >
          <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
            <Image
              src={t.image}
              alt="Tú con este look"
              fill
              sizes="48px"
              className="object-cover"
            />
          </span>
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
              Tú con este look{" "}
              <Icon name="destello" size={15} className="text-accent" />
            </span>
            <span className="text-xs text-muted">Toca para verlo en grande</span>
          </span>
        </button>
        <button
          type="button"
          onClick={t.pickPhoto}
          className="self-start text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
        >
          ¿No te pareces? Cambia tu foto
        </button>
        {t.fileInput}
      </div>
    );
  }

  // Sin try-on aún: botón para generarlo.
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={t.generar}
        className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-accent bg-accent-soft text-sm font-medium text-ink transition-colors duration-200 hover:bg-accent hover:text-on-accent"
      >
        <Icon name="destello" size={18} /> Verme con este look
      </button>
      {t.mode === "error" && (
        <p className="text-center text-xs text-error">{t.errMsg}</p>
      )}
      {t.fileInput}
    </div>
  );
}
