"use client";

import Image from "next/image";
import type { ApetitoAcentos } from "@/lib/looks";
import type { Gender } from "@/lib/auth";

// EL GRID DE ACENTOS, compartido por el paso del onboarding y la card del
// perfil. Vive aparte para que las dos puertas midan LO MISMO: el día que el
// grid derive entre ellas, la respuesta del onboarding y la del perfil dejan de
// ser el mismo dato (el mismo error que costó el vocabulario duplicado de las
// fichas de prenda, ver CLAUDE.md).
//
// LA FILA ES LA UNIDAD, NO LA CELDA: cada fila es un nivel y las dos fotos son
// ese nivel en frío y en calor, porque el VEHÍCULO del acento cambia con el
// clima (bufanda contra mocasín) aunque el apetito no. Si se pudiera tocar una
// celda, la respuesta sería ambigua — ¿eligió por el acento o porque le gustó
// más el look de invierno? Es la lección de pares-corte.tsx.
//
// SIN ETIQUETAS DE NIVEL bajo las fotos, por lo mismo que allá: poner
// "discreto / medio / protagonista" convertiría "¿cuál te pondrías?" en "¿cuál
// es la respuesta correcta?". El renglón describe la escena, no el nivel.

const NIVELES: { valor: ApetitoAcentos; pie: string }[] = [
  { valor: "discreto", pie: "un guiño de color y ya" },
  { valor: "medio", pie: "una pieza de color" },
  { valor: "protagonista", pie: "que el color se vea" },
];

export function AcentosGrid({
  valor,
  gender,
  onPick,
}: {
  valor: ApetitoAcentos | null;
  gender: Gender | null;
  onPick: (nivel: ApetitoAcentos) => void;
}) {
  // Sin género declarado se muestran las fotos de hombre (el mismo default que
  // el resto del catálogo unisex); nadie se queda sin ver el grid.
  const g = gender === "mujer" ? "mujer" : "hombre";

  return (
    <div className="flex flex-col gap-2">
      {NIVELES.map((n) => {
        const activo = valor === n.valor;
        return (
          <button
            key={n.valor}
            type="button"
            onClick={() => onPick(n.valor)}
            aria-pressed={activo}
            className={`flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors ${
              activo ? "border-ink bg-tile" : "border-line active:bg-tile"
            }`}
          >
            {/* 5:4 con object-contain, no 3:4 con cover: la foto es de cuerpo
                entero y a lo ancho cada fila medía ~190px — media pantalla por
                nivel. Con contain la figura entra COMPLETA (importa: en calor
                el acento son los zapatos) y el ratio ancho baja la fila a
                ~135px, que es lo que hace que las tres opciones Y el botón de
                seguir quepan sin scroll en un teléfono. Medido en el navegador
                a 375×812, no a ojo. */}
            <div className="flex gap-1.5">
              {(["frio", "calor"] as const).map((clima) => (
                <div
                  key={clima}
                  className="relative aspect-[5/4] flex-1 overflow-hidden rounded-lg bg-bg"
                >
                  <Image
                    src={`/acentos/${g}-${clima}-${n.valor}.png`}
                    alt=""
                    fill
                    // Sin esto el optimizador servía la de 3840px (600 KB) para
                    // pintarla a ~140.
                    sizes="(max-width: 640px) 46vw, 220px"
                    className="object-contain"
                  />
                </div>
              ))}
            </div>
            <span
              className={`px-0.5 text-xs leading-tight ${
                activo ? "font-medium text-ink" : "text-muted"
              }`}
            >
              {n.pie}
            </span>
          </button>
        );
      })}
    </div>
  );
}
