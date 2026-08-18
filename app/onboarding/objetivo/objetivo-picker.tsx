"use client";

import { Icon } from "@/components/icon";
import { saveObjective } from "./actions";

// LA REJILLA BLOQUEADA MURIÓ (2026-08-17). Esta pantalla mostraba las 5
// ocasiones ("día a día" activa + trabajo/evento/aeropuerto/refrescar en gris
// con "· después") para que la persona supiera que existían. Roberto, probando
// el flujo desde cero, la tiró con dos razones y las dos son ciertas:
//
// 1. Referenciaba un layout que YA NO EXISTE. "Los pides desde Hoy" apuntaba al
//    home de zonas; hoy las ocasiones viven dentro del wizard de "crear un
//    look" (weather-picker), que además tiene campo abierto y otro catálogo de
//    chips. Enseñar en el onboarding una rejilla que no volverás a ver no
//    orienta — desorienta.
// 2. Opciones bloqueadas en el primer minuto confunden: "¿qué necesitas hoy?"
//    con una sola respuesta posible no es una pregunta, es un formulario
//    fingiendo. La pantalla ahora DICE lo que va a pasar (te armo el look de tu
//    día de hoy) en vez de fingir que se elige.
//
// Lo que la pantalla sigue haciendo — y por eso no se borró del flujo: fija
// `last_objective`, avanza el paso (con guard de doble submit) y deja el evento
// que mide el TTV. El valor va en el hidden input, como siempre.
export function ObjetivoPicker() {
  return (
    <form action={saveObjective} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3.5 border border-line bg-surface p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line text-ink">
            <Icon name="sol" size={18} />
          </span>
          <div className="flex min-w-0 flex-col">
            <b className="text-[16px] font-semibold leading-tight text-ink">
              para tu día de hoy
            </b>
            <span className="text-[13px] text-muted">
              con tu ropa, tus gustos y tu paleta
            </span>
          </div>
        </div>

        <p className="text-[13px] leading-snug text-muted">
          ¿Trabajo, un evento, un viaje? Me los pides después, cada vez que los
          necesites — hoy vamos por el primero.
        </p>
      </div>

      <input type="hidden" name="objective" value="diario" />
      <div className="mt-auto pt-6">
        <button
          type="submit"
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          arma mi primer look <Icon name="destello" size={18} />
        </button>
      </div>
    </form>
  );
}
