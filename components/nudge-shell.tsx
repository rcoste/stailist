"use client";

import { Icon } from "@/components/icon";

// Chrome visual compartido de los nudges del motor post-onboarding: un banner
// suave con botón de descartar. El contenido lo pone cada nudge específico
// (TryonNudge, y a futuro los de clóset/cápsula) para mantener consistencia.
export function NudgeShell({
  onDismiss,
  children,
}: {
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-3 rounded-lg border border-line bg-accent-soft p-4">
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Descartar"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <Icon name="equis" size={15} />
        </button>
      ) : null}
      {children}
    </div>
  );
}
