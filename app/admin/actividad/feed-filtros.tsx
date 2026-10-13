"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { EVENTO_LABEL } from "@/lib/admin/actividad";

// Los filtros viven en el URL (?u=&t=) a propósito: así una vista concreta
// —"todo lo de Andy", "sólo los 👍"— se puede guardar y compartir, que es la
// mitad del "cruzar la información" que pidió Roberto.
const TIPO_LABEL: Record<string, string> = {
  alta: "altas",
  prenda_add: "prendas añadidas",
  prenda_del: "prendas borradas",
  look: "looks generados",
  look_del: "looks borrados",
  viaje: "viajes",
  viaje_del: "viajes borrados",
  cartera: "cartera",
};

// El mismo tamaño y estilo que `Control` del kit (app/admin/_ui): h-9, borde
// de línea, esquina chica. Es un select y no un enlace porque la lista de
// personas no cabe en chips.
const SEL = "h-9 max-w-full rounded-sm border border-line bg-surface px-3 text-sm font-medium text-ink2 hover:border-ink hover:text-ink";

export function FeedFiltros({
  gente,
  tipos,
  usuario,
  tipo,
}: {
  gente: { id: string; label: string }[];
  tipos: string[];
  usuario: string;
  tipo: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (clave: "u" | "t", valor: string) => {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    router.replace(p.size ? `/admin/actividad?${p}` : "/admin/actividad");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={SEL} value={usuario} onChange={(e) => set("u", e.target.value)}>
        <option value="">todas las personas</option>
        {gente.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
      <select className={SEL} value={tipo} onChange={(e) => set("t", e.target.value)}>
        <option value="">todo lo que hacen</option>
        {tipos.map((t) => (
          <option key={t} value={t}>
            {TIPO_LABEL[t] ?? EVENTO_LABEL[t] ?? t}
          </option>
        ))}
      </select>
      {usuario || tipo ? (
        <button
          type="button"
          onClick={() => router.replace("/admin/actividad")}
          className="text-[13px] text-muted hover:text-ink"
        >
          limpiar
        </button>
      ) : null}
    </div>
  );
}
