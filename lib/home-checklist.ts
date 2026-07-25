// Checklist de activación — lógica de dominio PURA (sin DB ni IA).
//
// La superficie ÚNICA de "qué sigue" tras el primer outfit. Reemplaza los nudges
// de uno en uno (motor de journey): en vez de empujar una acción a la vez, muestra
// TODAS las de inversión con su estado, en orden fijo, y se AUTODESTRUYE cuando
// están todas hechas — la comezón de completar (Zeigarnik) trabaja a favor.
//
// Orden = valor/escalón: avatar primero (desbloquea el try-on, el momento mágico)
// → prendas (tu ropa real) → estilo (afinar hacia una referencia) → silueta
// (afinar a tu cuerpo, solo aplica a hombre/mujer) → cápsula al final (una cápsula
// de básicos de arquetipo no dice nada; cobra sentido cuando ya metiste prendas).

export type ChecklistStepId =
  | "avatar"
  | "prendas"
  | "estilo"
  | "silueta"
  | "capsula";

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
  hasAvatar: boolean; // ya subió foto para el try-on
  editedCloset: boolean; // metió una foto propia o borró un básico
  hasStyleReference: boolean; // guardó un estilo de referencia (fotos o preset)
  hasCapsule: boolean; // capsule_target no nulo
  siluetaApplies: boolean; // género hombre/mujer (la silueta tiene contenido propio)
  hasSilueta: boolean; // ya marcó complexión o dónde carga volumen
};

// El checklist a mostrar, o null cuando ya no hay nada que hacer (todo completo).
export function buildHomeChecklist(s: ChecklistSignals): HomeChecklist | null {
  const steps: ChecklistStep[] = [
    {
      id: "avatar",
      label: "créate tu avatar",
      hint: "te pruebo los looks encima",
      href: "/perfil/avatar",
      done: s.hasAvatar,
    },
    {
      id: "prendas",
      label: "añade tus prendas",
      hint: "súmale tu ropa real",
      href: "/closet",
      done: s.editedCloset,
    },
    {
      id: "estilo",
      label: "afina tu estilo",
      hint: "sube un look que ames",
      href: "/perfil/referencia",
      done: s.hasStyleReference,
    },
    // Silueta solo para géneros con contenido propio (hombre/mujer).
    ...(s.siluetaApplies
      ? [
          {
            id: "silueta" as const,
            label: "cuéntame de tu cuerpo",
            hint: "afino los looks a tu medida",
            href: "/perfil/silueta",
            done: s.hasSilueta,
          },
        ]
      : []),
    {
      id: "capsula",
      label: "arma tu cápsula",
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
