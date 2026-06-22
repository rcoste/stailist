"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addPhotoItem } from "@/app/closet/actions";
import { toUsableImage } from "@/lib/image-file";
import { Spinner } from "@/components/spinner";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

// Mango imperativo para disparar el flujo desde fuera (la hoja "Agregar").
export type AddFlowHandle = { start: () => void };

const CATEGORIAS: { v: PrendaAnalisis["categoria"]; l: string }[] = [
  { v: "top", l: "Top" },
  { v: "bottom", l: "Pantalón" },
  { v: "abrigo", l: "Abrigo" },
  { v: "vestido", l: "Vestido" },
  { v: "calzado", l: "Calzado" },
  { v: "accesorio", l: "Accesorio" },
];
const FORMALIDADES: PrendaAnalisis["formalidad"][] = [
  "casual",
  "formal-casual",
  "formal",
];
const TEMPORADAS: PrendaAnalisis["temporada"][] = [
  "calor",
  "templado",
  "frio",
  "todo-el-año",
];

type State =
  | { kind: "idle" }
  | { kind: "analizando" }
  | { kind: "confirmar"; preview: string; blob: Blob; attrs: PrendaAnalisis }
  | { kind: "guardando"; preview: string; blob: Blob; attrs: PrendaAnalisis }
  | { kind: "error" };

// Comprime y devuelve dataURL (para análisis + preview) y Blob (para subir).
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
          if (blob) resolve({ dataUrl, blob });
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

// headless: sin botón propio — lo dispara la hoja "Agregar" vía ref.start().
// En ese modo se muestran overlays de "leyendo" y error porque no hay botón
// donde reflejar el estado.
export function AddPhotoFlow({
  userId,
  headless = false,
  ref,
}: {
  userId: string;
  headless?: boolean;
  ref?: Ref<AddFlowHandle>;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useImperativeHandle(ref, () => ({ start: () => inputRef.current?.click() }), []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setState({ kind: "analizando" });
    try {
      const { dataUrl, blob } = await comprimir(await toUsableImage(file));
      const res = await fetch("/api/analizar-prenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      const { analisis } = (await res.json()) as { analisis: PrendaAnalisis };
      setState({ kind: "confirmar", preview: dataUrl, blob, attrs: analisis });
    } catch {
      setState({ kind: "error" });
    }
  }

  async function guardar() {
    if (state.kind !== "confirmar") return;
    const { preview, blob, attrs } = state;
    setState({ kind: "guardando", preview, blob, attrs });
    try {
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage
        .from("prendas")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) {
        setState({ kind: "error" });
        return;
      }
      const saved = await addPhotoItem(path, attrs);
      if (!saved.ok) {
        setState({ kind: "error" });
        return;
      }
      setState({ kind: "idle" });
      router.refresh();
    } catch {
      setState({ kind: "error" });
    }
  }

  function setAttr<K extends keyof PrendaAnalisis>(
    key: K,
    value: PrendaAnalisis[K]
  ) {
    setState((s) =>
      s.kind === "confirmar"
        ? { ...s, attrs: { ...s.attrs, [key]: value } }
        : s
    );
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,.heic,.heif"
      onChange={onFile}
      className="hidden"
    />
  );

  // Confirmación editable (modal en flujo normal, sin position:fixed).
  if (state.kind === "confirmar" || state.kind === "guardando") {
    const editable = state.kind === "confirmar";
    const a = state.attrs;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-4">
        <div className="flex max-h-[90dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
              <Image src={state.preview} alt={a.nombre} fill className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted">Nombre</label>
              <input
                value={a.nombre}
                disabled={!editable}
                onChange={(e) => setAttr("nombre", e.target.value)}
                className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  disabled={!editable}
                  onClick={() => setAttr("categoria", c.v)}
                  className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
                    a.categoria === c.v
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  {c.l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted">Formalidad</label>
              <select
                value={a.formalidad}
                disabled={!editable}
                onChange={(e) =>
                  setAttr("formalidad", e.target.value as typeof a.formalidad)
                }
                className="min-h-10 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
              >
                {FORMALIDADES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted">Temporada</label>
              <select
                value={a.temporada}
                disabled={!editable}
                onChange={(e) =>
                  setAttr("temporada", e.target.value as typeof a.temporada)
                }
                className="min-h-10 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
              >
                {TEMPORADAS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={!editable}
              onClick={() => setState({ kind: "idle" })}
              className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-medium text-ink disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={guardar}
              className="min-h-12 flex-[2] rounded-sm bg-accent text-sm font-medium text-on-accent disabled:opacity-50"
            >
              {state.kind === "guardando" ? "Guardando…" : "Sumar al clóset"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modo headless: la hoja "Agregar" es el trigger. Solo input + feedback flotante.
  if (headless) {
    return (
      <>
        {input}
        {state.kind === "analizando" ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-4">
            <div className="flex w-full max-w-[430px] flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-10 text-center">
              <Spinner className="h-7 w-7 text-accent" />
              <p className="editorial text-base text-ink">Leyendo tu prenda…</p>
            </div>
          </div>
        ) : null}
        {state.kind === "error" ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-4"
            onClick={() => setState({ kind: "idle" })}
          >
            <div
              className="flex w-full max-w-[430px] flex-col gap-3 rounded-2xl bg-surface p-5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-error">
                No pude leer la prenda. Inténtalo con otra foto.
              </p>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="min-h-11 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
              >
                Entendido
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state.kind === "analizando"}
        className="flex min-h-12 items-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
      >
        {state.kind === "analizando" ? (
          <>
            <Spinner className="h-4 w-4" />
            Leyendo…
          </>
        ) : (
          "+ Foto"
        )}
      </button>
      {state.kind === "error" && (
        <p className="max-w-[12rem] text-right text-xs text-error">
          No pude leer la prenda. Inténtalo con otra foto.
        </p>
      )}
      {input}
    </div>
  );
}
