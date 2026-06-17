"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveAvatar } from "@/lib/avatar-actions";
import { toUsableImage } from "@/lib/image-file";

// Estados del try-on (compartidos por la card de Hoy y el TryonButton del wow).
export type TryonMode = "idle" | "gen" | "up" | "sin_avatar" | "full" | "error";

// Reduce el lado más largo a 1280px y reencoda a JPEG 0.88 antes de subir.
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
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("img_decode"));
    };
    img.src = URL.createObjectURL(file);
  });
}

export type UseTryon = {
  mode: TryonMode;
  image: string | null;
  errMsg: string;
  /** Dispara la generación; si no hay avatar, abre el selector de foto. */
  generar: () => Promise<void>;
  /** Abre el selector de foto (subir/cambiar). */
  pickPhoto: () => void;
  /** Abre el modal grande (solo si ya hay imagen). */
  openFull: () => void;
  /** Cierra el modal y vuelve a la vista con thumbnail/hero. */
  closeFull: () => void;
  /** `<input type=file>` oculto — el consumidor lo monta una vez. */
  fileInput: React.ReactNode;
};

// `initialImage`: si el outfit ya trae un try-on (URL firmada), arranca mostrándolo.
// `revealMode`: tras generar, "inline" deja la imagen en la card (Hoy, Estado 3);
// "modal" la abre en grande de inmediato (el "wow" del onboarding).
export function useTryon({
  outfitId,
  userId,
  initialImage = null,
  revealMode = "inline",
}: {
  outfitId: string;
  userId: string;
  initialImage?: string | null;
  revealMode?: "inline" | "modal";
}): UseTryon {
  const [mode, setMode] = useState<TryonMode>("idle");
  const [image, setImage] = useState<string | null>(initialImage);
  const [errMsg, setErrMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function pickPhoto() {
    inputRef.current?.click();
  }

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
        pickPhoto(); // sin foto aún → abre el selector directo
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
      setMode(revealMode === "modal" ? "full" : "idle");
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

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,.heic,.heif"
      onChange={onAvatarFile}
      className="hidden"
    />
  );

  return {
    mode,
    image,
    errMsg,
    generar,
    pickPhoto,
    openFull: () => setMode("full"),
    closeFull: () => setMode("idle"),
    fileInput,
  };
}
