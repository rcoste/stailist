"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { toUsableImage } from "@/lib/image-file";
import { addPhotoItems, addLibraryCandidates } from "@/app/closet/actions";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { ImageCrop } from "@/components/image-crop";
import type { AddFlowHandle } from "@/components/add-photo-flow";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";
import type { PrendaDetectada } from "@/app/api/analizar-prendas/route";

const MAX_FOTOS = 12;

const CATEGORIAS: { v: PrendaAnalisis["categoria"]; l: string }[] = [
  { v: "top", l: "Top" },
  { v: "bottom", l: "Pantalón" },
  { v: "abrigo", l: "Abrigo" },
  { v: "vestido", l: "Vestido" },
  { v: "calzado", l: "Calzado" },
  { v: "accesorio", l: "Accesorio" },
];
const FORMALIDADES: { v: PrendaAnalisis["formalidad"]; l: string }[] = [
  { v: "casual", l: "Casual" },
  { v: "formal-casual", l: "Casual-formal" },
  { v: "formal", l: "Formal" },
];
// Paleta de colores comunes de ropa para corregir el color con un tap (swatch +
// alternativas). El swatch detectado se muestra aparte como punto de partida.
const PALETTE: { name: string; hex: string }[] = [
  { name: "Negro", hex: "#1A1A1A" },
  { name: "Blanco", hex: "#F2F2F2" },
  { name: "Gris", hex: "#8A8A8A" },
  { name: "Azul marino", hex: "#1F2A44" },
  { name: "Azul", hex: "#3B5BA5" },
  { name: "Beige", hex: "#C8B89E" },
  { name: "Café", hex: "#6B4F3A" },
  { name: "Verde", hex: "#3E5641" },
  { name: "Vino", hex: "#5E2A33" },
  { name: "Rosa", hex: "#C98B9E" },
];

