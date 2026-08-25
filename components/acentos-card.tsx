"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { ApetitoAcentos } from "@/lib/looks";
import type { Gender } from "@/lib/auth";
import { guardarApetitoAcentos } from "@/app/perfil/actions";

// EL APETITO DE ACENTOS, en el perfil. La dimensión de intake de stylist que
// faltaba: cuánta atención quieres que atraiga tu ropa — independiente de la
// colorimetría (QUÉ colores te van) y del arquetipo (qué vibe eres).
// Marco: docs/designs/acentos-y-colorimetria-por-zona.md.
//
// LA FILA ES LA UNIDAD, NO LA CELDA. Cada fila es un nivel; las dos fotos son
// ese mismo nivel en frío y en calor, porque el VEHÍCULO del acento cambia con
// el clima (bufanda contra mocasín) aunque el apetito no. Si se pudiera tocar
// una celda, la respuesta sería ambigua — ¿eligió por el acento o porque le
// gustó más el look de invierno? Es la lección de pares-corte.tsx.
//
// SIN ETIQUETAS DE NIVEL bajo las fotos, por lo mismo que allá: poner
// "discreto / medio / protagonista" convertiría "¿cuál te pondrías?" en "¿cuál
// es la respuesta correcta?". El renglón describe la escena, no el nivel.
//
// LA PREGUNTA ES "¿CUÁL TE PONDRÍAS TÚ?", no "¿cuál se ve mejor?" — la lección
// del cobalto de Roberto: aprobar un look y ponérselo son varas distintas, y
// aquí medimos la segunda.
//
// Se guarda al tocar, sin botón (patrón de RegistroPlanCard), y elegir escribe
// fuente 'elegido': la semilla derivada de los swipes no vuelve a pisarlo.

const NIVELES: { valor: ApetitoAcentos; pie: string }[] = [
  { valor: "discreto", pie: "un guiño de color y ya" },
  { valor: "medio", pie: "una pieza de color" },
  { valor: "protagonista", pie: "que el color se vea" },
];

export function AcentosCard({
  inicial,
  fuente,
  gender,
}: {
  inicial: ApetitoAcentos | null;
  /** 'swipes' = semilla derivada (se pide confirmar); 'elegido' = ya lo dijo. */
  fuente: string | null;
  gender: Gender | null;
}) {
  const [valor, setValor] = useState<ApetitoAcentos | null>(inicial);
  const [confirmado, setConfirmado] = useState(fuente === "elegido");
  const [, empezar] = useTransition();
  const [error, setError] = useState(false);

  // Sin género declarado se muestran las fotos de hombre (el mismo default que
  // el resto del catálogo unisex); nadie queda sin ver el grid.
  const g = gender === "mujer" ? "mujer" : "hombre";

  const tocar = (nivel: ApetitoAcentos) => {
    setValor(nivel);
    setConfirmado(true);
    empezar(async () => {
      const r = await guardarApetitoAcentos(nivel);
      setError(!r.ok);
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Cuánto color te late
        </span>
        <span className="text-xs text-muted">
          {confirmado
            ? "Esto le dice a tus looks cuánto color meter — y dónde."
            : "Esto lo deduje de tus swipes. Dime cuál te pondrías tú y lo dejo bien."}
        </span>
      </div>
      {error ? <p className="text-xs text-error">no se guardó — intenta de nuevo</p> : null}
      <div className="flex flex-col gap-2">
        {NIVELES.map((n) => {
          const activo = valor === n.valor;
          return (
            <button
              key={n.valor}
              type="button"
              onClick={() => tocar(n.valor)}
              aria-pressed={activo}
              className={`flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors ${
                activo ? "border-ink bg-tile" : "border-line active:bg-tile"
              }`}
            >
              {/* Las dos fotos ocupan el ancho completo y el pie va DEBAJO: con
                  el texto al costado quedaban ~85px para la frase (tres
                  renglones partidos) y las fotos encogidas, justo lo que esta
                  pantalla no puede permitirse — se juzga color en miniatura. */}
              {/* CUADRADO con object-contain, no 3:4 con cover: la foto es de
                  cuerpo entero y a lo ancho de la card cada fila medía ~190px,
                  o sea media pantalla por nivel. En cuadrado la figura entra
                  completa —importa: en calor el acento son los zapatos— y las
                  tres filas caben de un vistazo, que es como se compara. */}
              <div className="flex gap-1.5">
                {(["frio", "calor"] as const).map((clima) => (
                  <div key={clima} className="relative aspect-square flex-1 overflow-hidden rounded-lg bg-bg">
                    <Image
                      src={`/acentos/${g}-${clima}-${n.valor}.png`}
                      alt=""
                      fill
                      // Sin esto el optimizador servía la de 3840px (600 KB) para
                      // pintarla a ~140: seis fotos así son megas de más en una
                      // card de perfil.
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
    </div>
  );
}
