"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { registrarTiendaClick, registrarVitrinaVista, type DesdeVitrina } from "@/lib/vitrina-actions";
import { markTripFaltaOwned } from "@/lib/trip-actions";
import { fechaCorta, numeroDeProducto, pesosAprox, type PrendaVitrina, type TasasMxn } from "@/lib/vitrina-uniqlo";

// LA FRANJA DE PRENDAS REALES bajo una pieza que te falta (2026-10-20).
// Hasta dos prendas de Uniqlo del país de destino, en tu color, con precio y
// enlace a la ficha. Es la prueba de docs/designs/vitrina-de-tienda.md: si con
// la prenda real enfrente alguien compra.
//
// 2026-10-21, lo que la vuelve útil en el viaje y medible:
//   · "la compré": esa prenda entra a tu clóset con su foto y la pieza queda
//     cubierta (markTripFaltaOwned con la compra; evento tienda_compra).
//   · "en tienda: No. 488243 · color 14": lo que trae la etiqueta, para
//     enseñárselo al personal en Japón o Corea, donde sí hay tienda.
//   · el precio en pesos (≈, tipo de cambio del día), para quien piensa en pesos.
//
// La foto va por next/image (D2): el host image.uniqlo.com está en
// next.config.ts y `fotoSegura` ya filtró cualquier otro antes de llegar aquí.
export function VitrinaFranja({
  prendas,
  clave,
  desde,
  tripId,
  index,
  tasas,
}: {
  prendas: PrendaVitrina[];
  clave: string;
  desde: DesdeVitrina;
  /** Para "la compré": a qué viaje y a qué pieza cubre. Sin ellos no se ofrece. */
  tripId?: string;
  index?: number;
  /** Pesos por unidad de moneda (null = no enseñar pesos). */
  tasas?: TasasMxn | null;
}) {
  const router = useRouter();
  const registrada = useRef(false);
  const [comprando, setComprando] = useState<string | null>(null);
  const [comprada, setComprada] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (registrada.current || prendas.length === 0) return;
    registrada.current = true;
    // En modo "ver como" el servidor contesta 403 a cualquier POST (es de sólo
    // lectura): la medición se pierde a propósito y no puede ensuciar la consola.
    registrarVitrinaVista(clave, prendas.map((p) => p.id), prendas[0].tienda, desde).catch(() => {});
  }, [prendas, clave, desde]);

  if (prendas.length === 0) return null;
  const tienda = prendas[0].tienda;
  const visto = fechaCorta(prendas[0].vistoEl);
  const puedeComprar = typeof tripId === "string" && typeof index === "number";

  async function laCompre(p: PrendaVitrina) {
    if (!puedeComprar || comprando || comprada) return;
    setComprando(p.id);
    setError(false);
    try {
      const r = await markTripFaltaOwned(tripId!, index!, null, {
        entrada: p.id,
        tienda: p.tienda,
        producto: p.nombre,
        url: p.url,
        foto: p.foto,
        precio: p.precio,
        moneda: p.moneda,
      });
      if (r.ok) {
        setComprada(p.id);
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setComprando(null);
    }
  }

  return (
    <div className="border-t border-line2 px-[13px] pb-3 pt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
          la hay en {tienda}
        </span>
        {visto ? <span className="shrink-0 text-[10px] text-faint">visto el {visto}</span> : null}
      </div>
      <ul className="mt-2 flex flex-col gap-3">
        {prendas.map((p) => {
          const pesos = pesosAprox(p.moneda, p.precio, tasas);
          const esta = comprada === p.id;
          return (
            <li key={p.id} className="flex items-center gap-3">
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrarTiendaClick(clave, p.id, p.tienda, desde).catch(() => {})}
                className="relative block aspect-[4/5] w-[44px] shrink-0 overflow-hidden bg-tile"
                aria-label={`ver ${p.nombre} en ${p.tienda}`}
              >
                <Image src={p.foto} alt={p.nombre} fill sizes="44px" className="object-cover" />
              </a>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-bold text-ink">{p.nombre}</span>
                <span className="tabular text-[12px] text-muted">
                  {p.precioTexto}
                  {pesos ? ` · ${pesos}` : ""} · {p.color.toLowerCase()}
                </span>
                <span className="tabular text-[11px] text-faint">
                  en tienda: No. {numeroDeProducto(p.productId)} · color {p.colorCode}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => registrarTiendaClick(clave, p.id, p.tienda, desde).catch(() => {})}
                  className="text-[12px] font-bold text-ink underline underline-offset-2"
                >
                  verla
                </a>
                {puedeComprar ? (
                  esta ? (
                    <span className="text-[12px] font-bold text-ink">en tu clóset</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void laCompre(p)}
                      disabled={!!comprando || !!comprada}
                      className="text-[12px] text-muted underline underline-offset-2 disabled:opacity-50"
                    >
                      {comprando === p.id ? "guardando…" : "la compré"}
                    </button>
                  )
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-2 text-[11px] text-error">No pude guardarla. Inténtalo otra vez en un momento.</p>
      ) : null}
    </div>
  );
}
