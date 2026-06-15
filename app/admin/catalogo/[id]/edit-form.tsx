"use client";

import { useState } from "react";
import Image from "next/image";
import { updateArchetypeAttrs, regenerateArchetypeImage } from "./actions";
import { Spinner } from "@/components/spinner";
import type { ImageType } from "@/lib/archetype-image";

export type ArchetypeRow = {
  id: number;
  slug: string;
  name: string;
  category: string;
  segment: string;
  sort_order: number;
  attrs: {
    color?: string;
    color_hex?: string;
    formalidad?: string;
    temporada?: string;
  };
  image_path: string | null;
};

const CATEGORIES = ["top", "bottom", "abrigo", "calzado", "vestido", "accesorio"];
const SEGMENTS = ["hombre", "mujer", "unisex"];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

const inputCls =
  "min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:border-accent";

export function EditArchetype({ archetype: a }: { archetype: ArchetypeRow }) {
  const [img, setImg] = useState(a.image_path);
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<ImageType>(
    a.category === "calzado" ? "shoes" : "flat"
  );
  const [regen, setRegen] = useState<{ loading?: boolean; error?: string }>({});
  const [saved, setSaved] = useState<{ ok?: boolean; error?: string }>({});
  const [saving, setSaving] = useState(false);

  async function onSave(formData: FormData) {
    setSaving(true);
    setSaved({});
    const res = await updateArchetypeAttrs(a.id, formData);
    setSaved(res.ok ? { ok: true } : { error: res.error });
    setSaving(false);
  }

  async function doRegen() {
    if (!desc.trim()) {
      setRegen({ error: "Escribe una descripción en inglés." });
      return;
    }
    setRegen({ loading: true });
    const r = await regenerateArchetypeImage(a.id, a.slug, desc, type);
    if (r.ok && r.image) {
      setImg(r.image);
      setRegen({});
    } else {
      setRegen({ error: r.error ?? "Falló." });
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
      {/* Imagen + regeneración */}
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line bg-bg">
          {img ? (
            <Image src={img} alt={a.name} fill sizes="200px" className="object-cover" />
          ) : (
            <span
              className="absolute inset-0"
              style={{ backgroundColor: a.attrs.color_hex ?? "#E5E1DD" }}
            />
          )}
        </div>
        <label className="flex flex-col gap-1">
          <Label>Descripción para la IA (inglés)</Label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="a charcoal grey fine-knit turtleneck sweater"
            className={`${inputCls} py-2 leading-snug`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={type === "shoes"}
            onChange={(e) => setType(e.target.checked ? "shoes" : "flat")}
          />
          Es calzado (encuadre de zapatos)
        </label>
        <button
          type="button"
          onClick={doRegen}
          disabled={regen.loading}
          className="flex min-h-10 items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
        >
          {regen.loading ? (
            <>
              <Spinner className="h-4 w-4" />
              Generando… (~10s)
            </>
          ) : (
            "Regenerar imagen"
          )}
        </button>
        {regen.error ? (
          <p className="text-xs text-error">{regen.error}</p>
        ) : null}
      </div>

      {/* Atributos */}
      <form action={onSave} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1">
            <Label>Nombre</Label>
            <input name="name" defaultValue={a.name} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <Label>Categoría</Label>
            <select name="category" defaultValue={a.category} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <Label>Segmento</Label>
            <select name="segment" defaultValue={a.segment} className={inputCls}>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <Label>Color</Label>
            <input name="color" defaultValue={a.attrs.color ?? ""} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <Label>Color hex</Label>
            <input
              name="color_hex"
              defaultValue={a.attrs.color_hex ?? ""}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label>Formalidad</Label>
            <input
              name="formalidad"
              defaultValue={a.attrs.formalidad ?? ""}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label>Temporada</Label>
            <input
              name="temporada"
              defaultValue={a.attrs.temporada ?? ""}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label>Orden</Label>
            <input
              name="sort_order"
              type="number"
              defaultValue={a.sort_order}
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-full bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar atributos"}
          </button>
          {saved.ok ? (
            <span className="text-sm text-success">✓ Guardado</span>
          ) : null}
          {saved.error ? (
            <span className="text-sm text-error">{saved.error}</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
