"use client";

import { useState } from "react";

// Estados del try-on (compartidos por la card de Hoy y el TryonButton del wow).
// La CREACIÓN del avatar ya no vive aquí: si no hay avatar, mandamos al wizard
// (/perfil/avatar) vía avatarHref. Aquí solo se genera/muestra el try-on.
/**
 * QUÉ LEE LA PERSONA CUANDO EL TRY-ON FALLA — y de quién es la culpa.
 *
 * EL CASO (2026-09-09): Val intentó verse un look CUATRO veces seguidas
 * —12:19, 12:47, 12:49, 12:50— y las cuatro fallaron con timeout a los 52
 * segundos exactos. El modelo de imagen de Google estaba caído en esa ventana
 * (comprobado: media hora después respondía en 18s). Cada intento la hizo
 * esperar 52 segundos: casi tres minutos y medio, cuatro pantallas de error.
 *
 * Lo que la puso a reintentar fue el mensaje: "No pude crear tu look.
 * Inténtalo de nuevo" sobre un fallo del PROVEEDOR, que dura minutos. El
 * código `generacion` ya venía distinguido desde lib/tryon.ts; lo único que
 * faltaba era decirlo en voz alta.
 *
 * Pura y exportada para probarla: lo que blinda no es el texto sino la
 * DECISIÓN de que un fallo de ellos no se anuncie como uno que se arregla
 * repitiendo.
 */
export function mensajeDeErrorTryon(codigo: unknown): string {
  if (codigo === "sin_api_key") return "El try-on aún no está conectado.";
  // De ellos: repetir ya mismo no puede funcionar. Se dice, y se dice que no
  // es culpa suya — si no, la persona asume que algo hizo mal.
  if (codigo === "generacion")
    return "Ahorita no puedo con tu imagen, y es de mi lado — no tuyo. Dame un par de minutos y vuelve a intentar.";
  return "No pude crear tu look. Inténtalo de nuevo.";
}

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
  ensureOutfitId,
  initialImage = null,
  revealMode = "inline",
  returnTo = "/hoy",
}: {
  /** Id de la fila de outfits. Null si aún no existe → ver ensureOutfitId. */
  outfitId?: string | null;
  /**
   * Para looks que todavía NO son una fila de `outfits` (los de la cápsula y los
   * del viaje): crea la fila al vuelo y devuelve su id. Sin esto, probarte un
   * look exigía favoritearlo primero e irte al Historial.
   */
  ensureOutfitId?: () => Promise<string | null>;
  /** @deprecated ya no se usa (la subida vive en el wizard); se acepta por compat. */
  userId?: string;
  initialImage?: string | null;
  revealMode?: "inline" | "modal";
  returnTo?: string;
}): UseTryon {
  const [mode, setMode] = useState<TryonMode>("idle");
  const [image, setImage] = useState<string | null>(initialImage);
  const [errMsg, setErrMsg] = useState("");
  const [lazyId, setLazyId] = useState<string | null>(null);

  async function generar() {
    setMode("gen");
    let id = outfitId ?? lazyId;
    if (!id && ensureOutfitId) {
      id = await ensureOutfitId();
      if (id) setLazyId(id);
    }
    if (!id) {
      setErrMsg("No pude preparar este look. Inténtalo de nuevo.");
      setMode("error");
      return;
    }
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitId: id }),
      });
      const data = await res.json();
      if (data.error === "sin_avatar") {
        setMode("sin_avatar"); // sin avatar → el consumidor ofrece crearlo (wizard)
        return;
      }
      if (!res.ok || !data.image) {
        setErrMsg(mensajeDeErrorTryon(data.error));
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
