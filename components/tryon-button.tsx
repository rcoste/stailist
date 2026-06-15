"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { saveAvatar } from "@/lib/avatar-actions";
import { Spinner } from "@/components/spinner";

type State =
  | { kind: "idle" }
  | { kind: "generando" }
  | { kind: "sin_avatar" }
  | { kind: "subiendo" }
  | { kind: "ver"; image: string }
  | { kind: "error"; msg: string };

function comprimir(file: File): Promise<Blob> {
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

export function TryonButton({
  outfitId,
  userId,
}: {
  outfitId: string;
  userId: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function generar() {
    setState({ kind: "generando" });
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitId }),
      });
      const data = await res.json();
      if (data.error === "sin_avatar") {
        setState({ kind: "sin_avatar" });
        return;
      }
      if (!res.ok || !data.image) {
        setState({
          kind: "error",
          msg:
            data.error === "sin_api_key"
              ? "El try-on aún no está conectado."
              : "No pude crear tu look. Inténtalo de nuevo.",
        });
        return;
      }
      setState({ kind: "ver", image: data.image });
    } catch {
      setState({ kind: "error", msg: "Se cortó la conexión." });
    }
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setState({ kind: "subiendo" });
    try {
      const blob = await comprimir(file);
      const supabase = createClient();
      const path = `${userId}/avatar.jpg`;
      const up = await supabase.storage
        .from("prendas")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) {
        setState({ kind: "error", msg: "No pude guardar tu foto." });
        return;
      }
      const saved = await saveAvatar(path);
      if (!saved.ok) {
        setState({ kind: "error", msg: "No pude guardar tu foto." });
        return;
      }
      await generar(); // ya con avatar, genera el try-on
    } catch {
      setState({ kind: "error", msg: "No pude procesar tu foto." });
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      onChange={onAvatarFile}
      className="hidden"
    />
  );

  // Modal con el resultado
  if (state.kind === "ver") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/70 px-4 py-6">
        <div className="relative aspect-[3/4] w-full max-w-80 overflow-hidden rounded-2xl border border-line bg-surface">
          <Image src={state.image} alt="Tú con este look" fill className="object-cover" />
        </div>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="min-h-12 rounded-full bg-surface px-8 text-base font-medium text-ink"
        >
          Cerrar
        </button>
      </div>
    );
  }

  if (state.kind === "sin_avatar") {
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

  const cargando = state.kind === "generando" || state.kind === "subiendo";
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={generar}
        disabled={cargando}
        className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-accent bg-accent-soft text-sm font-medium text-ink transition-colors duration-200 hover:bg-accent hover:text-on-accent disabled:opacity-60"
      >
        {cargando ? <Spinner className="h-4 w-4" /> : null}
        {state.kind === "subiendo"
          ? "Guardando tu foto…"
          : state.kind === "generando"
            ? "Creando tu look… (~20s)"
            : "✨ Verme con este look"}
      </button>
      {state.kind === "error" && (
        <p className="text-center text-xs text-error">{state.msg}</p>
      )}
      {input}
    </div>
  );
}
