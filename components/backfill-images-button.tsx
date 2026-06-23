"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { backfillBorrowedImages } from "@/app/closet/actions";

// Herramienta admin (one-shot, idempotente): a las prendas de "ya la tengo" viejas
// sin imagen les presta el flat-lay de un arquetipo. Solo se renderiza para admin.
export function BackfillImagesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1.5 border-t border-line pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await backfillBorrowedImages();
            setMsg(
              res.ok
                ? `Rellené ${res.updated} ${res.updated === 1 ? "imagen" : "imágenes"}.`
                : "No pude rellenar — inténtalo otra vez."
            );
            if (res.ok && res.updated > 0) router.refresh();
          })
        }
        className="flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent disabled:opacity-50"
      >
        {pending ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="repetir" size={14} />}
        Admin · rellenar imágenes faltantes
      </button>
      {msg ? <span className="text-[11px] text-muted">{msg}</span> : null}
    </div>
  );
}
