// LA MÁQUINA DE PASOS del wizard de "crear outfit", como función pura.
//
// POR QUÉ VIVE FUERA DEL COMPONENTE
// Estaba inline en weather-picker.tsx y ahí escondió un hueco durante meses:
// el wow (el PRIMER look, el del onboarding) se saltaba el paso del detalle
// junto con el del plan, así que quien elegía "trabajo" recibía su primer look
// sin que nadie le preguntara su código de vestimenta — el motor adivinaba si
// su oficina es de traje o de tenis, y ese look es el que decide si la persona
// se queda. El backend siempre estuvo listo (/api/generate persiste
// work_dress_code); lo que faltaba era la pregunta.
//
// Como función pura se puede probar caso por caso, que es la única forma de que
// un hueco así no vuelva a esconderse en una condición booleana.

export type PasoWizard = "plan" | "detalle" | "cuando" | "clima";

export function pasosDelWizard({
  saltaElPlan,
  objective,
  tipoEvento,
  planLibre,
  codigoGuardado,
  codigoEfectivo,
}: {
  /** El wow: la ocasión ya se eligió en el onboarding, no se re-pregunta. */
  saltaElPlan: boolean;
  objective: string | null;
  /** Qué evento es (boda, cena…). Sin él, "evento" no tiene qué acotar. */
  tipoEvento: string | null;
  /** Escribió su plan con sus palabras → no hay nada que acotar por catálogo. */
  planLibre: boolean;
  /**
   * El código de vestimenta GUARDADO en el perfil. null = nunca se le ha
   * preguntado. Es distinto del efectivo a propósito: si usara el efectivo, el
   * paso desaparecería bajo los pies de la persona en cuanto tocara una opción.
   */
  codigoGuardado: string | null;
  /** El guardado, o el que acaba de elegir en este mismo paso. */
  codigoEfectivo: string | null;
}): PasoWizard[] {
  const acotaElEvento = objective === "evento" && !!tipoEvento;
  const acotaElTrabajo =
    objective === "oficina" && (!codigoGuardado || codigoEfectivo === "variable");
  const necesitaDetalle = !planLibre && (acotaElEvento || acotaElTrabajo);

  return [
    ...(saltaElPlan ? [] : (["plan"] as PasoWizard[])),
    ...(necesitaDetalle ? (["detalle"] as PasoWizard[]) : []),
    "cuando",
    "clima",
  ];
}
