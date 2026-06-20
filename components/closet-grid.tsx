"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { removeItem, updateItemAttrs } from "@/app/closet/actions";

export type ClosetItem = {
  id: string;
  nombre: string;
  imagen: string | null;
  swatch: string;
  category: string;
  formalidad: string;
  temporada: string;
  source: string; // "archetype" | "photo"
};

// Orden + label de categoría (espeja el de la página).
const CAT: { key: string; label: string }[] = [
  { key: "top", label: "Tops" },
  { key: "abrigo", label: "Abrigos" },
  { key: "bottom", label: "Pantalones" },
  { key: "vestido", label: "Vestidos" },
  { key: "calzado", label: "Calzado" },
  { key: "accesorio", label: "Accesorios" },
];
const CAT_LABEL = new Map(CAT.map((c) => [c.key, c.label]));

// Opciones para editar una prenda fotografiada (labels humanas, no el enum crudo).
const EDIT_CAT: { v: string; l: string }[] = [
  { v: "top", l: "Top" },
  { v: "bottom", l: "Pantalón" },
  { v: "abrigo", l: "Abrigo" },
  { v: "vestido", l: "Vestido" },
  { v: "calzado", l: "Calzado" },
  { v: "accesorio", l: "Accesorio" },
];
const FORMALIDADES: { v: string; l: string }[] = [
  { v: "casual", l: "Casual" },
  { v: "formal-casual", l: "Casual-formal" },
  { v: "formal", l: "Formal" },
];
const TEMPORADAS: { v: string; l: string }[] = [
  { v: "calor", l: "Calor" },
  { v: "templado", l: "Templado" },
  { v: "frio", l: "Frío" },
  { v: "todo-el-año", l: "Todo el año" },
];

function Chip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
        on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {label}
      <span className={`text-xs ${on ? "text-accent/70" : "text-muted"}`}>{count}</span>
    </button>
  );
}

function Tile({ item, onTap }: { item: ClosetItem; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} className="flex flex-col gap-1.5 text-left">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-bg">
        {item.imagen ? (
          <Image
            src={item.imagen}
            alt={item.nombre}
            fill
            sizes="(max-width: 430px) 33vw, 130px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0" style={{ backgroundColor: item.swatch }} aria-hidden />
        )}
        {item.source === "photo" ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-accent/90 px-1.5 py-0.5 text-[10px] font-medium text-on-accent">
            tuya
          </span>
        ) : null}
      </div>
      <p className="truncate text-xs font-medium text-ink">{item.nombre}</p>
    </button>
  );
}

