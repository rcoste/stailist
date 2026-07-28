"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import {
  saveStyleReference,
  discardStyleReference,
  removeStyleReference,
  applyReferencePreset,
} from "@/app/perfil/actions";
import { REFERENCIAS_PRECARGADAS } from "@/lib/referencias";
import { StyleWordsCard } from "@/components/style-words-card";

type Fit = { verdict: string; note: string };
export type StyleRef = {
  summary: string;
  tags: string[];
  fit?: Fit | null;
  images: string[];
  /** Rutas de storage de esas fotos — se mandan como `keep` al sumar más. */
  paths?: string[];
};

// Tope de fotos de referencia. Vive aquí y en la API (que lo revalida).
const MAX_FOTOS = 3;
type Preview = { summary: string; tags: string[]; fit: Fit; images: { path: string; url: string | null }[] };

// El atajo "usa el estilo de una de nuestras stylists" (Carla / María) está
// APAGADO, no borrado. Decisión de Roberto: en pantalla son dos nombres y un
// párrafo — sin una sola imagen no dicen nada, y estás pidiéndole a alguien que
// adopte un estilo que no puede ver. La maquinaria sigue completa (los presets
// en lib/referencias, applyReferencePreset, y el camino al motor): cuando haya
// fotos del guardarropa de cada una, se prende esto y ya. Nadie había aplicado
// ninguna (0 perfiles al apagarlo), así que esconderlo no le quita nada a nadie.
const MOSTRAR_STYLISTS = false;

const VERDICT: Record<string, { label: string; cls: string }> = {
  va: { label: "te va increíble", cls: "bg-success/10 text-success" },
  ajustes: { label: "te va, con ajustes", cls: "bg-accent-soft text-ink" },
  ojo: { label: "ojo con esto", cls: "bg-warning/10 text-warning" },
};

