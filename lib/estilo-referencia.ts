// Estilo de referencia → línea para el motor (pura, sin IA ni DB).
//
// Al guardar las fotos de referencia, la IA emite un summary (el vibe) y una
// evaluación honesta de fit contra la colorimetría/silueta/vetos de la persona
// (verdict: "va" | "ajustes" | "ojo" + note). Antes el motor solo veía el
// summary y la advertencia se tiraba tras mostrarse una vez en el modal — el
// caso clásico: "este estilo es muy cálido para ti, llévalo a tus tonos" y el
// motor generando igual de cálido. Este helper arma la línea COMPLETA que
// consumen el motor de Hoy, el look del día y la cápsula.

/**
 * UNA REFERENCIA POR FOTO (v3, 2026-10-17). La v2 fundía 1-3 fotos en UN
 * resumen ("el vibe"): dos estilos distintos se volvían un híbrido que no era
 * ninguno de los dos (hipótesis de Roberto; el A/B de agosto perdió justo
 * donde importa el nivel de arreglo). Ahora cada foto es un look de referencia
 * aparte, con lo que un motor puede usar de verdad: piezas, siluetas,
 * formalidad y para qué ocasiones sirve.
 */
export type ReferenciaLook = {
  /** Ruta de la foto en storage (null en una referencia precargada). */
  path?: string | null;
  /** El look en una frase: estética, siluetas, aire. */
  resumen: string;
  /** 3-5 prendas clave, en minúscula. */
  piezas?: string[];
  siluetas?: string | null;
  formalidad?: "casual" | "arreglado" | "formal" | null;
  /** Para qué sirve este look: diario, oficina, noche, evento, finde. */
  ocasiones?: string[];
  fit?: { verdict?: string; note?: string } | null;
};

export type StyleReferenceStored = {
  summary?: string;
  tags?: string[];
  fit?: { verdict?: string; note?: string };
  image_paths?: string[];
  /** v3: una por foto. Si está, manda sobre el summary. */
  referencias?: ReferenciaLook[];
} | null;

// Firma del ESTILO completo con el que se generó una cápsula: referencia +
// "sus palabras". Si cualquiera de las dos cambia, la cápsula quedó vieja y
// se ofrece regenerar (antes solo la referencia contaba — editar tus palabras
// jamás invalidaba la cápsula, en silencio). null si no hay ninguna señal.
export function styleSignature(sr: unknown, styleWords: string | null): string | null {
  const ref = styleReferenceForEngine(sr);
  const words = styleWords?.trim() || null;
  if (!ref && !words) return null;
  return `${ref ?? ""}|${words ?? ""}`;
}

/**
 * EL "AFINA TU ESTILO" ESTÁ APAGADO PARA EL RELEASE (2026-09-08).
 *
 * Roberto: "es algo que he probado muy poco, o sea, casi nada. Eventualmente
 * sí nos va a funcionar, pero ahorita no sé ni cómo afecta la parte de los
 * estilos — nos puede afectar más de lo que ayudar".
 *
 * Los números al apagarlo: 3 perfiles de 26 tenían referencia (alberto,
 * ricardomc888, tatiana) y NINGUNO estaba activo — el más reciente llevaba 10
 * días sin abrir la app y Tatiana 39. Así que apagar el efecto no le cambia
 * los looks a nadie que la esté usando.
 *
 * Y lo que NO se puede alegar: el A/B ciego que perdió (2026-08-04, "fotos de
 * inspiración") era de `elegirInspiracion` —la biblioteca curada que usa el
 * motor— no de esta función. Esta feature nunca se midió. Ése es justamente el
 * motivo de apagarla: mete una línea al prompt del generador que empuja el vibe
 * de los looks, y nadie sabe hacia dónde.
 *
 * QUÉ HACE `false`: el dato guardado se CONSERVA (no se borra ninguna foto ni
 * ningún resumen), pero deja de llegar al motor y las tres puertas de entrada
 * se esconden (checklist del home, tarjeta de Perfil, y /perfil/referencia
 * redirige). Volver a encenderlo es cambiar esta constante a `true`.
 */
// ENCENDIDA DE NUEVO EL 2026-10-17 (decisión de Roberto), con la v3 por look.
// Objeción registrada: sigue sin medirse en el instrumento pareado. Lo que la
// acota: sólo cambia los looks de quien SUBE referencias (hoy nadie activo las
// tiene), y el comparador trae la variante "sin-referencia" para medirla con
// votos ciegos antes de recomendársela a todos.
export const REFERENCIA_DE_ESTILO_ACTIVA = true;

