"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { attachOwnPhoto } from "@/app/closet/capsula/actions";

// Comprime una imagen a JPEG (máx 1280px) para subirla ligera.
function comprimir(file: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const max = 1280;
      let { width, height } = img;
      if (width > height && width > max) {
        height = (height * max) / width;
        width = max;
      } else if (height > max) {
        width = (width * max) / height;
        height = max;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) resolve(blob);
          else reject(new Error("no_blob"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Banner NO bloqueante tras "ya la tengo": ofrece subir la foto real de tu prenda
// (mejora la fidelidad sobre la imagen auto). Si lo ignoras, la prenda se queda con
// su imagen generada. La foto se sube al bucket del usuario y se fija con
// attachOwnPhoto.
export function OwnedPhotoBanner({
  itemId,
  nombre,
  userId,
  onDismiss,
}: {
  itemId: string;
  nombre: string;
  userId: string;
  onDismiss: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setState("saving");
    try {
      const blob = await comprimir(file);
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage
        .from("prendas")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) {
        setState("error");
        return;
      }
      const r = await attachOwnPhoto(itemId, path);
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-accent-soft p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
        <Icon name="check" size={15} strokeWidth={2.4} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {state === "done" ? (
          <span className="text-sm font-medium text-ink">
            Listo — guardé tu foto de {nombre}.
          </span>
        ) : (
          <>
            <span className="truncate text-sm font-medium text-ink">Agregaste {nombre}.</span>
            <span className="text-xs text-muted">
              {state === "error"
                ? "No pude subir la foto — inténtalo otra vez."
                : "¿Subes la foto de tu prenda real? (opcional)"}
            </span>
          </>
        )}
      </div>
      {state === "done" ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold text-accent underline underline-offset-2"
        >
          listo
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={state === "saving"}
            className="flex min-h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:border-accent disabled:opacity-50"
          >
            {state === "saving" ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Icon name="camara" size={14} />
            )}
            {state === "saving" ? "subiendo…" : "subir foto"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs font-medium text-muted underline underline-offset-2"
          >
            ahora no
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
