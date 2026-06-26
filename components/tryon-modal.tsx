"use client";

import Image from "next/image";
import Link from "next/link";

// Vista grande del try-on (overlay claro). Usada por el wow del onboarding.
// Hoy usa el try-on inmersivo oscuro (components/tryon-immersive.tsx).
// "¿No te pareces?" lleva al wizard de avatar (changeHref).
export function TryonModal({
  image,
  lookName,
  onClose,
  changeHref,
}: {
  image: string;
  lookName?: string;
  onClose: () => void;
  changeHref: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/70 px-4 py-6">
      <div className="relative aspect-[3/4] w-full max-w-80 overflow-hidden rounded-lg border border-line bg-surface">
        <Image
          src={image}
          alt={lookName ? `Tú con el look ${lookName}` : "Tú con este look"}
          fill
          className="object-cover"
        />
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 rounded-sm bg-surface px-8 text-base font-medium text-ink"
        >
          Cerrar
        </button>
        <Link
          href={changeHref}
          className="min-h-11 text-sm font-medium text-surface underline decoration-surface/50 underline-offset-4"
        >
          ¿No te pareces? Cambia tu avatar
        </Link>
      </div>
    </div>
  );
}