export function styleReferenceForEngine(
  sr: unknown,
  /** Igual que en buildHomeChecklist: el default es la constante real y el
   *  parámetro deja probado el camino de vuelta. */
  activa: boolean = REFERENCIA_DE_ESTILO_ACTIVA
): string | null {
  // Apagada: el motor no la ve, aunque la persona la tenga guardada.
  if (!activa) return null;
  const ref = (sr ?? null) as StyleReferenceStored;
  const porLook = lineaDeReferencias(ref?.referencias);
  if (porLook) return porLook;
  const summary = ref?.summary?.trim();
  if (!summary) return null;
  // Los tags que la visión extrajo de las fotos (4-6 claves del estilo) se
  // guardaban pero jamás llegaban al motor — señal tirada. Van pegados al
  // summary como claves concretas.
  const tags = (ref?.tags ?? []).map((t) => t?.trim()).filter(Boolean).slice(0, 6);
  const base = tags.length ? `${summary} (claves: ${tags.join(", ")})` : summary;
  const note = ref?.fit?.note?.trim();
  const verdict = ref?.fit?.verdict;
  // Solo cuando la evaluación pide adaptar ("ajustes"/"ojo"): con "va" la nota
  // es un elogio y no cambia cómo generar.
  if (note && (verdict === "ajustes" || verdict === "ojo")) {
    return `${base} (OJO — evaluación honesta de ese estilo para esta persona, adáptalo así: ${note})`;
  }
  return base;
}

/**
 * La línea v3: cada look es un EJEMPLO APARTE y se lo decimos al motor con
 * todas las letras, para que no los promedie. Devuelve null si no hay ninguna
 * referencia con resumen (entonces manda el summary viejo, si lo hay).
 */
export function lineaDeReferencias(refs: ReferenciaLook[] | undefined | null): string | null {
  const validas = (refs ?? []).filter((r) => r && typeof r.resumen === "string" && r.resumen.trim());
  if (validas.length === 0) return null;
  const partes = validas.slice(0, 3).map((r, i) => {
    const d: string[] = [r.resumen.trim()];
    const piezas = (r.piezas ?? []).map((p) => p?.trim()).filter(Boolean).slice(0, 5);
    if (piezas.length) d.push(`piezas: ${piezas.join(", ")}`);
    if (r.siluetas?.trim()) d.push(`siluetas: ${r.siluetas.trim()}`);
    if (r.formalidad) d.push(`nivel: ${r.formalidad}`);
    const oc = (r.ocasiones ?? []).map((o) => o?.trim()).filter(Boolean).slice(0, 4);
    if (oc.length) d.push(`sirve para: ${oc.join(", ")}`);
    const note = r.fit?.note?.trim();
    if (note && (r.fit?.verdict === "ajustes" || r.fit?.verdict === "ojo")) d.push(`OJO, adáptalo así: ${note}`);
    return `${i + 1}) ${d.join("; ")}`;
  });
  const n = partes.length;
  return `${n === 1 ? "un look que le encanta" : `${n} looks que le encantan`}, cada uno es un EJEMPLO APARTE (no los mezcles en un híbrido): ${partes.join(" · ")}. Para cada outfit acércate a UNA sola referencia, la más afín a la ocasión y al nivel de arreglo que pide; si ninguna cuadra con la ocasión, no la fuerces.`;
}

/** Lo que devolvió la visión, una por foto EN ORDEN, ya con su ruta y limpio. */
export function armarReferencias(crudas: unknown[], paths: string[]): ReferenciaLook[] {
  const FORM = new Set(["casual", "arreglado", "formal"]);
  const OCAS = new Set(["diario", "oficina", "noche", "evento", "finde"]);
  const lista = (x: unknown, tope: number, filtro?: (v: string) => boolean) =>
    (Array.isArray(x) ? x : []).map((v) => String(v ?? "").toLowerCase().trim()).filter((v) => v && (!filtro || filtro(v))).slice(0, tope);
  return crudas.slice(0, paths.length).flatMap((c, i) => {
    const r = (c ?? {}) as Record<string, unknown>;
    const resumen = String(r.resumen ?? "").trim();
    if (!resumen) return [];
    const fit = r.fit as { verdict?: unknown; note?: unknown } | undefined;
    return [{
      path: paths[i] ?? null,
      resumen,
      piezas: lista(r.piezas, 5),
      siluetas: typeof r.siluetas === "string" && r.siluetas.trim() ? r.siluetas.trim() : null,
      formalidad: FORM.has(String(r.formalidad)) ? (String(r.formalidad) as ReferenciaLook["formalidad"]) : null,
      ocasiones: lista(r.ocasiones, 4, (v) => OCAS.has(v)),
      fit: fit && typeof fit.verdict === "string" ? { verdict: fit.verdict, note: typeof fit.note === "string" ? fit.note.trim() : "" } : null,
    }];
  });
}

/**
 * `summary` y `fit` para quien aún lee el shape viejo (presets, pantallas):
 * el summary junta los resúmenes y el fit es el peor veredicto con sus notas.
 */
export function resumenCompat(refs: ReferenciaLook[]): { summary: string; fit: { verdict: string; note: string } } {
  const peso: Record<string, number> = { va: 0, ajustes: 1, ojo: 2 };
  const peor = refs.reduce<{ verdict: string; note: string }>(
    (acc, r) => {
      const v = r.fit?.verdict ?? "va";
      return (peso[v] ?? 0) > (peso[acc.verdict] ?? 0) ? { verdict: v, note: r.fit?.note ?? "" } : acc;
    },
    { verdict: "va", note: refs.find((r) => r.fit?.note)?.fit?.note ?? "" }
  );
  const notas = refs.map((r) => r.fit?.note?.trim()).filter((n): n is string => !!n && (refs.length === 1 || true));
  return {
    summary: refs.map((r) => r.resumen).join(" · "),
    fit: { verdict: peor.verdict, note: refs.length > 1 ? notas.join(" ") : peor.note },
  };
}
