"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, Panel, Quien, Sub, Tabla, Td, Th } from "../_ui";

// Una sola definición de a dónde va una fila (la usan el onClick y el href).
const hrefUsuario = (id: string) => `/admin/usuarios/${id}`;

export type UserRow = {
  id: string;
  email: string;
  /** ISO del país (desde 2026-10-06); null en las cuentas anteriores. */
  pais: string | null;
  /** La campaña si llegó por anuncio; si no, la fuente ("directo / sin rastro", "raicode.ai"…). */
  origen: string;
  deAnuncio: boolean;
  /** Otro día dentro de su primera semana (criterio del plan); "semana" = aún puede; null = sin arranque. */
  volvio: "si" | "no" | "semana" | null;
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

type SortKey = "email" | "origen" | "volvio" | "lastActive" | "onboarding" | "color" | "closet";

// Valor ordenable por columna. Los booleanos van como 0/1.
function sortVal(r: UserRow, key: SortKey): number | string {
  switch (key) {
    case "email":
      return r.email.toLowerCase();
    case "origen":
      return r.origen.toLowerCase();
    case "volvio":
      return r.volvio === "si" ? 2 : r.volvio === "semana" ? 1 : r.volvio === "no" ? 0 : -1;
    case "lastActive":
      return r.lastActive ?? -1;
    case "onboarding":
      return r.onboardingStep;
    case "color":
      return r.color ? 1 : 0;
    case "closet":
      return r.closet;
  }
}

// Siete columnas: lo que se mira de cada persona. El resto (looks, avatar,
// esenciales, viaje, cartera, puesto) sigue en los filtros y en la ficha.
const COLS: { key: SortKey; label: string; title?: string; izq?: boolean }[] = [
  { key: "email", label: "Persona", izq: true },
  { key: "origen", label: "Llegó por", title: "La campaña del anuncio, o la fuente", izq: true },
  { key: "lastActive", label: "Último uso", title: "Actividad más reciente" },
  { key: "volvio", label: "Volvió", title: "Otro día dentro de su primera semana, 4 horas después de empezar" },
  { key: "onboarding", label: "1er look", title: "Llegó a su primer look (si no, el paso en que va)" },
  { key: "color", label: "Color", title: "Hizo su colorimetría" },
  { key: "closet", label: "Clóset", title: "Prendas activas (📷 = con fotos propias)" },
];

type FilterKey =
  | "volvieron"
  | "anuncios"
  | "active7d"
  | "onbDone"
  | "avatar"
  | "capsula"
  | "viaje"
  | "cartera"
  | "worn"
  | "photos";

const FILTERS: { key: FilterKey; label: string; test: (r: UserRow, now: number) => boolean }[] = [
  { key: "volvieron", label: "Volvieron", test: (r) => r.volvio === "si" },
  { key: "anuncios", label: "De anuncios", test: (r) => r.deAnuncio },
  { key: "active7d", label: "Activos 7d", test: (r, now) => r.lastActive !== null && now - r.lastActive <= WEEK_MS },
  { key: "onbDone", label: "Onboarding ✓", test: (r) => r.onboardingDone },
  { key: "avatar", label: "Con avatar", test: (r) => r.avatar },
  { key: "capsula", label: "Con esenciales", test: (r) => r.capsula },
  { key: "viaje", label: "Usó viaje", test: (r) => r.viaje > 0 },
  { key: "cartera", label: "Usó cartera", test: (r) => r.cartera > 0 },
  { key: "worn", label: "Se puso un look", test: (r) => r.worn > 0 },
  { key: "photos", label: "Fotos propias", test: (r) => r.closetPhotos > 0 },
];

export function UsuariosTable({ rows, now }: { rows: UserRow[]; now: number }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [asc, setAsc] = useState(false);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  // Fila en la que ya se picó (navegación en vuelo): se atenúa como acuse de
  // recibo — el detalle tarda en llegar (firma URLs de todo su clóset) y sin
  // señal el click se leía como "no reaccionó" (Roberto, 2026-08-13).
  const [yendo, setYendo] = useState<string | null>(null);

  // Volver con Atrás no re-monta este componente (el App Router conserva el
  // estado del segmento), así que sin esto la tabla entera se quedaba atenuada
  // e inerte al regresar — la misma regresión que el cambio venía a matar.
  useEffect(() => {
    setYendo(null);
  }, [rows]);

  // TODA la fila navega, no solo el texto del correo: picarle a cualquier
  // celda era exactamente el "le pico y no pasa nada" reportado.
  //
  // El candado es POR FILA (`=== id`) y no global: si el detalle tarda y la
  // persona se arrepiente y pica otra, esa otra tiene que responder.
  const abrir = (id: string) => {
    if (yendo === id) return;
    setYendo(id);
    router.push(hrefUsuario(id));
  };

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

  return (
    <>
      {/* Filtros combinables (AND). Son estado del cliente, no enlaces, pero
          visten igual que `Filtros` del kit. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <span className="inline-flex flex-wrap items-center gap-1">
          <span className="mr-1 text-faint">filtrar</span>
          {FILTERS.map((f) => {
            const on = filters.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFilter(f.key)}
                className={`rounded-sm px-2 py-0.5 transition-colors duration-200 ${
                  on ? "bg-ink font-medium text-on-accent" : "text-ink2 hover:bg-tile hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </span>
        {filters.size > 0 ? (
          <span className="text-muted">
            {visible.length} en el filtro ·{" "}
            <button type="button" onClick={() => setFilters(new Set())} className="hover:text-ink">
              limpiar
            </button>
          </span>
        ) : null}
      </div>

      <Panel sinPadding>
        <Tabla minW="min-w-[640px]">
          <thead>
            <tr>
              {COLS.map((c) => {
                const active = c.key === sortKey;
                return (
                  <Th key={c.key} izq={c.izq}>
                    <button
                      type="button"
                      title={c.title}
                      onClick={() => toggleSort(c.key)}
                      className={`inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-200 ${
                        active ? "text-ink" : "hover:text-ink"
                      }`}
                    >
                      {c.label}
                      {active ? <span className="text-[11px]">{asc ? "▲" : "▼"}</span> : null}
                    </button>
                  </Th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const recent = r.lastActive !== null && now - r.lastActive <= WEEK_MS;
              return (
                <tr
                  key={r.id}
                  onClick={() => abrir(r.id)}
                  className={`cursor-pointer transition-colors duration-200 hover:bg-tile ${yendo === r.id ? "opacity-50" : ""}`}
                >
                  <Td izq>
                    {/* El Link (dentro de Quien) se queda por accesibilidad y
                        abrir-en-pestaña; navega a lo mismo que la fila. */}
                    <span className="flex min-w-0 max-w-[220px] items-center gap-2 sm:max-w-none" onClick={(e) => e.stopPropagation()}>
                      <Quien correo={r.email} pais={r.pais} href={hrefUsuario(r.id)} />
                      {r.isAdmin ? <Chip tono="ink">admin</Chip> : null}
                    </span>
                  </Td>
                  <Td izq className="max-w-40 truncate text-[13px] text-muted">
                    <span title={r.origen}>{r.origen}</span>
                  </Td>
                  <Td className={`whitespace-nowrap ${recent ? "text-success" : "text-muted"}`}>{hace(r.lastActive, now)}</Td>
                  <Td className="whitespace-nowrap">
                    {r.volvio === "si" ? (
                      <Chip tono="success">volvió</Chip>
                    ) : r.volvio === "semana" ? (
                      <span className="text-xs text-muted">en su semana</span>
                    ) : r.volvio === "no" ? (
                      <span className="text-muted">no</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    {r.onboardingDone ? (
                      <span className="text-success">✓</span>
                    ) : (
                      <>
                        <span className="text-muted">no</span>
                        <Sub>paso {r.onboardingStep}</Sub>
                      </>
                    )}
                  </Td>
                  <Td>{r.color ? <span className="text-success">✓</span> : <span className="text-faint">—</span>}</Td>
                  <Td>
                    {r.closet === 0 ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <>
                        {r.closet}
                        {r.closetPhotos > 0 ? <span className="text-muted"> 📷</span> : null}
                      </>
                    )}
                  </Td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-5 py-6 text-center text-sm text-muted">
                  {rows.length === 0 ? "Sin usuarios todavía." : "Ningún usuario cumple el filtro."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </Tabla>
      </Panel>
    </>
  );
}
