"use client";

import { Icon, type IconName } from "@/components/icon";

// Las DOS formas de sumar ropa, en un solo lugar.
//
// Estaban duplicadas: la hoja de "agregar" (add-sheet) y el nivel 2 del drawer
// de "más" (more-sheet) listaban las mismas acciones con textos DISTINTOS
// —"sube varias de golpe / fotos de tu ropa o con la ropa puesta" contra
// "varias de golpe / sube varias fotos del carrete"—, así que mejorar la
// claridad costaba escribirlo dos veces y siempre quedaba una versión atrás.
// Ahora la copy vive aquí y las tres superficies la consumen.
//
// ERAN TRES hasta el 2026-08-14. La tercera ("una prenda": una foto suelta) se
// borró porque era la misma función, peor hecha: no generaba el render limpio,
// dejaba la foto cruda del usuario en el clóset, y cuando la visión detectaba
// más de una prenda en la foto tenía que ofrecer un botón para pasarle la misma
// foto a la puerta de al lado. Producía 7 prendas de 1066 en toda la vida del
// producto. Dos puertas que hacen lo mismo son fricción por sí solas: obligan a
// elegir, y la fricción de catalogar es el enemigo declarado del proyecto.
//
// La frase de cada una carga el trabajo pesado: el nombre solo ("tus fotos",
// "la biblioteca") no distingue subir una foto de marcar un básico del catálogo.
// La de la biblioteca dice lo único que de verdad importa —que llenas el clóset
// SIN tomar fotos—, porque ese es el atajo que esquiva la tarde de catalogar.
export const ADD_OPTIONS: {
  id: "carrete" | "biblioteca";
  icon: IconName;
  title: string;
  sub: string;
}[] = [
  {
    id: "carrete",
    icon: "destello",
    // Ya no dice "varias de golpe" ni pide vaciar el clóset en la cama: al ser
    // la ÚNICA puerta de fotos tiene que recibir igual de bien a quien trae una
    // sola prenda. Pedir un ritual de mudanza para subir unos tenis espantaba.
    title: "tus fotos",
    sub: "tómale foto a tu ropa — una o muchas, saco cada prenda que vea",
  },
  {
    id: "biblioteca",
    icon: "libro",
    title: "la biblioteca",
    sub: "llena tu clóset sin tomar una sola foto",
  },
];

/**
 * Las dos formas como filas tocables. Sirve dentro de una hoja y desplegada en
 * la pantalla — es la misma lista, no dos componentes que hay que mantener a la par.
 */
export function AddOptions({
  onCarrete,
  onBiblioteca,
}: {
  onCarrete: () => void;
  onBiblioteca: () => void;
}) {
  const handler = { carrete: onCarrete, biblioteca: onBiblioteca };
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
