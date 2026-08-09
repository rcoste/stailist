"use client";

import Image from "next/image";
import { useState } from "react";
import type { Gender } from "@/lib/auth";

// Los pares de corte: dos fotos, eliges una. Se contestan dos veces.
//
// POR QUÉ CON FOTOS Y NO CON UNA PREGUNTA
// 8 de las 10 recetas destiladas delegan en "la preferencia de la persona" entre
// recto y holgado, y esa preferencia no existía en el perfil. Preguntarla con
// palabras no funciona: "¿corte standard, relajado o entallado?" asume un
// vocabulario que justo no tiene quien no sabe vestirse — y esa es la usuaria.
// Ver una foto y señalar sí lo sabe hacer cualquiera.
//
// En cada par lo ÚNICO distinto es el corte: misma persona, misma pose, misma
// pared, misma luz, mismos zapatos, mismo color de prenda (por eso las imágenes
// se generan encadenadas, ver scripts/gen-pares-corte.mjs). Si cambiara algo
// más, la respuesta no diría nada: ¿eligió por el corte o porque le gustó más
// el color?
//
// NO HAY BOTÓN DE "NO SÉ" a propósito. La pregunta es cuál te gusta más viendo
// dos fotos — siempre hay una respuesta. Cuando de verdad no hay preferencia,
// eso sale solo: las dos respuestas se contradicen y se guarda 'mixta'.

type Opcion = "recta" | "holgada";
export type Corte = Opcion | "mixta";

const PARES = [
  { par: 1, titulo: "¿cuál te late más?" },
  { par: 2, titulo: "¿y de estas dos?" },
] as const;

export function ParesDeCorte({
  gender,
  onDone,
}: {
  gender: Gender;
  /** Recibe la preferencia ya resuelta; el padre decide cuándo guardarla. */
  onDone: (corte: Corte) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [elecciones, setElecciones] = useState<Opcion[]>([]);
  // Marca la opción tocada un instante antes de avanzar: sin eso el cambio de
  // par se siente como si la app hubiera ignorado el toque.
  const [marcada, setMarcada] = useState<Opcion | null>(null);

  const actual = PARES[idx];

  function elegir(opcion: Opcion) {
    if (marcada) return; // ya va en camino: evita doble toque
    setMarcada(opcion);
    const acumulado = [...elecciones, opcion];
    setTimeout(() => {
      if (acumulado.length === PARES.length) {
        // Coinciden → esa es su preferencia. No coinciden → no tiene una fuerte,
        // y eso es un dato, no un fallo: el motor deja mandar a la silueta de la
        // receta en vez de actuar sobre una moneda al aire.
        const todasIguales = acumulado.every((o) => o === acumulado[0]);
        onDone(todasIguales ? acumulado[0] : "mixta");
        return;
      }
      setElecciones(acumulado);
      setMarcada(null);
      setIdx((i) => i + 1);
    }, 220);
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* CON SU PROPIA IDENTIDAD, no como cola del swipe.
          Roberto, probando desde cero: "esto que obvio es importante… debería
          ser su propia sección dentro del onboarding, al igual que la
          colorimetría". Tiene razón por una razón concreta: `fit_pref` entra
          DIRECTO al contexto del motor (contexto.ts) igual que la colorimetría
          — es una entrada de primera clase, no un extra del paso de gustos.
          Se le da cabecera propia y el porqué; lo que no se hace es partirlo a
          otra pantalla, porque son dos taps y una navegación entera para cuatro
          segundos sería cobrar más de lo que cuesta. */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          cómo te queda · {idx + 1} de {PARES.length}
        </p>
        <h2 className="text-[28px] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
          {actual.titulo}
        </h2>
        {/* EL PORQUÉ, que faltaba. "Es la misma ropa, cambia cómo queda"
            describe la pantalla pero no dice para qué sirve contestarla, y sin
            eso parece un test de personalidad en medio del registro. */}
        <p className="text-[15px] leading-snug text-muted">
          Es la misma ropa — cambia cómo queda. Con esto sé si buscarte cortes
          ajustados o sueltos en cada look que te arme.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["recta", "holgada"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => elegir(opcion)}
            aria-label={opcion === "recta" ? "La de la izquierda" : "La de la derecha"}
            className={`relative aspect-[3/4] overflow-hidden rounded-lg border transition-all duration-200 ${
              marcada === opcion
                ? "border-accent ring-2 ring-accent"
                : "border-line hover:border-ink"
            } ${marcada && marcada !== opcion ? "opacity-40" : ""}`}
          >
            <Image
              src={`/corte/${gender}-${actual.par}-${opcion}.png`}
              alt=""
              fill
              sizes="(min-width: 640px) 240px, 45vw"
              className="object-cover"
              // Las cuatro imágenes del par siguiente ya están pedidas por el
              // navegador cuando se llega a él: entre par y par no debe haber
              // espera, o se siente un paso más y no la cola del swipe.
              priority={idx === 0}
            />
          </button>
        ))}
      </div>

      {/* El segundo par se precarga en silencio mientras se contesta el primero. */}
      {idx === 0 ? (
        <div className="hidden">
          {(["recta", "holgada"] as const).map((o) => (
            <Image
              key={o}
              src={`/corte/${gender}-2-${o}.png`}
              alt=""
              width={8}
              height={8}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
