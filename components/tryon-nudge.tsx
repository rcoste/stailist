"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { NudgeShell } from "@/components/nudge-shell";
import { markNudge } from "@/lib/journey-actions";

// Pieza 2 del motor de nudges: tras enganchar (≥1 👍) y sin avatar todavía,
// invitamos a crear el avatar para el try-on. Lleva al wizard (/perfil/avatar);
// al confirmar ahí, el wizard marca el nudge como "done" y deja de aparecer.

export function TryonNudge() {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function dismiss() {
    setHidden(true);
    await markNudge("tryon", "dismissed");
    router.refresh();
  }

  return (
    <NudgeShell onDismiss={dismiss}>
      <div className="flex items-start gap-3 pr-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="camara" size={16} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">Pruébate este look</span>
          <span className="text-xs text-muted">
            Crea tu avatar una vez y te pruebo este look encima — y cualquiera de
            aquí en adelante.
          </span>
        </div>
      </div>
      <Link
        href="/perfil/avatar?return=/hoy"
        className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        Crear mi avatar
      </Link>
    </NudgeShell>
  );
}
