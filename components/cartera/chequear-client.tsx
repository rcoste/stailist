"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import type { Swatch } from "@/lib/palette-data";
import { checkColor, type CheckResult } from "@/lib/color/match";
import { comprimirADataUrl } from "@/lib/image-compress";
import { saveToWishlist } from "@/lib/wishlist-add";

const VERDICT: Record<
  CheckResult["verdict"],
  { label: string; tone: string; cls: string }
> = {
  va: { label: "Sí va con tu paleta", tone: "✓", cls: "bg-success/10 text-success" },
  "no-ideal": {
    label: "No es ideal para tu colorimetría",
    tone: "!",
    cls: "bg-warning/10 text-warning",
  },
  parecido: {
    label: "Hay un color parecido recomendado",
    tone: "≈",
    cls: "bg-accent-soft text-ink",
  },
};

const FRASES = [
  "mirando tu prenda…",
  "sacando su color real…",
  "¿va con tu paleta?",
];

// El progreso se cuenta con palabras (criterio de GeneratingScreen: "el progreso
// es lenguaje, nunca un spinner").
function FraseRotando() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % FRASES.length), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      key={i}
      className="text-xs text-muted"
      style={{ animation: "var(--dur-medium) var(--ease-enter) step-in both" }}
    >
      {FRASES[i]}
    </span>
  );
}

