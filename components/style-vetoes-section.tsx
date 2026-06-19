"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import {
  vetoCatalogForGender,
  type Gender,
  type StyleVetoes,
  type VetoKind,
} from "@/lib/vetoes";
import { updateVetoes } from "@/lib/veto-actions";

// Sección "Lo que nunca te pones" (issue #2): chips curados (gender-aware) por
// grupo + texto libre. Lo que se marca aquí, el motor JAMÁS lo sugiere. Opcional.
const GROUPS: { kind: VetoKind; title: string }[] = [
  { kind: "garment", title: "Prendas" },
  { kind: "feature", title: "Detalles" },
  { kind: "color", title: "Colores" },
];

export function StyleVetoesSection({
  gender,
  initial,
}: {
  gender: Gender | null;
  initial: StyleVetoes;
}) {
  const router = useRouter();
  const [chips, setChips] = useState<Set<string>>(new Set(initial.chips ?? []));
  const [free, setFree] = useState<string[]>(initial.free ?? []);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const catalog = vetoCatalogForGender(gender);

  function save(nextChips: Set<string>, nextFree: string[]) {
    startTransition(async () => {
      await updateVetoes([...nextChips], nextFree);
      router.refresh();
    });
  }

  function toggleChip(id: string) {
    const next = new Set(chips);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChips(next);
    save(next, free);
  }

  function addFree() {
    const t = text.trim();
    setText("");
    if (!t || free.some((f) => f.toLowerCase() === t.toLowerCase())) return;
    const next = [...free, t];
    setFree(next);
    save(chips, next);
  }

  function removeFree(f: string) {
    const next = free.filter((x) => x !== f);
    setFree(next);
    save(chips, next);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        Lo que nunca te pones
      </span>
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
        <p className="text-xs text-muted">
          Marca lo que jamás usas y nunca te lo voy a sugerir.
        </p>

        {GROUPS.map((g) => {
          const items = catalog.filter((c) => c.kind === g.kind);
          if (items.length === 0) return null;
          return (
            <div key={g.kind} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink">{g.title}</span>
              <div className="flex flex-wrap gap-1.5">
                {items.map((c) => {
                  const on = chips.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChip(c.id)}
                      disabled={pending}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 disabled:opacity-60 ${
                        on
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-bg text-muted hover:border-ink hover:text-ink"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink">Otra cosa</span>
          {free.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {free.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
                >
                  {f}
                  <button
                    type="button"
                    onClick={() => removeFree(f)}
                    disabled={pending}
                    aria-label={`Quitar ${f}`}
                    className="ml-0.5 disabled:opacity-60"
                  >
                    <Icon name="equis" size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFree();
                }
              }}
              maxLength={40}
              placeholder="ej. nada muy ajustado de los brazos"
              className="min-h-9 flex-1 rounded-sm border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={addFree}
              disabled={pending || !text.trim()}
              className="min-h-9 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
