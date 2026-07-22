// Rango de edad: se pregunta justo tras el género (antesala del onboarding). Da
// contexto de life-stage al motor (señal SUAVE, nunca override de gustos) y
// habilita el aviso de menores de edad (permiso de padres/tutores).
// Rango, no fecha de nacimiento: menos sensible y suficiente para el styling.
export type AgeRange = "13-17" | "18-24" | "25-34" | "35-44" | "45-54" | "55+";

type AgeOpt = { id: AgeRange; label: string };

export const AGE_RANGES: AgeOpt[] = [
  { id: "13-17", label: "13 a 17" },
  { id: "18-24", label: "18 a 24" },
  { id: "25-34", label: "25 a 34" },
  { id: "35-44", label: "35 a 44" },
  { id: "45-54", label: "45 a 54" },
  { id: "55+", label: "55 o más" },
];

export const isAgeRange = (v: unknown): v is AgeRange =>
  AGE_RANGES.some((r) => r.id === v);

export const ageLabel = (r: AgeRange | null): string | null =>
  AGE_RANGES.find((x) => x.id === r)?.label ?? null;

// Menor de edad → dispara el flujo de consentimiento de padres/tutores.
export const isMinor = (r: AgeRange | null): boolean => r === "13-17";

// Un menor sin permiso parental confirmado NO puede subir fotos (cara, cuerpo,
// prendas, referencia) — es el dato sensible de verdad. El resto de la app
// funciona (imágenes de arquetipo del catálogo).
export function fotosBloqueadas(p: {
  age_range: AgeRange | null;
  minor_consent_verified_at: string | null;
}): boolean {
  return isMinor(p.age_range) && !p.minor_consent_verified_at;
}

// Línea de styling para el motor (Hoy + wow). Solo los extremos aportan señal
// real: en adolescentes evita envejecerlas; en 55+ prioriza elegancia cómoda.
// Los rangos intermedios (18-54) NO agregan línea — la edad ahí no dice nada
// útil sobre gustos o silueta y solo sería ruido. Siempre señal SUAVE.
export function ageStylingLine(r: AgeRange | null): string | null {
  if (r === "13-17") {
    // Redacción neutra en género: esta línea entra a prompts de hombre y mujer.
    return "Es adolescente (13-17): mantén la vibra fresca y apropiada a su edad — evita looks que envejezcan o se sientan 'de oficina'. Señal SUAVE: nunca por encima de sus gustos ni de su estilo declarado.";
  }
  if (r === "55+") {
    return "Tiene 55 o más: prioriza elegancia cómoda y atemporal, cortes que favorezcan sin disfraz de tendencia. Señal SUAVE, no override de sus gustos.";
  }
  return null;
}