// Grid del clóset con filtro por categoría (chips sticky con conteo) y detalle
// tappable por prenda (ver en grande, podar lo que no tienes, y corregir lo que
// la IA leyó mal en tus fotos).
export function ClosetGrid({ items }: { items: ClosetItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null); // null = Todos
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ClosetItem | null>(null);

  const visibles = items.filter((i) => !removed.has(i.id));

  // Categorías presentes (con conteo), en el orden canónico.
  const counts = new Map<string, number>();
  for (const i of visibles) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const presentes = CAT.filter((c) => (counts.get(c.key) ?? 0) > 0);

  // Si la categoría filtrada se queda sin prendas (borraste la última), vuelve a Todos.
  const activeFilter = filter && (counts.get(filter) ?? 0) > 0 ? filter : null;

  const mostrados = activeFilter
    ? visibles.filter((i) => i.category === activeFilter)
    : visibles;

  // Agrupado por categoría (solo en "Todos"); filtrado = un grid plano.
  const grupos = activeFilter
    ? [{ key: activeFilter, label: CAT_LABEL.get(activeFilter) ?? "", prendas: mostrados }]
    : CAT.map((c) => ({
        ...c,
        prendas: visibles.filter((i) => i.category === c.key),
      })).filter((g) => g.prendas.length > 0);

  async function quitar(id: string) {
    setRemoved((s) => new Set(s).add(id));
    setSelected(null);
    const res = await removeItem(id);
    if (!res.ok) {
      setRemoved((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro por categoría: chips con conteo, scroll horizontal, sticky. */}
      <div className="sticky top-0 z-10 -mx-4 bg-bg px-4 py-1">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip label="Todos" count={visibles.length} on={!activeFilter} onClick={() => setFilter(null)} />
          {presentes.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              count={counts.get(c.key) ?? 0}
              on={activeFilter === c.key}
              onClick={() => setFilter(c.key)}
            />
          ))}
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-6 py-14 text-center">
          <p className="editorial text-lg text-ink">tu clóset está vacío</p>
          <p className="text-sm text-muted">Vuelve al inicio y marca los básicos que tienes.</p>
        </div>
      ) : (
        grupos.map((g) => (
          <div key={g.key} className="flex flex-col gap-3">
            {!activeFilter ? (
              <h2 className="text-sm font-medium font-sans uppercase tracking-wide text-muted">{g.label}</h2>
            ) : null}
            <ul className="grid grid-cols-3 gap-3">
              {g.prendas.map((p) => (
                <li key={p.id}>
                  <Tile item={p} onTap={() => setSelected(p)} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {selected ? (
        <ItemSheet
          item={selected}
          onClose={() => setSelected(null)}
          onRemove={() => quitar(selected.id)}
          onSaved={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// Hoja de detalle: imagen grande + quitar. Si es foto, también editar atributos.
function ItemSheet({
  item,
  onClose,
  onRemove,
  onSaved,
}: {
  item: ClosetItem;
  onClose: () => void;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const esFoto = item.source === "photo";
  const [nombre, setNombre] = useState(item.nombre);
  const [categoria, setCategoria] = useState(item.category);
  const [formalidad, setFormalidad] = useState(item.formalidad);
  const [temporada, setTemporada] = useState(item.temporada);
  const [saving, setSaving] = useState(false);

  const dirty =
    esFoto &&
    (nombre.trim() !== item.nombre ||
      categoria !== item.category ||
      formalidad !== item.formalidad ||
      temporada !== item.temporada);

  async function guardar() {
    setSaving(true);
    const res = await updateItemAttrs(item.id, { nombre, categoria, formalidad, temporada });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-4" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-bg">
            {item.imagen ? (
              <Image src={item.imagen} alt={item.nombre} fill sizes="88px" className="object-cover" />
            ) : (
              <span className="absolute inset-0" style={{ backgroundColor: item.swatch }} aria-hidden />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {esFoto ? (
              <>
                <label className="text-xs font-medium text-muted">Nombre</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
                />
              </>
            ) : (
              <>
                <span className="text-base font-medium text-ink">{item.nombre}</span>
                <span className="text-xs text-muted">
                  {CAT_LABEL.get(item.category) ?? item.category} · básico
                </span>
              </>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted">
            <Icon name="equis" size={18} />
          </button>
        </div>

        {esFoto ? (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {EDIT_CAT.map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setCategoria(c.v)}
                    className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
                      categoria === c.v ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink"
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
                  value={formalidad}
                  onChange={(e) => setFormalidad(e.target.value)}
                  className="min-h-10 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
                >
                  {FORMALIDADES.map((f) => (
                    <option key={f.v} value={f.v}>
                      {f.l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted">Temporada</label>
                <select
                  value={temporada}
                  onChange={(e) => setTemporada(e.target.value)}
                  className="min-h-10 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
                >
                  {TEMPORADAS.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {dirty ? (
              <button
                type="button"
                onClick={guardar}
                disabled={saving}
                className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
              >
                {saving ? <Spinner className="h-4 w-4" /> : null}
                Guardar cambios
              </button>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          onClick={onRemove}
          className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-bg text-sm font-medium text-error transition-colors hover:border-error"
        >
          <Icon name="equis" size={16} /> No tengo esta — quitar del clóset
        </button>
      </div>
    </div>
  );
}
