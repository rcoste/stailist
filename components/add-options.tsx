"use client";

import { Icon, type IconName } from "@/components/icon";

// Las TRES formas de sumar ropa, en un solo lugar.
//
// Estaban duplicadas: la hoja de "agregar" (add-sheet) y el nivel 2 del drawer
// de "más" (more-sheet) listaban las mismas tres acciones con textos DISTINTOS
// —"sube varias de golpe / fotos de tu ropa o con la ropa puesta" contra
// "varias de golpe / sube varias fotos del carrete"—, así que mejorar la
// claridad costaba escribirlo dos veces y siempre quedaba una versión atrás.
// Ahora la copy vive aquí y las tres superficies la consumen.
//
// La frase de cada una carga el trabajo pesado: el nombre solo ("una prenda",
// "la biblioteca") no distingue subir una foto de marcar un básico del catálogo.
// La de la biblioteca dice lo único que de verdad importa —que llenas el clóset
// SIN tomar fotos—, porque la fricción de catalogar es el enemigo del proyecto y
// ese es el atajo que lo esquiva.
export const ADD_OPTIONS: {
  id: "foto" | "carrete" | "biblioteca";
  icon: IconName;
  title: string;
  sub: string;
}[] = [
  {
    id: "carrete",
    icon: "destello",
    title: "varias de golpe",
    sub: "vacía el clóset en la cama, tómale fotos y saco cada prenda",
  },
  {
    id: "biblioteca",
    icon: "libro",
    title: "la biblioteca",
    sub: "llena tu clóset sin tomar una sola foto",
  },
  {
    id: "foto",
    icon: "camara",
    title: "una prenda",
    sub: "una foto de algo suelto, tipo unos tenis",
  },
];

/**
 * Las tres formas como filas tocables. Sirve dentro de una hoja y desplegada en
 * la pantalla — es la misma lista, no dos componentes que hay que mantener a la par.
 *
 * El orden NO es el histórico (foto suelta primero): arriba va la carga en
 * bulto y luego la biblioteca, que son las dos que evitan la tarde de catalogar
 * una prenda a la vez. La foto suelta es la excepción, no el camino.
 */
export function AddOptions({
  onFoto,
  onCarrete,
  onBiblioteca,
}: {
  onFoto: () => void;
  onCarrete: () => void;
  onBiblioteca: () => void;
}) {
  const handler = { foto: onFoto, carrete: onCarrete, biblioteca: onBiblioteca };
  return (
    <>
      {ADD_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={handler[o.id]}
          className="mb-2.5 flex w-full items-center gap-3.5 rounded-sm border border-line bg-surface px-3.5 py-3.5 text-left transition-colors hover:border-accent"
        >
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-sm border border-line text-ink">
            <Icon name={o.icon} size={20} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-ink">{o.title}</span>
            <span className="display text-[13.5px] text-muted">{o.sub}</span>
          </span>
          <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
        </button>
      ))}
    </>
  );
}
