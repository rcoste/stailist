import { claseDe, tituloDe, type ClaseError } from "@/lib/errores-clave";

// /admin/errores: de ocurrencias sueltas a grupos que se pueden revisar.
// Lógica pura (los datos los trae lib/admin/errores-datos.ts).

export type Ocurrencia = {
  at: string;
  userId: string | null;
  clave: string;
  pantalla: string | null;
  mensaje: string | null;
  tecnico: string | null;
  /** De dónde salió: la tabla propia, un evento de fallo o un recibo de IA. */
  fuente: "errores" | "events" | "ai_calls";
};

export type EstadoGuardado = { clave: string; estado: "sin_revisar" | "visto" | "arreglado"; nota: string | null; actualizado: string };

/** "volvio" = se marcó visto o arreglado y después volvió a pasar. */
export type EstadoEfectivo = "sin_revisar" | "visto" | "arreglado" | "volvio";

export type Grupo = {
  clave: string;
  clase: ClaseError;
  titulo: string;
  veces: number;
  personas: number;
  ultima: string;
  estado: EstadoEfectivo;
  nota: string | null;
  /** Las más recientes primero, con tope. */
  ocurrencias: Ocurrencia[];
};

export function estadoEfectivo(guardado: EstadoGuardado | undefined, ultima: string): EstadoEfectivo {
  if (!guardado || guardado.estado === "sin_revisar") return "sin_revisar";
  // Por tiempo real: las fechas llegan con formatos distintos según la fuente.
  if (new Date(ultima).getTime() > new Date(guardado.actualizado).getTime()) return "volvio";
  return guardado.estado;
}

const ORDEN_ESTADO: Record<EstadoEfectivo, number> = { volvio: 0, sin_revisar: 1, visto: 2, arreglado: 3 };

export function agrupar(ocurrencias: Ocurrencia[], estados: EstadoGuardado[], tope = 5): Grupo[] {
  const porClave = new Map<string, Ocurrencia[]>();
  for (const o of ocurrencias) {
    const l = porClave.get(o.clave);
    if (l) l.push(o);
    else porClave.set(o.clave, [o]);
  }
  const estadoDe = new Map(estados.map((e) => [e.clave, e]));
  const grupos: Grupo[] = [];
  for (const [clave, lista] of porClave) {
    lista.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const guardado = estadoDe.get(clave);
    grupos.push({
      clave,
      clase: claseDe(clave),
      titulo: tituloDe(clave),
      veces: lista.length,
      personas: new Set(lista.map((o) => o.userId).filter(Boolean)).size,
      ultima: lista[0].at,
      estado: estadoEfectivo(guardado, lista[0].at),
      nota: guardado?.nota ?? null,
      ocurrencias: lista.slice(0, tope),
    });
  }
  // Lo que pide atención arriba; dentro de cada estado, lo más nuevo primero.
  return grupos.sort(
    (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || new Date(b.ultima).getTime() - new Date(a.ultima).getTime()
  );
}

/** Cuántos tipos de error (de los que vio la persona) piden revisión. Para el globo del menú. */
export function porRevisar(grupos: Grupo[]): number {
  return grupos.filter((g) => g.clase === "error" && (g.estado === "sin_revisar" || g.estado === "volvio")).length;
}
