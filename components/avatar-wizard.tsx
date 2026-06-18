"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { toUsableImage } from "@/lib/image-file";
import { comprimir } from "@/lib/image-compress";
import { uploadGeneratedAvatar } from "@/lib/avatar-upload";
import { markNudge } from "@/lib/journey-actions";
import type { Gender } from "@/lib/auth";

// Wizard de avatar digital (issue #1): subir fotos → tipo de cuerpo → generar →
// confirmar/rehacer. La generación es obligatoria (sin foto cruda); si falla,
// sale limpio sin guardar nada (el avatar es opcional). Las fotos fuente no se
// persisten — solo viajan en la request de generación.

type BodyType = "slim" | "athletic" | "average" | "full";
type Slot = "face" | "body1" | "body2";
type Step = "fotos" | "cuerpo" | "generando" | "preview" | "error";

const TYPES: BodyType[] = ["slim", "athletic", "average", "full"];
const LABELS: Record<Gender, Record<BodyType, string>> = {
  hombre: { slim: "Delgado", athletic: "Atlético", average: "Promedio", full: "Robusto" },
  mujer: { slim: "Delgada", athletic: "Atlética", average: "Promedio", full: "Con curvas" },
};
const GEN_MSGS = [
  "Preparando tus fotos…",
  "Generando tu avatar…",
  "Afinando los detalles…",
  "Casi listo…",
];

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("b64"));
    r.readAsDataURL(blob);
  });
}