export function ChequearClient({ va, evita }: { va: Swatch[]; evita: Swatch[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lo que la IA identificó ("Suéter de lana verde olivo"). Es la prueba de que
  // leyó la PRENDA y no el fondo: sin nombre, un veredicto sobre un hex suelto
  // te deja adivinando de qué te está hablando.
  const [nombre, setNombre] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<Record<string, unknown> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // El color lo lee la IA, NO el promedio de píxeles.
  //
  // Antes esto usaba `dominantColor`, que descarta lo casi-blanco por encima de
  // 244 — y los fondos de foto de producto andan en 242. Resultado: en la foto
  // de una prenda de tienda el "color de la prenda" era el fondo del estudio, y
  // el veredicto salía sobre un blanco que nadie iba a comprar. Alberto lo
  // reportó como "me abrió una pantalla blanca que dice blanco puro".
  // Es el mismo fallo que ya se corrigió en la wishlist, y este módulo es
  // justamente el que MÁS fotos de tienda recibe.
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const dataUrl = await comprimirADataUrl(file);
      const res = await fetch("/api/analizar-prenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      // La respuesta viene ENVUELTA: { analisis: {...} }, no plana.
      const { analisis } = res.ok
        ? ((await res.json()) as { analisis?: Record<string, unknown> })
        : { analisis: undefined };
      const hex = (analisis?.color_hex as string) ?? null;
      if (!hex) {
        setError("No pude leer el color de esa foto. Prueba con una más cerrada.");
        URL.revokeObjectURL(url);
        setBusy(false);
        return;
      }
      setNombre((analisis?.nombre as string) ?? null);
      setAttrs(analisis ?? null);
      setResult(checkColor(hex, va, evita));
      setPreview(url);
      setFile(file);
    } catch {
      setError("Se me cayó la conexión. Inténtalo otra vez.");
      URL.revokeObjectURL(url);
    }
    setBusy(false);
  }

  function reset() {
    setResult(null);
    setPreview(null);
    setFile(null);
    setNombre(null);
    setAttrs(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="flex flex-col gap-5 pt-4">
      {/* Back */}
      <Link
        href="/cartera"
        className="flex w-fit items-center gap-1.5 text-[15px] font-semibold text-ink"
      >
        <Icon name="chevron" size={19} rotate={180} /> cartera
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
          ¿me va este color?
        </h1>
        {/* Antes decía "chequea un color" + "¿comprando en línea?". Alberto entró
            y salió sin saber para qué servía: el título nombraba la MECÁNICA
            (chequear) en vez de la pregunta que traes en la cabeza cuando estás
            parada en la tienda. Ahora el título ES esa pregunta. */}
        <p className="text-sm text-muted">
          estás en la tienda o viendo algo en línea y no sabes si te queda. sube
          la foto y te digo si ese color va con tu colorimetría — antes de
          pagarlo.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />

      {!result ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface px-6 text-center transition-colors hover:border-ink disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
            <Icon name="destello" size={24} />
          </span>
          <span className="text-sm font-semibold text-ink">
            {busy ? "mirando tu prenda…" : "subir foto de la prenda"}
          </span>
          {/* Leer la prenda con IA toma unos segundos: el progreso se cuenta con
              palabras, nunca con un spinner mudo (mismo criterio que el resto
              de la app). */}
          {busy ? (
            <FraseRotando />
          ) : (
            <span className="text-xs text-muted">desde tu galería o cámara</span>
          )}
        </button>
      ) : (
        <Result
          result={result}
          nombre={nombre}
          attrs={attrs}
          preview={preview}
          file={file}
          onReset={reset}
        />
      )}

      {error ? (
        <p className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-[12.5px] leading-relaxed text-error">
          {error}
        </p>
      ) : null}

      <p className="rounded-md border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
        leo el color principal de la prenda, ignorando el fondo de la foto. en
        estampados o multicolor me quedo con el tono dominante — úsalo como guía.
      </p>
    </section>
  );
}

function Result({
  result,
  nombre,
  attrs,
  preview,
  file,
  onReset,
}: {
  result: CheckResult;
  /** Lo que la IA identificó, para que el veredicto tenga sujeto. */
  nombre: string | null;
  /** Análisis completo — lo hereda la wishlist si la guardas (habilita "ya la
   *  compré", que necesita la categoría para crear la prenda en el clóset). */
  attrs: Record<string, unknown> | null;
  preview: string | null;
  file: File | null;
  onReset: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const v = VERDICT[result.verdict];

  async function guardar() {
    if (!file) return;
    setSaving(true);
    const res = await saveToWishlist(
      file,
      result.garmentHex,
      result.verdict,
      "upload",
      nombre,
      attrs
    );
    setSaving(false);
    if (res.ok) setSaved(true);
  }
  const explanation =
    result.verdict === "va"
      ? `Se parece a ${result.nearestVa.nombre}. Adelante, te va.`
      : result.verdict === "no-ideal"
        ? `Tira a ${result.nearEvita?.nombre ?? "un tono que te apaga"}, de los que apagan tu cara. Si te encanta, llévalo lejos de la cara (pantalón, no top) — o cámbialo por uno de estos.`
        : `No es exacto de tu paleta, pero estos te quedan mejor y se le parecen.`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="prenda"
            className="h-20 w-20 flex-none rounded-md border border-line object-cover"
          />
        ) : null}
        {/* El nombre de lo que leyó, no solo el hex. Un veredicto sobre un
            código hexadecimal suelto te deja adivinando de qué te habla — y era
            justo donde el bug del fondo pasaba desapercibido: "#F4F3F1" no
            grita "esto es el fondo del estudio", pero "Fondo blanco" sí. */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-12 w-12 flex-none rounded-md border border-line"
            style={{ backgroundColor: result.garmentHex }}
          />
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted">
              {nombre ? "leí esto" : "color detectado"}
            </span>
            <span className="truncate text-sm font-semibold text-ink">
              {nombre ?? result.garmentHex}
            </span>
            {nombre ? (
              <span className="tabular text-[11px] text-muted">{result.garmentHex}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`flex items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-bold ${v.cls}`}>
        <span aria-hidden>{v.tone}</span>
        {v.label}
      </div>

      <p className="editorial text-[14px] leading-relaxed text-muted">{explanation}</p>

      {result.verdict !== "va" ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            mejor estos
          </p>
          <div className="grid grid-cols-3 gap-3">
            {result.alternatives.map((s, i) => (
              <figure key={i} className="flex flex-col gap-1.5">
                <div
                  className="aspect-square w-full rounded-md border border-line"
                  style={{ backgroundColor: s.hex }}
                />
                <figcaption className="text-[10.5px] font-medium leading-tight text-ink">
                  {s.nombre}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {file ? (
        saved ? (
          <Link
            href="/wishlist"
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent text-sm font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="check" size={16} /> guardado · ver wishlist
          </Link>
        ) : (
          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent text-sm font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-60"
          >
            <Icon name="destello" size={16} /> {saving ? "guardando…" : "guardar en wishlist"}
          </button>
        )
      ) : null}

      <button
        type="button"
        onClick={onReset}
        className="flex min-h-12 items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
      >
        <Icon name="repetir" size={16} /> chequear otra
      </button>
    </div>
  );
}
