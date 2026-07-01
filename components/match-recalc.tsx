"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recalcularMatch } from "@/app/closet/capsula/actions";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";

// Calcula el match de la cápsula contra el clóset. `auto` = cápsula recién armada
// (sin match aún) → arranca solo, con spinner, sin que el usuario tenga que picar.
// Al terminar bien, router.refresh() re-renderiza la página con el match y este
// componente desaparece (stale = false). Si falla, ofrece reintentar (sin loop).
export function MatchRecalc({ auto, label }: { auto: boolean; label: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "failed">(auto ? "running" : "idle");
  const started = useRef(false);

  // No hace setState síncrono: el estado ya arranca en "running" (auto) o lo pone el
  // onClick (manual). El único setState va DESPUÉS del await → seguro en el efecto.
  const run = async () => {
    if (started.current) return;
    started.current = true;
    const r = await recalcularMatch();
    if (r.ok) {
      router.refresh(); // la página re-renderiza con el match → este bloque se va
    } else {
      started.current = false;
      setPhase("failed");
    }
  };

  useEffect(() => {
    // Auto-run al montar. El único setState va DESPUÉS del await (no cascada), pero
    // el rule no lo distingue; deps [] a propósito (solo al montar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (auto) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = () => {
    setPhase("running");
    run();
  };

  if (phase === "running") {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-line bg-accent-soft p-3 text-sm font-medium text-accent">
        <Spinner className="h-4 w-4" />
        Calculando qué ya tienes y qué te falta…
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-line bg-accent-soft p-3 text-left text-sm font-medium text-accent transition-colors hover:border-accent"
    >
      <Icon name="repetir" size={16} />
      {phase === "failed" ? "No pude calcular — reintentar" : label}
    </button>
  );
}
