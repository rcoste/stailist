"use client";

import { useState } from "react";

// Estados del try-on (compartidos por la card de Hoy y el TryonButton del wow).
// La CREACIÓN del avatar ya no vive aquí: si no hay avatar, mandamos al wizard
// (/perfil/avatar) vía avatarHref. Aquí solo se genera/muestra el try-on.
export type TryonMode = "idle" | "gen" | "sin_avatar" | "full" | "error";

export type UseTryon = {
  mode: TryonMode;
  image: string | null;
  errMsg: string;
  /** Dispara la generación; si no hay avatar, queda en modo sin_avatar. */
  generar: () => Promise<void>;
  /** Abre el modal grande (solo si ya hay imagen). */
  openFull: () => void;
  /** Cierra el modal y vuelve a la vista con thumbnail/hero. */
  closeFull: () => void;
  /** Link al wizard de avatar (crear/cambiar), con retorno a esta pantalla. */
  avatarHref: string;
};

// `initialImage`: si el outfit ya trae un try-on (URL firmada), arranca mostrándolo.
// `revealMode`: tras generar, "inline" deja la imagen en la card (Hoy, Estado 3);
// "modal" la abre en grande de inmediato (el "wow" del onboarding).
// `returnTo`: a dónde vuelve el wizard de avatar (/hoy o /onboarding/wow).
export function useTryon({
  outfitId,
  initialImage = null,
  revealMode = "inline",
  returnTo = "/hoy",
}: {
  outfitId: string;
  /** @deprecated ya no se usa (la subida vive en el wizard); se acepta por compat. */
  userId?: string;
  initialImage?: string | null;
  revealMode?: "inline" | "modal";
  returnTo?: string;
}): UseTryon {
  const [mode, setMode] = useState<TryonMode>("idle");
  const [image, setImage] = useState<string | null>(initialImage);
  const [errMsg, setErrMsg] = useState("");

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
        setMode("sin_avatar"); // sin avatar → el consumidor ofrece crearlo (wizard)
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

  return {
    mode,
    image,
    errMsg,
    generar,
    openFull: () => setMode("full"),
    closeFull: () => setMode("idle"),
    avatarHref: `/perfil/avatar?return=${encodeURIComponent(returnTo)}`,
  };
}