// "Tu estilo de referencia" (v2): subes 1-3 fotos de un estilo que te gusta; la IA
// lo describe Y evalúa si te VA (colorimetría/silueta/vetos) → veredicto honesto.
// TÚ decides si lo absorbes (pushback antes de guardar). La colorimetría sigue
// mandando el color; esto inspira vibe y siluetas.
// Card ÚNICA de "cuál es tu estilo" (2026-07-28). Antes eran dos pegadas —
// esta (fotos) y "tu estilo en tus palabras" (texto) — preguntando lo mismo con
// el mismo peso. Se quedó la de referencias VISUALES como la petición principal
// (señalar es fácil; describirte por escrito casi nadie puede) y el texto bajó a
// un renglón opcional adentro. El dato que sostiene el orden: en 28 días nadie
// subió una foto, así que el camino bueno tampoco estaba funcionando compitiendo
// contra otro.
export function StyleReferenceCard({
  initial,
  styleWords = null,
}: {
  initial: StyleRef | null;
  /** El texto libre, ahora un renglón de esta card en vez de una card aparte. */
  styleWords?: string | null;
}) {
  const [saved, setSaved] = useState<StyleRef | null>(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function downscale(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = 1024;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("img"));
      img.src = url;
    });
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    // Las que ya tenías se CONSERVAN y las nuevas se suman hasta el tope.
    // Antes cualquier subida reemplazaba todo y borraba las anteriores del
    // storage, con un botón que solo decía "cambiar" — nadie lee eso como
    // "vas a perder las que tenías".
    const keep = (saved?.paths ?? []).slice(0, MAX_FOTOS);
    const hueco = Math.max(0, MAX_FOTOS - keep.length);
    const files = Array.from(e.target.files ?? []).slice(0, hueco);
    if (files.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setErr(null);
    setBusy(true);
    setPreview(null);
    try {
      const images = await Promise.all(files.map(downscale));
      const res = await fetch("/api/estilo-referencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, keep }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = data as { error?: string; message?: string };
        // El 403 de permiso parental trae el mensaje real — mostrarlo en vez
        // del genérico que invita a reintentar con otra foto.
        setErr(
          e.error === "permiso_pendiente" && e.message
            ? e.message
            : "No pude leer el estilo. Prueba con otra(s) foto(s) de cuerpo completo."
        );
      } else setPreview(data as Preview);
    } catch {
      setErr("Algo falló. Inténtalo de nuevo.");
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function usar() {
    if (!preview) return;
    start(async () => {
      const r = await saveStyleReference({
        summary: preview.summary,
        tags: preview.tags,
        fit: preview.fit,
        image_paths: preview.images.map((i) => i.path),
      });
      if (r.ok) {
        setSaved({
          summary: preview.summary,
          tags: preview.tags,
          fit: preview.fit,
          images: preview.images.map((i) => i.url).filter((u): u is string => !!u),
          paths: preview.images.map((i) => i.path),
        });
        setPreview(null);
      }
    });
  }

  function descartar() {
    if (!preview) return;
    const paths = preview.images.map((i) => i.path);
    setPreview(null);
    start(async () => {
      await discardStyleReference(paths);
    });
  }

  function usarPreset(id: string) {
    setErr(null);
    start(async () => {
      const r = await applyReferencePreset(id);
      if (r.ok) {
        const preset = REFERENCIAS_PRECARGADAS.find((p) => p.id === id);
        if (preset) {
          setSaved({ summary: preset.summary, tags: preset.tags, fit: null, images: [] });
        }
      } else {
        setErr("No pude guardar la referencia. Inténtalo de nuevo.");
      }
    });
  }

  function quitar() {
    start(async () => {
      const r = await removeStyleReference();
      if (r.ok) setSaved(null);
    });
  }

  // Con el tope alcanzado ya no se puede sumar: se dice el conteo en vez de
  // ofrecer un botón que no va a hacer nada.
  const lleno = (saved?.paths?.length ?? 0) >= MAX_FOTOS;

  const fitChip = (fit: Fit) => {
    const v = VERDICT[fit.verdict] ?? VERDICT.ajustes;
    return (
      <span className={`w-fit rounded-sm px-2 py-0.5 text-[11px] font-semibold ${v.cls}`}>
        {v.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFiles}
        className="hidden"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Tu estilo de referencia
        </span>
        {saved && !preview && !busy ? (
          lleno ? (
            <span className="shrink-0 text-[11.5px] text-muted">{MAX_FOTOS} de {MAX_FOTOS} fotos</span>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="shrink-0 text-[11.5px] font-medium text-accent hover:text-accent-deep disabled:opacity-50"
            >
              sumar foto
            </button>
          )
        ) : null}
      </div>

      {busy ? (
        <div className="flex items-center gap-2.5 py-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" /> leyendo el estilo y viendo si te va…
        </div>
      ) : preview ? (
        // PREVIEW: el usuario decide si lo absorbe (pushback).
        <div className="flex flex-col gap-3">
          {/* Mismo formato que el estado guardado: si aquí se vieran chicas y al
              guardar grandes, la transición daría un salto raro. */}
          <div className="grid grid-cols-3 gap-1.5">
            {preview.images.map((im, i) =>
              im.url ? (
                <div
                  key={i}
                  className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg"
                >
                  <Image src={im.url} alt="" fill sizes="110px" className="object-cover" />
                </div>
              ) : null
            )}
          </div>
          {fitChip(preview.fit)}
          <p className="text-[13.5px] leading-snug text-ink">{preview.fit.note}</p>
          <p className="text-[12.5px] leading-snug text-muted">{preview.summary}</p>
          <div className="mt-1 flex gap-2.5">
            <button
              type="button"
              onClick={usar}
              disabled={pending}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-60"
            >
              {pending ? <Spinner className="h-4 w-4 text-on-accent" /> : <Icon name="check" size={16} />}
              usar este estilo
            </button>
            <button
              type="button"
              onClick={descartar}
              disabled={pending}
              className="min-h-10 rounded-sm border border-line px-4 text-sm font-medium text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
            >
              descartar
            </button>
          </div>
        </div>
      ) : saved ? (
        // GUARDADO.
        // Las fotos MANDAN y van arriba a lo ancho. Antes iban en una columna de
        // 64px al lado del texto, que en un teléfono de 375px dejaba la columna
        // de texto en 163px: el resumen salía en 8 renglones de ribete y las
        // etiquetas caían una por fila. En una card cuyo argumento es "tu
        // referencia es visual", las fotos eran lo más chico de la card.
        <div className="flex flex-col gap-3">
          {saved.images.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {saved.images.slice(0, MAX_FOTOS).map((u, i) => (
                <div
                  key={i}
                  className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg"
                >
                  <Image src={u} alt="" fill sizes="110px" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1.5">
            {saved.fit ? fitChip(saved.fit) : null}
            {saved.fit ? (
              <p className="text-[12.5px] leading-snug text-ink">{saved.fit.note}</p>
            ) : null}
            <p className="text-[12.5px] leading-snug text-muted">{saved.summary}</p>
            {saved.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {saved.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-line bg-bg px-2 py-0.5 text-[11px] text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={quitar}
              disabled={pending}
              className="mt-0.5 w-fit text-[11.5px] font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              {pending ? "quitando…" : "quitar"}
            </button>
          </div>
        </div>
      ) : (
        // VACÍO.
        <>
          <p className="text-[13px] leading-snug text-muted">
            ¿Te encanta cómo se viste alguien? Sube 1-3 fotos y te digo si te va —
            y afino tus outfits hacia ese estilo (tus colores no cambian).
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-10 w-fit items-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={16} /> subir fotos
          </button>

          {/* Referencias precargadas: el atajo sin fotos — estilos de nuestras
              stylists, aplicables con un tap. Apagado hasta que tengan imagen. */}
          {MOSTRAR_STYLISTS ? (
          <>
          <p className="mt-1 text-[12px] text-muted">
            ¿O prefieres el estilo de una de nuestras stylists?
          </p>
          <div className="flex flex-col gap-2">
            {REFERENCIAS_PRECARGADAS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => usarPreset(r.id)}
                disabled={pending}
                className="flex flex-col items-start gap-0.5 rounded-sm border border-line bg-bg px-3 py-2.5 text-left transition-colors hover:border-ink disabled:opacity-50"
              >
                <span className="text-[13.5px] font-semibold text-ink">{r.nombre}</span>
                <span className="text-[12px] leading-snug text-muted">{r.desc}</span>
              </button>
            ))}
          </div>
          </>
          ) : null}
        </>
      )}

      {err ? <p className="text-xs text-error">{err}</p> : null}

      {/* El texto libre, degradado a renglón. Se oculta mientras decides sobre
          unas fotos recién analizadas: ahí la card tiene una sola pregunta. */}
      {!preview ? <StyleWordsCard initial={styleWords} variant="inline" /> : null}
    </div>
  );
}