// Comprime una imagen a 1280px JPEG; devuelve dataURL para el análisis.
function comprimir(file: Blob): Promise<string> {
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
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function uid() {
  return crypto.randomUUID();
}

// Prenda detectada en la curación de texto.
// Error tipado del 403 de permiso parental: corta el análisis con el mensaje
// del server (no es un problema de las fotos).
class PermisoError extends Error {}

type DraftItem = {
  id: string;
  attrs: PrendaDetectada;
  on: boolean;
  photoPreview: string; // dataURL de la foto de origen
};

// Prenda ya renderizada, en la curación visual.
type RenderItem = {
  id: string;
  attrs: PrendaDetectada;
  photo: string; // dataURL de la foto original (para el render imagen→imagen)
  status: "pending" | "done" | "failed";
  path: string | null;
  url: string | null;
  verdict: "keep" | "notmine" | "trash";
};

// Foto elegida, ya comprimida (y opcionalmente recortada) antes de analizarla.
type Foto = { id: string; dataUrl: string };

type State =
  | { kind: "idle" }
  | { kind: "explainer" } // así funciona (timeline de 3 pasos) ANTES de elegir fotos
  | { kind: "preparando" } // convirtiendo/comprimiendo las fotos elegidas
  | { kind: "revisar"; fotos: Foto[] } // recorte opcional por foto antes de leer
  | { kind: "analizando"; done: number; total: number }
  | { kind: "texto"; items: DraftItem[] }
  | { kind: "render"; items: RenderItem[]; done: number; total: number }
  | { kind: "visual"; items: RenderItem[] }
  | { kind: "guardando" }
  | { kind: "error"; msg: string };

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// headless: sin botón propio — lo dispara la hoja "Agregar" vía ref.start().
export function ImportCarreteFlow({
  headless = false,
  ref,
}: {
  headless?: boolean;
  ref?: Ref<AddFlowHandle>;
} = {}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [cropId, setCropId] = useState<string | null>(null); // foto en recorte
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // El explainer va ANTES del picker: el valor del carrete (1 foto → la IA separa
  // cada prenda) hay que contarlo primero. "elegir fotos" abre el picker nativo.
  useImperativeHandle(ref, () => ({ start: () => setState({ kind: "explainer" }) }), []);

  // --- 1) Selección → comprime y pasa a "revisar" (recorte opcional) ---
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_FOTOS);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    setState({ kind: "preparando" });
    try {
      const fotos = await Promise.all(
        files.map(async (file) => ({ id: uid(), dataUrl: await comprimir(await toUsableImage(file)) }))
      );
      setState({ kind: "revisar", fotos });
    } catch (e) {
      setState({
        kind: "error",
        msg: e instanceof PermisoError ? e.message : "No pude leer las fotos. Inténtalo otra vez.",
      });
    }
  }

  function removeFoto(id: string) {
    setState((s) => (s.kind === "revisar" ? { ...s, fotos: s.fotos.filter((f) => f.id !== id) } : s));
  }
  function applyCrop(id: string, dataUrl: string) {
    setState((s) =>
      s.kind === "revisar" ? { ...s, fotos: s.fotos.map((f) => (f.id === id ? { ...f, dataUrl } : f)) } : s
    );
  }

  // --- 2) Revisadas → extracción de prendas (IA por foto) ---
  async function analizarFotos() {
    if (state.kind !== "revisar") return;
    const fotos = state.fotos;
    if (fotos.length === 0) return;
    setState({ kind: "analizando", done: 0, total: fotos.length });
    let done = 0;
    try {
      const perPhoto = await Promise.all(
        fotos.map(async (f) => {
          const res = await fetch("/api/analizar-prendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: f.dataUrl }),
          });
          done += 1;
          setState({ kind: "analizando", done, total: fotos.length });
          if (res.status === 403) {
            // Permiso parental pendiente: no es un problema de la foto — corta
            // el flujo con el mensaje real en vez de "no detecté prendas".
            const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
            if (err.error === "permiso_pendiente" && err.message) throw new PermisoError(err.message);
            return [] as DraftItem[];
          }
          if (!res.ok) return [] as DraftItem[];
          const { prendas } = (await res.json()) as { prendas: PrendaDetectada[] };
          return prendas.map((p) => ({ id: uid(), attrs: p, on: true, photoPreview: f.dataUrl }));
        })
      );
      const items = perPhoto.flat();
      if (items.length === 0) {
        setState({
          kind: "error",
          msg: "No detecté prendas en esas fotos. Prueba con fotos donde la ropa se vea bien — puesta, o extendida sobre la cama.",
        });
        return;
      }
      setState({ kind: "texto", items });
    } catch (e) {
      setState({
        kind: "error",
        msg: e instanceof PermisoError ? e.message : "No pude leer las fotos. Inténtalo otra vez.",
      });
    }
  }

  // --- Edición en la curación de texto ---
  function patchItem(id: string, patch: Partial<PrendaDetectada>) {
    setState((s) =>
      s.kind === "texto"
        ? {
            ...s,
            items: s.items.map((it) =>
              it.id === id ? { ...it, attrs: { ...it.attrs, ...patch } } : it
            ),
          }
        : s
    );
  }
  function toggleItem(id: string) {
    setState((s) =>
      s.kind === "texto"
        ? { ...s, items: s.items.map((it) => (it.id === id ? { ...it, on: !it.on } : it)) }
        : s
    );
  }

  // --- 2) Texto confirmado → generar renders ---
  async function generarRenders() {
    if (state.kind !== "texto") return;
    const activos = state.items.filter((it) => it.on);
    if (activos.length === 0) {
      setState({ kind: "error", msg: "No dejaste ninguna prenda activa." });
      return;
    }
    const base: RenderItem[] = activos.map((it) => ({
      id: it.id,
      attrs: it.attrs,
      photo: it.photoPreview,
      status: "pending",
      path: null,
      url: null,
      verdict: "keep",
    }));
    setState({ kind: "render", items: base, done: 0, total: base.length });

    // Render con POOL ACOTADO (no secuencial): hasta CONCURRENCY renders a la vez.
    // Antes era un for secuencial (tiempo ≈ N × un render); con el pool baja a
    // ≈ N/CONCURRENCY. El tope evita bombardear Gemini con N a la vez (429s) y
    // mantiene el progreso claro (el contador sube conforme cada uno termina).
    // Pool de 4 con red de seguridad (reintento en 429/red). Sin el reintento, 4
    // concurrentes podrían pegar el rate-limit de Gemini y fallar la prenda; con
    // backoff, reintenta en vez de rendirse.
    const CONCURRENCY = 4;
    const results: RenderItem[] = base.map((it) => ({ ...it })); // por índice, ordenado
    let done = 0;

    const renderOne = async (idx: number) => {
      const it = base[idx];
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch("/api/render-prenda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: it.photo, attrs: it.attrs }),
          });
          if (res.ok) {
            const { path, url } = (await res.json()) as { path: string; url: string | null };
            results[idx] = { ...it, status: "done", path, url };
            break;
          }
          // 429 = rate-limit de Gemini → backoff y reintenta (hasta 2 veces).
          if (res.status === 429 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
            continue;
          }
          results[idx] = { ...it, status: "failed" };
          break;
        } catch {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
            continue;
          }
          results[idx] = { ...it, status: "failed" };
          break;
        }
      }
      done += 1;
      setState({ kind: "render", items: [...results], done, total: base.length });
    };

    // Worker pool: CONCURRENCY "trabajadores" jalan índices de una cola compartida.
    const queue = base.map((_, i) => i);
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        let idx = queue.shift();
        while (idx !== undefined) {
          await renderOne(idx);
          idx = queue.shift();
        }
      })
    );
    setState({ kind: "visual", items: results });
  }

  function setVerdict(id: string, verdict: RenderItem["verdict"]) {
    setState((s) =>
      s.kind === "visual"
        ? { ...s, items: s.items.map((it) => (it.id === id ? { ...it, verdict } : it)) }
        : s
    );
  }

  // --- 3) Visual confirmado → guardar ---
  async function guardar() {
    if (state.kind !== "visual") return;
    setState({ kind: "guardando" });
    try {
      const keep = state.items.filter((it) => it.verdict === "keep");
      const notmine = state.items.filter((it) => it.verdict === "notmine" && it.path);

      const okItems =
        keep.length === 0
          ? { ok: true, added: 0 }
          : await addPhotoItems(
              keep.map((it) => ({
                attrs: it.attrs,
                renderPath: it.status === "done" ? it.path : null,
                renderStatus: it.status === "done" ? "done" : "failed",
              }))
            );

      if (notmine.length > 0) {
        await addLibraryCandidates(
          notmine.map((it) => ({ attrs: it.attrs, imagePath: it.path as string }))
        );
      }

      if (!okItems.ok) {
        setState({ kind: "error", msg: "No pude guardar las prendas. Inténtalo otra vez." });
        return;
      }
      setState({ kind: "idle" });
      router.refresh();
    } catch {
      setState({ kind: "error", msg: "No pude guardar las prendas. Inténtalo otra vez." });
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,.heic,.heif"
      multiple
      onChange={onFiles}
      className="hidden"
    />
  );

  // ====== RENDER POR ESTADO ======

  if (state.kind === "explainer") {
    const pasos = [
      { icon: "camara" as const, t: "subes fotos", s: "con tu outfit puesto, o tu ropa extendida en la cama." },
      { icon: "destello" as const, t: "la IA separa cada prenda", s: "saco, pantalón, zapatos… una por una." },
      { icon: "gancho" as const, t: "las carga limpias", s: "listas en tu clóset, como de catálogo." },
    ];
    return (
      <Overlay>
        {input}
        <div className="flex flex-col gap-1">
          <h2 className="text-[24px] font-semibold leading-tight text-ink">
            así <em className="font-normal italic">funciona</em>
          </h2>
          <p className="text-sm text-muted">
            una foto con tu outfit y te separo cada prenda.
          </p>
        </div>
        <ol className="flex flex-col">
          {pasos.map((p, i) => (
            <li key={p.t} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent">
                  <Icon name={p.icon} size={19} />
                </span>
                {i < pasos.length - 1 ? (
                  <span className="my-1 w-px flex-1 bg-line" aria-hidden />
                ) : null}
              </div>
              <div className="flex flex-col pb-5 pt-1.5">
                <span className="text-[15px] font-semibold leading-tight text-ink">{p.t}</span>
                <span className="editorial text-sm text-muted">{p.s}</span>
              </div>
            </li>
          ))}
        </ol>
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel="elegir fotos"
          confirmDisabled={false}
          onConfirm={() => inputRef.current?.click()}
        />
      </Overlay>
    );
  }

  if (state.kind === "preparando") {
    return (
      <Overlay>
        <CarreteLoading frase="preparando tus fotos…" />
      </Overlay>
    );
  }

  if (state.kind === "revisar") {
    const cropFoto = state.fotos.find((f) => f.id === cropId) ?? null;
    return (
      <Overlay>
        {input}
        <Header
          title="revisa tus fotos"
          sub="¿Sale alguien más en alguna? Recórtala para dejarte solo a ti. Es opcional."
        />
        <div className="grid grid-cols-3 gap-2">
          {state.fotos.map((f) => (
            <div
              key={f.id}
              className="relative aspect-[3/4] overflow-hidden rounded-sm border border-line bg-bg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.dataUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setCropId(f.id)}
                className="absolute bottom-1 left-1 rounded-sm bg-ink/70 px-1.5 py-1 text-[11px] font-semibold text-on-accent"
              >
                recortar
              </button>
              <button
                type="button"
                onClick={() => removeFoto(f.id)}
                aria-label="quitar foto"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-[13px] font-bold text-on-accent"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel={`leer ${state.fotos.length} ${state.fotos.length === 1 ? "foto" : "fotos"}`}
          confirmDisabled={state.fotos.length === 0}
          onConfirm={analizarFotos}
        />
        {cropFoto ? (
          <ImageCrop
            src={cropFoto.dataUrl}
            onCancel={() => setCropId(null)}
            onDone={(url) => {
              applyCrop(cropFoto.id, url);
              setCropId(null);
            }}
          />
        ) : null}
      </Overlay>
    );
  }

  if (state.kind === "analizando") {
    return (
      <Overlay>
        <CarreteLoading frase="leyendo tus prendas…" count={`${state.done}/${state.total} fotos`} />
      </Overlay>
    );
  }

  if (state.kind === "texto") {
    const activos = state.items.filter((it) => it.on);
    return (
      <Overlay>
        <Header
          title="¿Detecté bien tus prendas?"
          sub="Confirma o corrige cada una. Apaga con la ✓ las que no quieras sumar."
        />
        <div className="flex flex-col gap-3">
          {state.items.map((it) => (
            <DraftCard
              key={it.id}
              item={it}
              onToggle={() => toggleItem(it.id)}
              onPatch={(p) => patchItem(it.id, p)}
            />
          ))}
        </div>
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel={`generar ${activos.length} ${activos.length === 1 ? "prenda" : "prendas"}`}
          confirmDisabled={activos.length === 0}
          onConfirm={generarRenders}
        />
      </Overlay>
    );
  }

  if (state.kind === "render") {
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-3 pb-1 text-center">
          <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-line text-ink motion-safe:animate-[spin_6s_linear_infinite]">
            <Icon name="destello" size={18} />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-medium text-ink">generando tus prendas…</p>
            <p className="tabular text-sm text-muted">
              {state.done}/{state.total}
            </p>
          </div>
        </div>
        {/* Grid que se LLENA: cada prenda con spinner hasta que su render llega
            (en vez de un spinner global) — se siente mucho más rápido. */}
        <div className="grid grid-cols-2 gap-3">
          {state.items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-2"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
                {it.status === "done" && it.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.url}
                    alt={it.attrs.nombre}
                    className="h-full w-full object-cover"
                    style={{ animation: "var(--dur-short) var(--ease-enter) step-in" }}
                  />
                ) : it.status === "failed" ? (
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted">
                    No se pudo generar
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Spinner className="h-5 w-5 text-accent" />
                  </div>
                )}
              </div>
              <p className="truncate text-xs font-medium text-ink">{it.attrs.nombre}</p>
            </div>
          ))}
        </div>
      </Overlay>
    );
  }

  if (state.kind === "visual") {
    const keep = state.items.filter((it) => it.verdict === "keep").length;
    return (
      <Overlay>
        <Header
          title="¿Cuáles son tu prenda?"
          sub="Las que no coincidan no se pierden: nos ayudan a crecer la biblioteca."
        />
        <div className="grid grid-cols-2 gap-3">
          {state.items.map((it) => (
            <RenderCard key={it.id} item={it} onVerdict={(v) => setVerdict(it.id, v)} />
          ))}
        </div>
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel={`sumar ${keep} al clóset`}
          confirmDisabled={false}
          onConfirm={guardar}
        />
      </Overlay>
    );
  }

  if (state.kind === "guardando") {
    return (
      <Overlay>
        <CarreteLoading frase="guardando tu clóset…" />
      </Overlay>
    );
  }

  // Modo headless: la hoja "Agregar" es el trigger. Solo input + error flotante.
  if (headless) {
    return (
      <>
        {input}
        {state.kind === "error" ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/40"
            onClick={() => setState({ kind: "idle" })}
          >
            <div
              className="flex w-full max-w-[430px] flex-col gap-3 rounded-t-[18px] lg:rounded-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center"
              style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-error">{state.msg}</p>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="min-h-11 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
              >
                entendido
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  // idle / error
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setState({ kind: "explainer" })}
        className="flex min-h-12 items-center gap-2 rounded-sm border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent"
      >
        <Icon name="destello" size={16} className="text-accent" />
        importar del carrete
      </button>
      {state.kind === "error" && (
        <p className="max-w-[14rem] text-right text-xs text-error">{state.msg}</p>
      )}
      {input}
    </div>
  );
}

