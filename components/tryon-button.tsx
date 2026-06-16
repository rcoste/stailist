"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { saveAvatar } from "@/lib/avatar-actions";
import { toUsableImage } from "@/lib/image-file";
import { Spinner } from "@/components/spinner";

type Mode = "idle" | "gen" | "up" | "sin_avatar" | "full" | "error";

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
          blob ? resolve(blob) : reject(new Error("no_blob"));
        },
        "image/jpeg",
        0.88
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// `initialImage`: si el outfit ya tiene un try-on generado (URL firmada), se
// muestra el thumbnail directo, sin tener que regenerarlo.
export function TryonButton({
  outfitId,
  userId,
  initialImage = null,
}: {
  outfitId: string;
  userId: string;
  initialImage?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [image, setImage] = useState<string | null>(initialImage);
  const [errMsg, setErrMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function generar() {
    setMode("gen");
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitId }),
      });
      const data = await res.json();
      if (data.error === "sin_avatar") {
        setMode("sin_avatar");
        return;
      }
      if (!res.ok || !data.image) {
        setErrMsg(
          data.error === "sin_api_key"
            ? "El try-on aún no está conectado."
            : "No pude crear tu look. Inténtalo de nuevo."
        );
        setMode("error");
        return;
      }
      setImage(data.image);
      setMode("full"); // recién generado: ábrelo en grande (el wow)
    } catch {
      setErrMsg("Se cortó la conexión.");
      setMode("error");
    }
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setMode("up");
    try {
      const blob = await comprimir(await toUsableImage(file));
      const supabase = createClient();
      const path = `${userId}/avatar.jpg`;
      const up = await supabase.storage
        .from("prendas")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) {
        setErrMsg("No pude guardar tu foto.");
        setMode("error");
        return;
      }
      const saved = await saveAvatar(path);
      if (!saved.ok) {
        setErrMsg("No pude guardar tu foto.");
        setMode("error");
        return;
      }
      await generar(); // ya con avatar, genera el try-on
    } catch {
      setErrMsg("No pude procesar tu foto.");
      setMode("error");
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,.heic,.heif"
      onChange={onAvatarFile}
      className="hidden"
    />
  );

  // Vista grande (modal). Cierra → vuelve al thumbnail (no a la nada).
  if (mode === "full" && image) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/70 px-4 py-6">
        <div className="relative aspect-[3/4] w-full max-w-80 overflow-hidden rounded-2xl border border-line bg-surface">
          <Image src={image} alt="Tú con este look" fill className="object-cover" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="min-h-12 rounded-full bg-surface px-8 text-base font-medium text-ink"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-11 text-sm font-medium text-surface underline underline-offset-4 decoration-surface/50"
          >
            ¿No te pareces? Cambia tu foto
          </button>
        </div>
        {input}
      </div>
    );
  }

  if (mode === "sin_avatar") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">
          Para verte con el look, sube una foto tuya de cuerpo completo
        </p>
        <p className="text-xs text-muted">
          De pie, buena luz, fondo simple. Solo una vez — la reusamos para todos
          tus looks.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="min-h-11 rounded-full bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
        >
          Subir mi foto
        </button>
        {input}
      </div>
    );
  }

  const cargando = mode === "gen" || mode === "up";

  // Cargando: botón con spinner.
  if (cargando) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled
          className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-accent bg-accent-soft text-sm font-medium text-ink disabled:opacity-60"
        >
          <Spinner className="h-4 w-4" />
          {mode === "up" ? "Guardando tu foto…" : "Creando tu look… (~20s)"}
        </button>
        {input}
      </div>
    );
  }

  // Ya hay try-on: thumbnail persistente, tappable para ver en grande.
  if (image) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setMode("full")}
          className="flex items-center gap-3 rounded-2xl border border-accent bg-accent-soft p-2 text-left transition-colors duration-200 hover:bg-accent/10"
        >
          <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
            <Image
              src={image}
              alt="Tú con este look"
              fill
              sizes="48px"
              className="object-cover"
            />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink">
              Tú con este look ✨
            </span>
            <span className="text-xs text-muted">Toca para verlo en grande</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="self-start text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
        >
          ¿No te pareces? Cambia tu foto
        </button>
        {input}
      </div>
    );
  }

  // Sin try-on aún: botón para generarlo.
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={generar}
        className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-accent bg-accent-soft text-sm font-medium text-ink transition-colors duration-200 hover:bg-accent hover:text-on-accent"
      >
        ✨ Verme con este look
      </button>
      {mode === "error" && (
        <p className="text-center text-xs text-error">{errMsg}</p>
      )}
      {input}
    </div>
  );
}
