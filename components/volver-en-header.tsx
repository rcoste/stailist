"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";

// El id del hueco izquierdo del header móvil (lo pinta AppShell).
export const HEADER_IZQ_ID = "shell-header-izq";

// UN "ATRÁS" QUE DECIDE EL CLIENTE, en el mismo sitio y con la misma cara que
// el `back` del AppShell (chevron + a dónde vuelves).
//
// Por qué existe además de `back`: el AppShell es del server y sólo sabe la
// ruta. En /hoy la ruta no cambia entre la home y el look — es un estado del
// cliente —, así que el header no puede saber que estás dentro de un look. La
// pantalla lo monta en el hueco por portal mientras está viva y al desmontarse
// el hueco vuelve a quedar vacío.
//
// Es botón y no Link: volver a la home de /hoy es cambiar de estado, no
// navegar (navegar re-pediría la página entera al server).
export function VolverEnHeader({ label, onClick }: { label: string; onClick: () => void }) {
  const [hueco, setHueco] = useState<HTMLElement | null>(null);
  useEffect(() => setHueco(document.getElementById(HEADER_IZQ_ID)), []);
  if (!hueco) return null;
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-200 hover:text-ink"
    >
      <Icon name="chevron" size={15} rotate={180} />
      {label}
    </button>,
    hueco
  );
}
