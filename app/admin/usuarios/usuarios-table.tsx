"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type UserRow = {
  id: string;
  email: string;
  isAdmin: boolean;
  onboardingStep: number;
  onboardingDone: boolean;
  color: boolean;
  avatar: boolean;
  capsula: boolean;
  closet: number;
  closetPhotos: number;
  looks: number;
  viaje: number;
  cartera: number;
  worn: number;
  votes: number;
  lastActive: number | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// "Cuándo" en lenguaje humano. `now` viene del servidor para no depender del
// reloj del cliente ni disparar la regla de pureza de React.
function hace(ts: number | null, now: number): string {
  if (ts === null) return "nunca";
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
}

type SortKey =
  | "email"
  | "lastActive"
  | "onboarding"
  | "color"
  | "closet"
  | "looks"
  | "avatar"
  | "capsula"
  | "viaje"
  | "cartera"
  | "worn";

// Valor ordenable por columna. Los booleanos van como 0/1.
function sortVal(r: UserRow, key: SortKey): number | string {
  switch (key) {
    case "email":
      return r.email.toLowerCase();
    case "lastActive":
      return r.lastActive ?? -1;
    case "onboarding":
      return r.onboardingStep;
    case "color":
      return r.color ? 1 : 0;
    case "closet":
      return r.closet;
    case "looks":
      return r.looks;
    case "avatar":
      return r.avatar ? 1 : 0;
    case "capsula":
      return r.capsula ? 1 : 0;
    case "viaje":
      return r.viaje;
    case "cartera":
      return r.cartera;
    case "worn":
      return r.worn;
  }
}

const COLS: { key: SortKey; label: string; title?: string; left?: boolean }[] = [
  { key: "email", label: "Usuario", left: true },
  { key: "lastActive", label: "Último uso", title: "Actividad más reciente" },
  { key: "onboarding", label: "Onb.", title: "Paso de onboarding (✓ = completo)" },
  { key: "color", label: "Color", title: "Hizo su colorimetría" },
  { key: "closet", label: "Clóset", title: "Prendas activas (📷 = con fotos propias)" },
  { key: "looks", label: "Looks", title: "Outfits generados" },
  { key: "avatar", label: "Avatar", title: "Creó su avatar" },
  { key: "capsula", label: "Esenciales", title: "Calculó sus esenciales" },
  { key: "viaje", label: "Viaje", title: "Viajes creados" },
  { key: "cartera", label: "Cartera", title: "Prendas en la cartera / wishlist" },
  { key: "worn", label: "Puesto", title: 'Marcó "me lo puse"' },
];

type FilterKey =
  | "active7d"
  | "onbDone"
  | "avatar"
  | "capsula"
  | "viaje"
  | "cartera"
  | "worn"
  | "photos";

const FILTERS: { key: FilterKey; label: string; test: (r: UserRow, now: number) => boolean }[] = [
  { key: "active7d", label: "Activos 7d", test: (r, now) => r.lastActive !== null && now - r.lastActive <= WEEK_MS },
  { key: "onbDone", label: "Onboarding ✓", test: (r) => r.onboardingDone },
  { key: "avatar", label: "Con avatar", test: (r) => r.avatar },
  { key: "capsula", label: "Con esenciales", test: (r) => r.capsula },
  { key: "viaje", label: "Usó viaje", test: (r) => r.viaje > 0 },
  { key: "cartera", label: "Usó cartera", test: (r) => r.cartera > 0 },
  { key: "worn", label: "Se puso un look", test: (r) => r.worn > 0 },
  { key: "photos", label: "Fotos propias", test: (r) => r.closetPhotos > 0 },
];

// Celda ✓ / — para módulos booleanos.
function Bool({ on }: { on: boolean }) {
  return on ? (
    <span className="text-success">✓</span>
  ) : (
    <span className="text-muted/50">—</span>
  );
}

// Celda numérica: el 0 se apaga para que la vista respire.
function Num({ n, suffix }: { n: number; suffix?: string }) {
  if (n === 0) return <span className="text-muted/50">—</span>;
  return (
    <span className="text-ink">
      {n}
      {suffix ? <span className="text-muted">{suffix}</span> : null}
    </span>
  );
}

export function UsuariosTable({ rows, now }: { rows: UserRow[]; now: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [asc, setAsc] = useState(false);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setAsc((a) => !a);
    } else {
      setSortKey(key);
      // Texto arranca ascendente (A→Z); números/fechas descendente (más arriba).
      setAsc(key === "email");
    }
  };

  const toggleFilter = (key: FilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visible = useMemo(() => {
    const active = FILTERS.filter((f) => filters.has(f.key));
    const filtered = rows.filter((r) => active.every((f) => f.test(r, now)));
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortVal(a, sortKey);
      const vb = sortVal(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      // Desempate estable por email.
      return a.email.localeCompare(b.email);
    });
  }, [rows, filters, sortKey, asc, now]);

  const activos = rows.filter(
    (r) => r.lastActive !== null && now - r.lastActive <= WEEK_MS
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Usuarios</h1>
        <p className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? "perfil" : "perfiles"} · {activos}{" "}
          {activos === 1 ? "activo" : "activos"} esta semana
          {filters.size > 0 ? ` · ${visible.length} en el filtro` : ""}
        </p>
      </div>

      {/* Filtros combinables (AND) */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const on = filters.has(f.key);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                on
                  ? "bg-accent text-on-accent"
                  : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        {filters.size > 0 ? (
          <button
            type="button"
            onClick={() => setFilters(new Set())}
            className="rounded-full px-3 py-1 text-xs font-medium text-muted hover:text-ink"
          >
            limpiar
          </button>
        ) : null}
      </div>

      {/* Tabla con scroll horizontal en móvil */}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {COLS.map((c) => {
                const active = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    title={c.title}
                    className={`px-3 py-2.5 font-medium ${c.left ? "text-left" : "text-center"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={`inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-200 ${
                        active ? "text-ink" : "text-muted hover:text-ink"
                      }`}
                    >
                      {c.label}
                      <span className="text-[10px]">
                        {active ? (asc ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const recent =
                r.lastActive !== null && now - r.lastActive <= WEEK_MS;
              return (
                <tr
                  key={r.id}
                  className="border-b border-line last:border-0 transition-colors duration-200 hover:bg-bg"
                >
                  <td className="px-3 py-2.5 text-left">
                    <Link
                      href={`/admin/usuarios/${r.id}`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      <span className="truncate">{r.email}</span>
                      {r.isAdmin ? (
                        <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] text-ink">
                          admin
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                    <span className={recent ? "text-success" : "text-muted"}>
                      {hace(r.lastActive, now)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.onboardingDone ? (
                      <span className="text-success">✓</span>
                    ) : (
                      <span className="text-muted">{r.onboardingStep}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Bool on={r.color} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Num n={r.closet} suffix={r.closetPhotos > 0 ? " 📷" : undefined} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Num n={r.looks} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Bool on={r.avatar} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Bool on={r.capsula} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Num n={r.viaje} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Num n={r.cartera} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.worn > 0 ? (
                      <span className="text-success">✓ {r.worn}</span>
                    ) : (
                      <span className="text-muted/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-6 text-center text-muted">
                  {rows.length === 0
                    ? "Sin usuarios todavía."
                    : "Ningún usuario cumple el filtro."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