// ====== Subcomponentes ======

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/40">
      <div
        className="flex max-h-[90dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-t-[18px] lg:rounded-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="text-sm text-muted">{sub}</p>
    </div>
  );
}

function Footer({
  cancel,
  confirmLabel,
  confirmDisabled,
  onConfirm,
}: {
  cancel: () => void;
  confirmLabel: string;
  confirmDisabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="sticky bottom-0 flex gap-3 bg-surface pt-1">
      <button
        type="button"
        onClick={cancel}
        className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
      >
        cancelar
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="min-h-12 flex-[2] rounded-sm bg-accent text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

function DraftCard({
  item,
  onToggle,
  onPatch,
}: {
  item: DraftItem;
  onToggle: () => void;
  onPatch: (patch: Partial<PrendaDetectada>) => void;
}) {
  const a = item.attrs;
  const baja = a.confianza === "baja";
  const colorName = PALETTE.find((p) => norm(p.name) === norm(a.color))?.name ?? a.color;
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3 transition-opacity ${
        item.on ? "border-line bg-bg" : "border-line bg-bg opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photoPreview}
          alt=""
          className="h-16 w-12 shrink-0 rounded-md border border-line object-cover"
        />
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            value={a.nombre}
            onChange={(e) => onPatch({ nombre: e.target.value })}
            className="min-h-9 rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
          />
          {baja && (
            <span className="w-fit rounded-sm bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
              No la vi bien — confírmala
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={item.on}
          aria-label={item.on ? "Quitar prenda" : "Incluir prenda"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
            item.on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted"
          }`}
        >
          <Icon name={item.on ? "check" : "mas"} size={14} />
        </button>
      </div>

      {item.on && (
        <>
          <Field label="Tipo">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => onPatch({ categoria: c.v })}
                  className={`min-h-8 rounded-sm border px-2.5 text-xs transition-colors ${
                    a.categoria === c.v
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {c.l}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Color · ${colorName}`}>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => onPatch({ color: p.name, color_hex: p.hex })}
                  aria-label={p.name}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    norm(a.color) === norm(p.name)
                      ? "scale-110 border-accent"
                      : "border-line"
                  }`}
                  style={{ backgroundColor: p.hex }}
                />
              ))}
            </div>
          </Field>

          <Field label="Formalidad">
            <div className="flex flex-wrap gap-1.5">
              {FORMALIDADES.map((f) => (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => onPatch({ formalidad: f.v })}
                  className={`min-h-8 rounded-sm border px-2.5 text-xs transition-colors ${
                    a.formalidad === f.v
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}
    </div>
  );
}

function RenderCard({
  item,
  onVerdict,
}: {
  item: RenderItem;
  onVerdict: (v: RenderItem["verdict"]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
        {item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.attrs.nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-[11px] text-muted">
            No se pudo generar — se guarda con su color
          </div>
        )}
      </div>
      <p className="truncate text-xs font-medium text-ink">{item.attrs.nombre}</p>
      <div className="flex gap-1">
        <VerdictBtn label="es mía" on={item.verdict === "keep"} onClick={() => onVerdict("keep")} />
        <VerdictBtn
          label="no es"
          on={item.verdict === "notmine"}
          onClick={() => onVerdict("notmine")}
        />
        <VerdictBtn
          label="mala"
          on={item.verdict === "trash"}
          onClick={() => onVerdict("trash")}
        />
      </div>
    </div>
  );
}

function VerdictBtn({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 flex-1 rounded-sm border px-1 text-[11px] font-medium transition-colors ${
        on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted"
      }`}
    >
      {label}
    </button>
  );
}

// Loading canónico del carrete (v3): spark girando lento + frase serif + conteo.
function CarreteLoading({ frase, count }: { frase: string; count?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line text-ink motion-safe:animate-[spin_6s_linear_infinite]">
        <Icon name="destello" size={20} />
      </span>
      <p className="text-lg font-medium text-ink">{frase}</p>
      {count ? <p className="tabular text-sm text-muted">{count}</p> : null}
    </div>
  );
}
