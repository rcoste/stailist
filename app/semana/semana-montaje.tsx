"use client";

import dynamic from "next/dynamic";

// La semana depende de la fecha LOCAL del teléfono: renderizarla en el
// servidor (UTC) pintaría otros días y rompería la hidratación a partir de
// las 6 pm de CDMX. Se monta sólo en el cliente.
export const SemanaMontaje = dynamic(() => import("./semana-client").then((m) => m.SemanaClient), {
  ssr: false,
});
