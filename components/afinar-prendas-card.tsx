"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Pregunta } from "@/lib/afinar-prendas";
import { confirmarCorte } from "@/app/closet/actions";
import { SiluetaCorte } from "@/components/silueta-corte";

// "AFINEMOS TRES PRENDAS" — la otra mitad de la certeza.
//
// De dónde sale: al marcar el checklist de básicos, el alta copia los atributos
// del arquetipo del catálogo. Unos "Jeans negros" que la persona sólo marcó
// llegan al motor con `corte: recto` — un dato que nadie confirmó. En el clóset
// de Roberto son 78 prendas, y 29 de ellas con un corte inventado que YA entró
// en un look.
//
// POR QUÉ TRES Y NO TODAS: el checklist existe para que catalogar no tome
// horas. Devolver 78 preguntas desharía justo eso. Se preguntan las que más se
// usan —donde el dato falso más pesa— y las demás esperan a otro día.
//
// POR QUÉ CADA PREGUNTA DICE CUÁNTO SE USA: "la has usado en 14 looks" no es
// decoración, es la respuesta a "¿y por qué me preguntas esto?". Sin ella, tres
// preguntas sueltas se sienten un formulario; con ella, se ven como lo que son.
//
// POR QUÉ LLEVA IMAGEN, Y POR QUÉ LA IMAGEN LLEVA LETRERO. Roberto, con la card
// enfrente: "si me enseñaras una foto de los jeans sería más fácil... pero no sé
// si es una foto de los jeans que yo subí o porque estaban en la biblioteca".
// Las dos mitades del comentario son bugs distintos:
//   1. Sin imagen la pregunta no se puede contestar — nadie sabe cuál de sus
//      tres pantalones oscuros es "Jeans negros", y se contesta al azar. Eso es
//      PEOR que no preguntar: el dato falso queda marcado como confirmado y el
//      motor deja de desconfiar de él.
//   2. Con imagen y sin letrero, la imagen MIENTE. Estas prendas son, por
//      definición, las que llegaron marcando el checklist: la imagen es del
//      catálogo. Si parece suya, la persona contesta mirando el dibujo en vez
//      de acordarse de su prenda — y estaría describiendo la nuestra.

export function AfinarPrendasCard({
  preguntas,
  faltan,
}: {
  preguntas: Pregunta[];
  /** Cuántas quedarían en total. Se dice para no prometer que se acaban hoy. */
  faltan: number;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [hechas, setHechas] = useState(0);
  const [cerrada, setCerrada] = useState(false);

  if (cerrada || preguntas.length === 0) return null;

  const q = preguntas[idx];

  // Se acabaron las de esta tanda.
  if (!q) {
    return (
      <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold text-ink">
          Listo — {hechas} {hechas === 1 ? "prenda afinada" : "prendas afinadas"}
        </p>
        <p className="text-[13px] text-muted">
          {faltan - hechas > 0
            ? `Quedan ${faltan - hechas} por afinar. Te las voy pidiendo de a poco.`
            : "Ya no me falta nada por preguntarte."}
        </p>
        <button
          type="button"
          onClick={() => {
            setCerrada(true);
            router.refresh();
          }}
          className="mt-1 self-start text-[13px] font-semibold text-accent"
        >
          cerrar
        </button>
      </div>
    );
  }

  const responder = async (valor: string) => {
    if (guardando) return;
    setGuardando(true);
    await confirmarCorte(q.id, valor as "entallado" | "recto" | "holgado");
    setGuardando(false);
    setHechas((h) => h + 1);
    setIdx((i) => i + 1);
  };

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-semibold text-ink">
            Afinemos {preguntas.length === 1 ? "una prenda" : `${preguntas.length} prendas`}
          </p>
          {/* De dónde salieron, dicho antes de mostrar la imagen: si la persona
              no sabe que estas prendas entraron por el checklist, la foto del
              catálogo parece suya. */}
          <p className="text-[13px] leading-snug text-muted">
            Las marcaste en la lista de básicos: sé que las tienes, pero no cómo
            te quedan. Con el corte real te armo mejores proporciones.
          </p>
        </div>
        {/* Salir siempre disponible y sin drama: esto es opcional. */}
        <button
          type="button"
          onClick={() => setCerrada(true)}
          className="shrink-0 text-[13px] text-muted"
        >
          ahora no
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-sm bg-bg p-3">
        <div className="flex items-start gap-3">
          {/* La imagen del catálogo, marcada como tal. Chica a propósito: sirve
              para reconocer la prenda, no para copiarle el corte. */}
          {q.imagen ? (
            <div className="relative h-20 w-15 shrink-0 overflow-hidden rounded-sm border border-line bg-surface">
              <Image src={q.imagen} alt="" fill sizes="60px" className="object-cover" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[15px] font-semibold text-ink">{q.nombre}</p>
              <span className="shrink-0 text-[12px] text-muted">
                {idx + 1} de {preguntas.length}
              </span>
            </div>
            {/* El porqué, en su sitio: responde "¿y por qué me preguntas esto?". */}
            <p className="text-[13px] text-muted">
              la he usado en {q.usos} {q.usos === 1 ? "look" : "looks"}
            </p>
            {/* El letrero que impide que la imagen mienta. */}
            {q.imagen ? (
              <p className="text-[12px] leading-snug text-muted">
                Imagen del catálogo, no es tu prenda — piensa en la tuya.
              </p>
            ) : null}
          </div>
        </div>
        <p className="text-[15px] font-semibold text-ink">{q.texto}</p>
        {/* En fila y con silueta: las tres se comparan de un vistazo, que es
            justo lo que la persona necesita para saber dónde cae la suya.
            Apiladas y sin dibujo, "recto" y "holgado" son dos palabras que hay
            que imaginar por separado. */}
        <div className="mt-1 grid grid-cols-3 gap-2">
          {q.opciones.map((o) => (
            <button
              key={o.valor}
              type="button"
              disabled={guardando}
              onClick={() => responder(o.valor)}
              className="flex flex-col items-center gap-1.5 rounded-sm border border-line bg-surface px-2 py-3 text-ink transition-colors hover:border-ink active:bg-tile disabled:opacity-50"
            >
              <SiluetaCorte
                corte={o.valor as "entallado" | "recto" | "holgado"}
                tipo={q.familia}
              />
              <span className="text-center text-[13px] leading-tight">{o.label}</span>
            </button>
          ))}
        </div>
        {/* Saltar UNA sin salir de la tanda: quizá esa prenda ya no la tiene, o
            no se acuerda. Obligar a contestar convertiría el goteo en un muro. */}
        <button
          type="button"
          disabled={guardando}
          onClick={() => setIdx((i) => i + 1)}
          className="self-start text-[13px] text-muted disabled:opacity-50"
        >
          saltar esta
        </button>
      </div>
    </div>
  );
}