export function AvatarWizard({
  userId,
  gender,
  returnTo,
}: {
  userId: string;
  gender: Gender;
  returnTo: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("fotos");
  const [photos, setPhotos] = useState<Record<Slot, File | null>>({
    face: null,
    body1: null,
    body2: null,
  });
  const [previews, setPreviews] = useState<Record<Slot, string | null>>({
    face: null,
    body1: null,
    body2: null,
  });
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [saving, setSaving] = useState(false);
  const [genMsg, setGenMsg] = useState(GEN_MSGS[0]);

  // Limpia los object URLs al desmontar.
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mensajes rotativos durante la generación. El reset a GEN_MSGS[0] se hace al
  // entrar a "generando" (en generate()), no aquí, para no llamar setState
  // sincrónicamente dentro del effect.
  useEffect(() => {
    if (step !== "generando") return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % GEN_MSGS.length;
      setGenMsg(GEN_MSGS[i]);
    }, 2500);
    return () => clearInterval(t);
  }, [step]);

  function setSlot(slot: Slot, file: File | null) {
    setPhotos((p) => ({ ...p, [slot]: file }));
    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot] as string);
      return { ...prev, [slot]: file ? URL.createObjectURL(file) : null };
    });
  }

  const canContinue = !!photos.face && !!photos.body1;

  async function generate() {
    if (!bodyType) return;
    setGenMsg(GEN_MSGS[0]);
    setStep("generando");
    try {
      const faceBlob = await comprimir(await toUsableImage(photos.face as File));
      const bodyFiles = [photos.body1, photos.body2].filter(Boolean) as File[];
      const bodyBlobs = await Promise.all(
        bodyFiles.map(async (f) => comprimir(await toUsableImage(f)))
      );
      const faceB64 = await blobToB64(faceBlob);
      const bodyB64 = await Promise.all(bodyBlobs.map(blobToB64));

      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceB64, bodyB64, bodyType }),
      });
      if (!res.ok) throw new Error("gen");
      const data = (await res.json()) as { image?: string };
      if (!data.image) throw new Error("gen");

      setGenerated(data.image);
      setFails(0);
      setStep("preview");
    } catch {
      setFails((n) => n + 1);
      setStep("error");
    }
  }

  async function confirm() {
    if (!generated || !bodyType) return;
    setSaving(true);
    const res = await uploadGeneratedAvatar(generated, userId, bodyType);
    if (!res.ok) {
      setSaving(false);
      setFails((n) => n + 1);
      setStep("error");
      return;
    }
    await markNudge("tryon", "done");
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href={returnTo} className="text-sm font-medium text-muted hover:text-ink">
        ← Volver
      </Link>

      {step === "fotos" && (
        <div className="mt-2 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">Crea tu avatar</h1>
            <p className="text-sm text-muted">
              Con tus fotos armo un avatar tuyo para probarte los looks encima. Tus
              fotos no se guardan, solo las uso para generarlo.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <UploadTile
              label="Tu cara"
              hint="Una foto clara de frente"
              preview={previews.face}
              onPick={(f) => setSlot("face", f)}
            />
            <UploadTile
              label="Cuerpo completo"
              hint="De pie, de frente"
              preview={previews.body1}
              onPick={(f) => setSlot("body1", f)}
            />
            <UploadTile
              label="Otra de cuerpo"
              hint="Opcional — ayuda a que salga mejor"
              preview={previews.body2}
              onPick={(f) => setSlot("body2", f)}
            />
          </div>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep("cuerpo")}
            className="flex min-h-12 items-center justify-center rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}

      {step === "cuerpo" && (
        <div className="mt-2 flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setStep("fotos")}
            className="self-start text-sm font-medium text-muted hover:text-ink"
          >
            ← Fotos
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">
              ¿Cuál se parece más a tu cuerpo?
            </h1>
            <p className="text-sm text-muted">Es para que la ropa te quede fiel.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map((t) => {
              const selected = bodyType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBodyType(t)}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                    selected
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface hover:border-ink"
                  }`}
                >
                  <span
                    aria-hidden
                    className={selected ? "bg-accent" : "bg-muted"}
                    style={{
                      width: 40,
                      height: 80,
                      maskImage: `url(/avatar-shapes/${gender}-${t}.svg)`,
                      WebkitMaskImage: `url(/avatar-shapes/${gender}-${t}.svg)`,
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      maskPosition: "center",
                      WebkitMaskPosition: "center",
                      maskSize: "contain",
                      WebkitMaskSize: "contain",
                    }}
                  />
                  <span
                    className={`text-sm font-medium ${selected ? "text-accent" : "text-ink"}`}
                  >
                    {LABELS[gender][t]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!bodyType}
            onClick={generate}
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
          >
            <Icon name="destello" size={16} />
            Generar mi avatar
          </button>
        </div>
      )}

      {step === "generando" && (
        <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="text-sm font-medium text-ink">{genMsg}</p>
          <p className="text-xs text-muted">Tarda unos segundos.</p>
        </div>
      )}

      {step === "preview" && generated && (
        <div className="mt-2 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">¿Quedó?</h1>
            <p className="text-sm text-muted">
              Si no se te parece, rehazlo. Si te late, lo guardo como tu avatar.
            </p>
          </div>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-lg border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${generated}`}
              alt="Tu avatar generado"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={confirm}
              className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Quedó, usar este"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={generate}
              className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink disabled:opacity-60"
            >
              <Icon name="repetir" size={16} />
              Rehacer
            </button>
          </div>
        </div>
      )}

      {step === "error" && (
        <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="prohibido" size={22} />
          </span>
          <p className="text-sm font-medium text-ink">
            {fails >= 2
              ? "No está saliendo ahorita. Inténtalo más tarde."
              : "No pude generar tu avatar."}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={generate}
              className="flex min-h-11 items-center justify-center rounded-sm bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              Reintentar
            </button>
            <Link
              href={returnTo}
              className="flex min-h-11 items-center justify-center rounded-sm border border-line bg-surface px-6 text-sm font-medium text-muted transition-colors duration-200 hover:border-ink hover:text-ink"
            >
              Salir
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadTile({
  label,
  hint,
  preview,
  onPick,
}: {
  label: string;
  hint: string;
  preview: string | null;
  onPick: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-ink"
    >
      <span className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-bg text-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="camara" size={20} />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-muted">{preview ? "Tocar para cambiar" : hint}</span>
      </span>
      {preview ? (
        <Icon name="check" size={18} className="ml-auto shrink-0 text-success" />
      ) : (
        <Icon name="mas" size={18} className="ml-auto shrink-0 text-muted" />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (inputRef.current) inputRef.current.value = "";
          onPick(f);
        }}
        className="hidden"
      />
    </button>
  );
}
