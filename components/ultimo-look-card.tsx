"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { fmtFechaLocal, ocasionLabel } from "@/components/weather-picker";
import type { UltimoLook } from "@/lib/ultimo-look";

// La card del último look (zona 1 del home, bajo el CTA — handoff
// design_handoff_inicio). Con el hero fijo en "¿qué look armamos?", esta card
// es el ÚNICO acceso del home a lo último generado; tocarla ABRE el look, jamás
// genera (volver a ver lo que ya existe no puede costar dinero).
//
// Dos variantes que decide el dato: con try-on, el retrato del avatar vistiendo
// el look; sin él, la tira de las prendas. Sin ninguna imagen, solo el texto.
export function UltimoLookCard({
  look,
  onVer,
  cargando = false,
}: {
  look: UltimoLook;
  /** Abre el look (vista ready). El fetch y el estado viven en hoy-client. */
  onVer: () => void;
  /** Abriendo (fetch en vuelo): el CTA lo dice y el botón se bloquea — sin
   *  esto la card quedaba muerta durante el request y provocaba el doble tap. */
  cargando?: boolean;
}) {
  // "hoy" / "ayer" / "vie 14" se calculan DESPUÉS de montar, no en el render.
  // Son relativos a la fecha del dispositivo y este componente también se pinta
  // en el server, que corre en UTC: a las 19:00 de CDMX allá ya es mañana, así
  // que el server escribía "creado ayer" sobre el look que el teléfono llama
  // "creado hoy" — desajuste de hidratación y un parpadeo del texto cada noche.
  // Mismo remedio que usa el eyebrow de fecha en hoy-client.
  const [fechas, setFechas] = useState<{ creado: string; sub: string } | null>(null);
  useEffect(() => {
    setFechas({ creado: relativoCreado(look.creadoEn), sub: subtitulo(look) });
  }, [look]);

  const texto = (
    <>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-faint">
        último look{fechas ? ` · creado ${fechas.creado}` : ""}
      </span>
      <span className="mt-0.5 block">
        <em className="font-display text-[21px] font-normal italic leading-tight tracking-normal text-ink">
          {look.nombre}
        </em>
      </span>
      <span className="mt-0.5 text-[12.5px] text-muted">
        {fechas ? (
          <>
            {fechas.sub} &nbsp;·&nbsp;{" "}
          </>
        ) : null}
        {/* shimmer-txt mientras abre: el cambio de dos palabras chicas al pie
            de una card de 150px casi no se ve, y el punto era que se NOTARA. */}
        <b className={cargando ? "shimmer-txt font-bold" : "font-bold text-ink"}>
          {cargando ? "abriendo…" : "ver el look →"}
        </b>
      </span>
    </>
  );

  // ── Con avatar: retrato a la izquierda ────────────────────────────────────
  if (look.retrato) {
    return (
      <button
        type="button"
        onClick={onVer}
        disabled={cargando}
        aria-busy={cargando}
        className="flex min-h-[150px] w-full overflow-hidden rounded-lg border border-line bg-surface text-left transition-colors hover:border-ink"
      >
        <span className="relative w-[120px] shrink-0 bg-tile">
          <Image
            src={look.retrato}
            alt=""
            fill
            sizes="120px"
            className="object-cover"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
          {texto}
        </span>
      </button>
    );
  }

  // ── Sin avatar: la tira de las prendas arriba ─────────────────────────────
  return (
    <button
      type="button"
      onClick={onVer}
      disabled={cargando}
      aria-busy={cargando}
      className="flex w-full flex-col overflow-hidden rounded-lg border border-line bg-surface text-left transition-colors hover:border-ink"
    >
      {look.prendas.length > 0 ? (
        <span
          className="grid w-full gap-px border-b border-line2 bg-line2"
          style={{ gridTemplateColumns: `repeat(${look.prendas.length}, 1fr)` }}
        >
          {look.prendas.map((src, i) => (
            // LA ALTURA DEPENDE DE CUÁNTAS SON. Los 70px vienen del handoff,
            // pero su mock tenía CINCO prendas — celdas de ~68×70, casi
            // cuadradas, y los flat-lays (cuadrados) entraban enteros. Con las
            // 3 de un look real la celda quedaba 113×70 y el object-cover
            // decapitaba la prenda ("se ven cortadas, rectangulares hacia los
            // lados" — Roberto, seguro de que el diseño no era así; tenía
            // razón: el diseño nunca se probó con 3). Con 96px para tiras de
            // ≤3 el recorte baja de ~40% a ~15% y la tira sigue full-bleed.
            <span
              key={i}
              className={`relative bg-tile ${look.prendas.length <= 3 ? "h-24" : "h-[70px]"}`}
            >
              <Image src={src} alt="" fill sizes="128px" className="object-cover" />
            </span>
          ))}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col px-4 pb-3 pt-2.5">{texto}</span>
    </button>
  );
}

// "hoy" / "ayer" / "el vie 8" — cuándo se creó, con la fecha LOCAL del
// dispositivo (creadoEn llega en UTC; el server no sabe qué día es aquí).
function relativoCreado(iso: string): string {
  const d = new Date(iso);
  const key = fmtFechaLocal(d);
  const hoy = new Date();
  if (key === fmtFechaLocal(hoy)) return "hoy";
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  if (key === fmtFechaLocal(ayer)) return "ayer";
  const dia = d.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "");
  return `el ${dia} ${d.getDate()}`;
}

// "trabajo · vie 14" — la ocasión y, si el look es de un día concreto, el día.
function subtitulo(look: UltimoLook): string {
  const ocasion = ocasionLabel(look.ocasion);
  if (!look.fecha) return ocasion;
  const [y, m, d] = look.fecha.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  const hoy = new Date();
  let dia: string;
  if (look.fecha === fmtFechaLocal(hoy)) dia = "hoy";
  else {
    const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    dia =
      look.fecha === fmtFechaLocal(manana)
        ? "mañana"
        : `${fecha.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "")} ${fecha.getDate()}`;
  }
  return `${ocasion} · ${dia}`;
}
