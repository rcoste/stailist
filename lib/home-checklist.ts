// Checklist de activación — lógica de dominio PURA (sin DB ni IA).
//
// La superficie ÚNICA de "qué sigue" tras el primer outfit. Reemplaza los nudges
// de uno en uno (motor de journey): en vez de empujar una acción a la vez, muestra
// TODAS las de inversión con su estado, en orden fijo, y se AUTODESTRUYE cuando
// están todas hechas — la comezón de completar (Zeigarnik) trabaja a favor.
//
// CHECKLIST V2 (rediseño del home 2026-08-11, taxonomía de acciones): aquí solo
// viven los ONE-TIME que no tienen otra casa — estilo → silueta → cápsula.
// Salieron DOS pasos, con razón medida:
// · avatar: 60% lo completaba en la posición #1... gastando el primer lugar en
//   la acción de MENOR recurrencia. Su empujón vive donde tiene contexto: el
//   CTA "crea tu avatar para verte" del try-on (look-detail), que ya existía.
// · prendas: es una acción RECURRENTE, no un paso de setup — ahora tiene tile
//   permanente de primer nivel en el home (zona 2). Tenerla también aquí
//   duplicaría la acción en pantalla.
//
// Los pasos que abren una pantalla-wizard llevan `?return=/hoy`: al terminar hay
// que devolver a la persona AQUÍ, a la lista de pasos que venía siguiendo. Sin
// eso el avatar te dejaba en Perfil y la cadena se rompía (feedback de Alberto,
// 2026-07-30: "después del avatar se rompió la continuidad de lo que iba a
// hacer"). No lo llevan /closet (es una pestaña de la barra: nunca pierdes el
// hilo) ni la cápsula (al guardarla te lleva a verla, que es lo que quieres).

export type ChecklistStepId = "estilo" | "silueta" | "capsula";

export type ChecklistStep = {
  id: ChecklistStepId;
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

export type HomeChecklist = {
  steps: ChecklistStep[];
  doneCount: number;
  total: number;
};

export type ChecklistSignals = {
  hasStyleReference: boolean; // guardó un estilo de referencia (fotos o preset)
  hasCapsule: boolean; // capsule_target no nulo
  siluetaApplies: boolean; // género hombre/mujer (la silueta tiene contenido propio)
  hasSilueta: boolean; // ya marcó complexión o dónde carga volumen
};

// El checklist a mostrar, o null cuando ya no hay nada que hacer (todo completo).
export function buildHomeChecklist(s: ChecklistSignals): HomeChecklist | null {
  const steps: ChecklistStep[] = [
    {
      id: "estilo",
      label: "afina tu estilo",
      hint: "sube un look que te encante",
      href: "/perfil/referencia?return=%2Fhoy",
      done: s.hasStyleReference,
    },
    // Silueta solo para géneros con contenido propio (hombre/mujer).
    ...(s.siluetaApplies
      ? [
          {
            id: "silueta" as const,
            label: "cuéntame de tu cuerpo",
            hint: "afino los looks a tu medida",
            href: "/perfil/silueta?return=%2Fhoy",
            done: s.hasSilueta,
          },
        ]
      : []),
    {
      id: "capsula",
      label: "arma tus esenciales",
      hint: "tus básicos, lo que te falta",
      href: "/closet/capsula/editar",
      done: s.hasCapsule,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  // Todo hecho → sin checklist (se autodestruye).
  if (doneCount === steps.length) return null;

  return { steps, doneCount, total: steps.length };
}
