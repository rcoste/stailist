"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";

// LA PANTALLA ANTES DEL CHECKLIST (2026-09-16).
//
// Nació del assessment de Aesty. La explicación ya existía —como subtítulo gris
// sobre el checklist— y Roberto lo cazó: "la gente no va a leer el texto donde
// lo tienes, se enfoca en el título y las imágenes". Además no nombraba la
// mejor carta del producto (una foto = varias prendas) y el checklist se leía
// como "¿solo esto?, qué chafa".
//
// NO ES UN STEP de ONBOARDING_ROUTES, por la misma razón que acentos: meterlo
// correría la numeración y quien esté a media alta aterrizaría en otra
// pantalla. Vive dentro de /onboarding/closet como estado local: recargar la
// vuelve a mostrar, que cuesta un toque y no rompe nada.
//
// Las imágenes son las de la landing: la foto real de Roberto/de la modelo y
// las prendas que el pipeline del carrete sacó de ELLA. No se inventó un
// ejemplo: es la función haciendo su trabajo.
export function IntroCloset({
  gender,
  children,
}: {
  gender: "hombre" | "mujer";
  children: ReactNode;
}) {
  const [visto, setVisto] = useState(false);
  if (visto) return <>{children}</>;

  const g = gender === "hombre" ? "h" : "m";
  const prendas =
    gender === "hombre"
      ? ["1-abrigo", "2-top", "3-bottom", "4-calzado"]
      : ["1-top", "2-bottom", "3-accesorio", "4-calzado"];

  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
        tu clóset,{" "}
        <em className="font-display font-normal italic tracking-normal">sin pasar horas</em>
      </h1>

      {/* Una foto → sus prendas. Es la idea entera en una imagen. */}
      <div className="flex items-stretch gap-3" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/landing/ig-${g}-foto.webp`}
          alt=""
          className="w-[42%] rounded-2xl object-cover"
        />
        <div className="grid flex-1 grid-cols-2 gap-2">
          {prendas.map((p) => (
            <div key={p} className="overflow-hidden rounded-xl bg-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/landing/ig-${g}-${p}.webp`} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-3 text-[15px] leading-snug text-ink">
        <li>
          <b>Ahorita:</b> marca los básicos que ya tienes, un toque cada uno.
        </li>
        <li>
          <b>Con eso</b> te armo tu primer look.
        </li>
        <li>
          <b>Después:</b> subes fotos de tu ropa de verdad, y de cada foto salen varias prendas.
        </li>
      </ul>

      <button
        type="button"
        onClick={() => setVisto(true)}
        className="mt-auto flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        empezar <Icon name="flecha" size={17} />
      </button>
    </div>
  );
}
