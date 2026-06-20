"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toUsableImage } from "@/lib/image-file";
import { addPhotoItems, addLibraryCandidates } from "@/app/closet/actions";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
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
type DraftItem = {
  id: string;
  attrs: PrendaDetectada;
  on: boolean;
  photoPreview: string; // dataURL de la foto de origen
};

// Prenda ya renderizada, en la curación visual.
type RenderItem = {
  id: string;
  attrs: PrendaAnalisis;
  status: "pending" | "done" | "failed";
  path: string | null;
  url: string | null;
  verdict: "keep" | "notmine" | "trash";
};

type State =
  | { kind: "idle" }
  | { kind: "analizando"; done: number; total: number }
  | { kind: "texto"; items: DraftItem[] }
  | { kind: "render"; items: RenderItem[]; done: number; total: number }
  | { kind: "visual"; items: RenderItem[] }
  | { kind: "guardando" }
  | { kind: "error"; msg: string };

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function ImportCarreteFlow() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // --- 1) Selección + extracción ---
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_FOTOS);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    setState({ kind: "analizando", done: 0, total: files.length });
    let done = 0;
    try {
      const perPhoto = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await comprimir(await toUsableImage(file));
          const res = await fetch("/api/analizar-prendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });
          done += 1;
          setState({ kind: "analizando", done, total: files.length });
          if (!res.ok) return [] as DraftItem[];
          const { prendas } = (await res.json()) as { prendas: PrendaDetectada[] };
          return prendas.map((p) => ({ id: uid(), attrs: p, on: true, photoPreview: dataUrl }));
        })
      );
      const items = perPhoto.flat();
      if (items.length === 0) {
        setState({
          kind: "error",
          msg: "No detecté prendas en esas fotos. Prueba con fotos donde se te vea la ropa de cuerpo.",
        });
        return;
      }
      setState({ kind: "texto", items });
    } catch {
      setState({ kind: "error", msg: "No pude leer las fotos. Inténtalo otra vez." });
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
      status: "pending",
      path: null,
      url: null,
      verdict: "keep",
    }));
    setState({ kind: "render", items: base, done: 0, total: base.length });

    // Render secuencial para no saturar y dar progreso claro.
    const results: RenderItem[] = [];
    let done = 0;
    for (const it of base) {
      try {
        const res = await fetch("/api/render-prenda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(it.attrs),
        });
        if (res.ok) {
          const { path, url } = (await res.json()) as { path: string; url: string | null };
          results.push({ ...it, status: "done", path, url });
        } else {
          results.push({ ...it, status: "failed" });
        }
      } catch {
        results.push({ ...it, status: "failed" });
      }
      done += 1;
      setState({ kind: "render", items: [...results, ...base.slice(done)], done, total: base.length });
    }
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

  if (state.kind === "analizando") {
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Spinner className="h-7 w-7 text-accent" />
          <p className="editorial text-base text-ink">Leyendo tus prendas…</p>
          <p className="text-sm text-muted">
            {state.done}/{state.total} fotos
          </p>
        </div>
      </Overlay>
    );
  }

  if (state.kind === "texto") {
    const activos = state.items.filter((it) => it.on);
    // Marca posibles duplicados (mismo tipo+color que otra prenda activa anterior).
    const seen = new Set<string>();
    const dupId = new Set<string>();
    for (const it of state.items) {
      if (!it.on) continue;
      const key = `${it.attrs.categoria}|${norm(it.attrs.color)}`;
      if (seen.has(key)) dupId.add(it.id);
      else seen.add(key);
    }
    return (
      <Overlay>
        <Header
          title="¿Detecté bien tus prendas?"
          sub="Confirma o corrige antes de generarlas. Apaga lo que no quieras."
        />
        <div className="flex flex-col gap-3">
          {state.items.map((it) => (
            <DraftCard
              key={it.id}
              item={it}
              dup={dupId.has(it.id)}
              onToggle={() => toggleItem(it.id)}
              onPatch={(p) => patchItem(it.id, p)}
            />
          ))}
        </div>
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel={`Generar ${activos.length} ${activos.length === 1 ? "prenda" : "prendas"}`}
          confirmDisabled={activos.length === 0}
          onConfirm={generarRenders}
        />
      </Overlay>
    );
  }

  if (state.kind === "render") {
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Spinner className="h-7 w-7 text-accent" />
          <p className="editorial text-base text-ink">Generando tus prendas…</p>
          <p className="text-sm text-muted">
            {state.done}/{state.total}
          </p>
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
          confirmLabel={`Sumar ${keep} al clóset`}
          confirmDisabled={false}
          onConfirm={guardar}
        />
      </Overlay>
    );
  }

  if (state.kind === "guardando") {
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Spinner className="h-7 w-7 text-accent" />
          <p className="editorial text-base text-ink">Guardando tu clóset…</p>
        </div>
      </Overlay>
    );
  }

  // idle / error
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent"
      >
        <Icon name="destello" size={16} className="text-accent" />
        Importar del carrete
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-4">
      <div className="flex max-h-[90dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5">
        {children}
      </div>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="editorial text-xl text-ink">{title}</h2>
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
        className="min-h-12 flex-1 rounded-full border border-line bg-surface text-sm font-medium text-ink"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="min-h-12 flex-[2] rounded-full bg-accent text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function DraftCard({
  item,
  dup,
  onToggle,
  onPatch,
}: {
  item: DraftItem;
  dup: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<PrendaDetectada>) => void;
}) {
  const a = item.attrs;
  const baja = a.confianza === "baja";
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3 transition-opacity ${
        item.on ? "border-line bg-bg" : "border-line bg-bg opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Foto de origen + swatch del color detectado */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.photoPreview}
            alt=""
            className="h-16 w-12 rounded-md border border-line object-cover"
          />
          <span
            className="h-4 w-12 rounded-full border border-line"
            style={{ backgroundColor: a.color_hex }}
            aria-hidden
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            value={a.nombre}
            onChange={(e) => onPatch({ nombre: e.target.value })}
            className="min-h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {baja && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                Revisa esto
              </span>
            )}
            {dup && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                ¿Repetida?
              </span>
            )}
          </div>
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
          {/* Tipo */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((c) => (
              <button
                key={c.v}
                type="button"
                onClick={() => onPatch({ categoria: c.v })}
                className={`min-h-8 rounded-full border px-2.5 text-xs transition-colors ${
                  a.categoria === c.v
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {c.l}
              </button>
            ))}
          </div>
          {/* Color (swatch + alternativas) */}
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => onPatch({ color: p.name, color_hex: p.hex })}
                aria-label={p.name}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  norm(a.color) === norm(p.name) ? "border-accent scale-110" : "border-line"
                }`}
                style={{ backgroundColor: p.hex }}
              />
            ))}
          </div>
          {/* Formalidad */}
          <div className="flex flex-wrap gap-1.5">
            {FORMALIDADES.map((f) => (
              <button
                key={f.v}
                type="button"
                onClick={() => onPatch({ formalidad: f.v })}
                className={`min-h-8 rounded-full border px-2.5 text-xs transition-colors ${
                  a.formalidad === f.v
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>
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
        <VerdictBtn label="Es mía" on={item.verdict === "keep"} onClick={() => onVerdict("keep")} />
        <VerdictBtn
          label="No es"
          on={item.verdict === "notmine"}
          onClick={() => onVerdict("notmine")}
        />
        <VerdictBtn
          label="Mala"
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
      className={`min-h-8 flex-1 rounded-full border px-1 text-[11px] font-medium transition-colors ${
        on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted"
      }`}
    >
      {label}
    </button>
  );
}
