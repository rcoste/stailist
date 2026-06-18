"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { NudgeShell } from "@/components/nudge-shell";
import { markNudge } from "@/lib/journey-actions";
import type { NudgeId } from "@/lib/journey";

// Nudge tipo "fila que lleva a otro lado" — lo comparten P3 (clóset real) y P4
// (cápsula). Al tocar la fila marca el nudge como completado y navega; la X lo
// descarta. En ambos casos el resolvedor deja de mostrarlo.
export function LinkNudge({
  id,
  icon,
  title,
  body,
  href,
}: {
  id: NudgeId;
  icon: IconName;
  title: string;
  body: string;
  href: string;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  async function dismiss() {
    setHidden(true);
    await markNudge(id, "dismissed");
    router.refresh();
  }

  return (
    <NudgeShell onDismiss={dismiss}>
      <Link
        href={href}
        onClick={() => void markNudge(id, "done")} // el Link navega; guardado en segundo plano
        className="flex items-center gap-3 pr-6"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name={icon} size={16} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="text-xs text-muted">{body}</span>
        </span>
        <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
      </Link>
    </NudgeShell>
  );
}
