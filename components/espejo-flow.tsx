"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toUsableImage } from "@/lib/image-file";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import type { LecturaEspejo } from "@/lib/espejo";

// "¿ME VEO BIEN?" — el flujo de una sola pantalla.
//
// Todo lo que aquí se decide sale del encuadre (ver lib/espejo): ella pregunta,
// la amiga contesta. Eso manda sobre la UI:
//
// · NO hay calificación, ni estrellas, ni barra de "qué tan bien vas". Un
//   número convierte una respuesta en una nota, y una nota diaria a alguien
//   inseguro es otro producto.
// · La respuesta se lee de corrido, no en tarjetas separadas por categoría:
//   una amiga te dice tres cosas seguidas, no te entrega un informe.
// · La foto se ve grande arriba. Es SU foto, no un dato de entrada.
//
// SE SUBE ANTES DE PREGUNTAR: la foto va al bucket primero y su ruta viaja con
// la petición, así el diario guarda la imagen sin una segunda subida. Si la
// subida falla, se pregunta igual — el consejo es el trabajo, el diario es el
// registro.
export type EspejoHandle = { start: () => void };

type State =
  | { kind: "idle" }
  | { kind: "mirando"; preview: string }
  | { kind: "listo"; preview: string; lectura: LecturaEspejo }
  | { kind: "error"; msg: string };

// Comprime a 1280px: lo mismo que el resto de los flujos de foto.
function comprimir(file: Blob): Promise<{ dataUrl: string; blob: Blob }> {
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
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          blob ? resolve({ dataUrl, blob }) : reject(new Error("no_blob"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** La ubicación, para el clima. Sin permiso se sigue sin clima, no se insiste. */
function dondeEstoy(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 4000, maximumAge: 15 * 60 * 1000 }
    );
  });
}

export function EspejoFlow({
  userId,
  headless = false,
  ref,
}: {
  userId: string;
  headless?: boolean;
  ref?: Ref<EspejoHandle>;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useImperativeHandle(ref, () => ({ start: () => inputRef.current?.click() }), []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    let preview = "";
    try {
      const { dataUrl, blob } = await comprimir(await toUsableImage(file));
      preview = dataUrl;
      setState({ kind: "mirando", preview });

      // La foto y la ubicación, en paralelo: ninguna de las dos debe hacer
      // esperar a la otra.
      const [ruta, donde] = await Promise.all([
        (async () => {
          try {
            const supabase = createClient();
            const path = `${userId}/espejo-${crypto.randomUUID()}.jpg`;
            const up = await supabase.storage
              .from("prendas")
              .upload(path, blob, { contentType: "image/jpeg" });
            return up.error ? null : path;
          } catch {
            return null; // sin foto en el diario, pero el consejo sale igual
          }
        })(),
        dondeEstoy(),
      ]);

      const hora = new Date().getHours();
      const res = await fetch("/api/espejo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          photoPath: ruta,
          ...(donde ?? {}),
          momento: hora >= 19 || hora < 6 ? "noche" : "dia",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setState({
          kind: "error",
          msg:
            err.error === "permiso_pendiente" && err.message
              ? err.message
              : "No pude verte bien. Inténtalo con otra foto.",
        });
        return;
      }
      const lectura = (await res.json()) as LecturaEspejo;
      setState({ kind: "listo", preview, lectura });
      // El diario ya tiene una entrada nueva.
      router.refresh();
    } catch {
      setState({ kind: "error", msg: "No pude leer la foto. Inténtalo otra vez." });
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      // Sin extensiones pegadas: con ellas Android abre el carrete directo y no
      // ofrece la cámara, y aquí la cámara es el caso principal — estás vestida
      // frente al espejo. HEIC no se pierde: toUsableImage lo detecta igual.
      accept="image/*"
      onChange={onFile}
      className="hidden"
    />
  );

  const cerrar = () => setState({ kind: "idle" });

  if (state.kind === "mirando" || state.kind === "listo") {
    const lista = state.kind === "listo" ? state.lectura : null;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
        <div
          className="flex max-h-[92dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-t-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 lg:rounded-[18px]"
          style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        >
          <div className="flex items-start justify-between">
            <h2 className="text-[22px] font-semibold leading-tight text-ink">
              {lista ? (
                <>
                  te <em className="font-normal italic">veo</em>
                </>
              ) : (
                "te estoy viendo…"
              )}
            </h2>
            {lista ? (
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="text-muted">
                <Icon name="equis" size={18} />
              </button>
            ) : null}
          </div>

          {/* Su foto, grande. Es ella, no un dato de entrada. */}
          <div className="relative overflow-hidden rounded-xl border border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.preview} alt="" className="max-h-[44dvh] w-full object-contain" />
            {!lista ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/60">
                <Spinner className="h-6 w-6 text-accent" />
              </div>
            ) : null}
          </div>

          {lista ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">{lista.resumen}</p>
              {/* De corrido y sin etiquetas de categoría: una amiga te dice tres
                  cosas seguidas, no te entrega un informe por secciones. */}
              <p className="text-[15px] leading-relaxed text-ink">{lista.colorimetria}</p>
              {lista.clima ? (
                <p className="flex gap-2 text-[15px] leading-relaxed text-ink">
                  <Icon name="destello" size={16} className="mt-1 shrink-0 text-accent" />
                  <span>{lista.clima}</span>
                </p>
              ) : null}
              <p className="rounded-xl bg-accent-soft px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                {lista.ajuste}
              </p>
              <p className="text-xs text-muted">Ya quedó en tu diario.</p>
              <button
                type="button"
                onClick={cerrar}
                className="min-h-12 rounded-sm bg-accent text-sm font-semibold text-on-accent"
              >
                gracias
              </button>
            </div>
          ) : (
            <p className="editorial text-center text-sm text-muted">
              mirando los colores, el clima y cómo te queda…
            </p>
          )}
        </div>
        {input}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center" onClick={cerrar}>
        <div
          className="flex w-full max-w-[430px] flex-col gap-3 rounded-t-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center lg:rounded-[18px]"
          style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-error">{state.msg}</p>
          <button
            type="button"
            onClick={cerrar}
            className="min-h-11 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
          >
            entendido
          </button>
        </div>
        {input}
      </div>
    );
  }

  if (headless) return input;

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm border border-line text-[15px] font-semibold text-ink transition-colors duration-200 hover:border-accent hover:text-accent"
      >
        <Icon name="camara" size={18} />
        ¿me veo bien?
      </button>
      {input}
    </>
  );
}
