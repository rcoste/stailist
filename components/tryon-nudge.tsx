"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { NudgeShell } from "@/components/nudge-shell";
import { createClient } from "@/lib/supabase/client";
import { toUsableImage } from "@/lib/image-file";
import { saveAvatar } from "@/lib/avatar-actions";
import { markNudge } from "@/lib/journey-actions";

// Pieza 2 del motor de nudges: tras enganchar (≥1 👍) y sin avatar todavía,
// invitamos a subir la foto para el try-on. Es auto-contenido — sube y guarda
// el avatar una vez; de ahí el botón "verme con este look" de cada outfit ya
// funciona al instante. Al subir o descartar, el resolvedor deja de mostrarlo.

// Reduce a ≤1280px y JPEG, mismo criterio que el try-on (lib/use-tryon).
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
        (b) => {
          URL.revokeObjectURL(img.src);
          b ? resolve(b) : reject(new Error("no_blob"));
        },
        "image/jpeg",
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("img_decode"));
    };
    img.src = URL.createObjectURL(file);
  });
}

export function TryonNudge({ userId }: { userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "up" | "error">("idle");
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setStatus("up"); // se pinta ANTES del bloqueo de conversión (ver lib/image-file)
    try {
      const blob = await comprimir(await toUsableImage(file));
      const supabase = createClient();
      const path = `${userId}/avatar.jpg`;
      const up = await supabase.storage
        .from("prendas")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) {
        setStatus("error");
        return;
      }
      const saved = await saveAvatar(path);
      if (!saved.ok) {
        setStatus("error");
        return;
      }
      await markNudge("tryon", "done");
      setHidden(true);
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

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
            Sube una foto tuya una vez y te lo pongo encima — y cualquier look de
            aquí en adelante.
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "up"}
        className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
      >
        {status === "up" ? "Subiendo tu foto…" : "Subir mi foto"}
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
    </NudgeShell>
  );
}
