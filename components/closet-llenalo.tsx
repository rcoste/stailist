"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { AddOptions } from "@/components/add-options";
import { AddPhotoFlow, type AddFlowHandle } from "@/components/add-photo-flow";
import { ImportCarreteFlow } from "@/components/import-carrete-flow";

// Las tres formas de sumar ropa, DESPLEGADAS en el clóset — no escondidas en una
// hoja detrás de un botón que dice "agregar".
//
// El razonamiento (Roberto, 2026-07-29, a partir de lo que le contaron quienes
// operan apps parecidas): el dolor número uno de estas apps es cargar prendas, y
// las dos salidas que lo esquivan —subir fotos en bulto y marcar prendas del
// catálogo— existían pero vivían tras la palabra "agregar", que suena
// exactamente al trabajo de una prenda a la vez que la gente teme.
//
// Es contenido, no un tour: se lee o se ignora bajando la pantalla. Y no es de
// una sola vez —vive mientras el clóset no tenga NI UNA foto propia, y se
// autodestruye con la primera—, misma lógica que el checklist de Hoy: existe
// mientras el hueco existe.
//
// Monta sus propios flujos headless. Ya hay otros dos juegos en /closet (la hoja
// de "agregar" y el drawer de la tab bar), así que no es un patrón nuevo: son
// un input oculto y su estado, sin listeners globales.
export function ClosetLlenalo({
  userId,
  oculto = false,
}: {
  userId: string;
  /** Con fotos propias el bloque no se pinta, pero el componente NO se
   *  desmonta: sus wizards pueden estar a media faena justo cuando el primer
   *  guardado voltea la condición (ver el comentario en closet/page.tsx). */
  oculto?: boolean;
}) {
  const router = useRouter();
  const photoRef = useRef<AddFlowHandle>(null);
  const carreteRef = useRef<AddFlowHandle>(null);

  return (
    <div
      className={
        oculto ? "contents" : "flex flex-col gap-2.5 rounded-lg border border-line bg-bg p-3.5"
      }
    >
      <AddPhotoFlow
        userId={userId}
        headless
        ref={photoRef}
        // Las tres puertas que montan este flujo lo cablean igual: si no, el
        // aviso de "veo más de una prenda" aparece en una y en las otras no.
        onSepararFoto={(dataUrl) => carreteRef.current?.startConFoto?.(dataUrl)}
      />
      <ImportCarreteFlow userId={userId} headless ref={carreteRef} />

      {oculto ? null : (
      <>
      <div className="flex flex-col gap-1 px-0.5">
        <p className="text-[15px] font-bold leading-tight text-ink">
          este clóset todavía no es tuyo
        </p>
        {/* Nombra la salida barata en el encabezado: quien lee solo esta línea
            se tiene que llevar que NO hay que fotografiar prenda por prenda. */}
        <p className="text-[13px] leading-snug text-muted">
          son básicos que asumimos. Súmale tu ropa real — sin fotografiar una por
          una.
        </p>
      </div>

      <div className="-mb-2.5">
        <AddOptions
          onFoto={() => photoRef.current?.start()}
          onCarrete={() => carreteRef.current?.start()}
          onBiblioteca={() => router.push("/closet/biblioteca")}
        />
      </div>
      </>
      )}
    </div>
  );
}
