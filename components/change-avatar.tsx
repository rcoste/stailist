"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatar } from "@/lib/avatar-upload";

// Botón para subir/cambiar la foto de avatar desde el Perfil. Reusa uploadAvatar
// (mismo camino que el try-on: normaliza HEIC, comprime, guarda). Al terminar
// refresca para que la pantalla muestre la nueva foto.
export function ChangeAvatar({
  userId,
  hasAvatar,
}: {
  userId: string;
  hasAvatar: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "up" | "error">("idle");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setStatus("up");
    try {
      const res = await uploadAvatar(file, userId);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "up"}
        className="flex min-h-10 items-center justify-center self-start rounded-sm border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink disabled:opacity-60"
      >
        {status === "up"
          ? "Subiendo tu foto…"
          : hasAvatar
            ? "Cambiar foto"
            : "Subir mi foto"}
      </button>
      {status === "error" ? (
        <p className="text-xs text-error">
          No pude procesar tu foto — inténtalo con otra.
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}
