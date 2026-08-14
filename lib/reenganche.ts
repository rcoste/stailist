// EL REENGANCHE DE 48 HORAS — a quién le toca y qué le decimos.
//
// EL HUECO QUE TAPA, medido el 2026-08-14 sobre las usuarias reales:
//
//   · Andy (alta 10 ago): 78 prendas, 22 con foto propia, avatar, esenciales,
//     8 looks y 3 con 👍. Primer look en 9 minutos. Duró 3 días.
//   · Islam (alta 10 ago): 57 prendas, 5 looks, terminó con un 👎. Duró 2 días.
//   · Tatiana (alta 18 jun): 16 prendas de biblioteca. Duró 1 día.
//
// Andy hizo TODO bien y le gustaron sus looks. Eso descarta que el problema sea
// el onboarding o la calidad del primer resultado: no había nada que la llamara
// de vuelta al día siguiente. El correo semanal existe, pero le habría llegado
// el 17 — se fue el 12. La gente se apaga a los 2-3 días y el rescate llegaba a
// los 7.
//
// Esto es LÓGICA PURA (sin DB, sin red, sin HTML): recibe hechos y devuelve un
// veredicto y un texto. Se prueba entera en `reenganche.test.ts`, que es el
// punto — el cron solo trae las filas y manda; las decisiones se revisan aquí.

/** Cuánto hay que esperar antes de escribir. Menos se siente vigilancia. */
export const HORAS_MINIMAS = 48;

/**
 * Y el techo de la ventana. NO es un detalle: sin él, la primera corrida le
 * escribe "hace poco estuviste aquí" a todo el que se fue hace dos meses, y ese
 * correo miente. Quien lleva más de una semana fuera necesita otro correo, con
 * otro texto (un win-back), no éste.
 */
export const DIAS_MAXIMOS = 7;

/**
 * Colchón contra el doblete: si el semanal salió hace nada, este se espera. Dos
 * correos en dos días a alguien que ya se estaba yendo es la receta para que te
 * marque como spam — y con una base de 13 personas, una queja pesa.
 */
export const HORAS_COLCHON_SEMANAL = 48;

const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

export type PerfilReenganche = {
  email: string;
  /** El máximo de todas las huellas que deja usar la app (ver el cron). */
  ultimaActividad: string;
  /** Looks vivos. Sin al menos uno no hay nada personal que recordarle. */
  looks: number;
  /** `profiles.email_semanal_last_sent` — se LEE, nunca se escribe desde aquí. */
  semanalUltimoEnvio: string | null;
};

export type Veredicto =
  | { toca: true }
  | { toca: false; motivo: string };

/**
 * ¿Le escribimos hoy?
 *
 * Las condiciones que NO están aquí (opt-in, onboarding completo, no haberlo
 * recibido antes) viven en el WHERE de la consulta: son filtros de conjunto,
 * baratos en SQL y sin matices que probar. Aquí queda lo que sí tiene matiz —
 * las tres reglas de tiempo, que son las que se discuten y las que se rompen.
 */
export function leToca(p: PerfilReenganche, ahora: Date): Veredicto {
  const t = Date.parse(p.ultimaActividad);
  if (Number.isNaN(t)) return { toca: false, motivo: "última actividad ilegible" };

  const horasQuieta = (ahora.getTime() - t) / HORA_MS;
  if (horasQuieta < HORAS_MINIMAS) {
    return { toca: false, motivo: `sigue activa (${Math.round(horasQuieta)}h)` };
  }
  if (horasQuieta > DIAS_MAXIMOS * 24) {
    return {
      toca: false,
      motivo: `fría desde hace ${Math.round(horasQuieta / 24)} días — le toca win-back, no esto`,
    };
  }
  if (p.looks < 1) {
    // Cargó clóset y nunca pidió un look. Es un caso más urgente que éste, pero
    // el correo que necesita es otro: no hay nada suyo que recordarle.
    return { toca: false, motivo: "sin looks generados" };
  }

  if (p.semanalUltimoEnvio) {
    const s = Date.parse(p.semanalUltimoEnvio);
    if (!Number.isNaN(s)) {
      const horasDelSemanal = (ahora.getTime() - s) / HORA_MS;
      if (horasDelSemanal < HORAS_COLCHON_SEMANAL) {
        return {
          toca: false,
          motivo: `recibió el semanal hace ${Math.round(horasDelSemanal)}h`,
        };
      }
    }
  }

  return { toca: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// EL GANCHO: qué le decimos
// ─────────────────────────────────────────────────────────────────────────────

export type LookParaGancho = {
  titulo: string | null;
  /** Nombres de las prendas, en el orden del look. */
  prendas: string[];
  voto: "up" | "down" | null;
  creadoEn: string;
};

export type Gancho = {
  /**
   * `favorito` — hay un look con 👍. El más fuerte: prueba de que el producto
   *   ya funcionó para esa persona, escrita por ella misma.
   * `ultimo` — hay looks pero ninguno con 👍. Se usa el último NO rechazado.
   * `closet` — no queda ningún look utilizable; se apoya en el clóset.
   */
  tipo: "favorito" | "ultimo" | "closet";
  asunto: string;
  kicker: string;
  titularHtml: string;
  titularTexto: string;
  card: { kicker: string; frase: string; pie: string } | null;
  parrafoHtml: string;
  cuerpoTexto: string;
};

/** Los títulos y las prendas los escribe la IA y acaban dentro de HTML. */
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** La serif de acento, siempre itálica (la firma de la marca en un titular). */
function acento(texto: string): string {
  return `<span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;letter-spacing:0;">${texto}</span>`;
}

/** "ayer" / "hace 3 días". En voz de amiga nadie dice "hace 72 horas". */
export function haceCuanto(desde: string, ahora: Date): string {
  const t = Date.parse(desde);
  if (Number.isNaN(t)) return "hace poco";
  const dias = Math.floor((ahora.getTime() - t) / DIA_MS);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/** "la chamarra de piel, el corsé y el jean" — máximo 3, o se vuelve inventario. */
function listaPrendas(nombres: string[]): string {
  const vivos = nombres.map((n) => n.trim()).filter(Boolean).slice(0, 3);
  if (vivos.length === 0) return "";
  return vivos.join(" · ");
}

export type DatosGancho = {
  /** Looks vivos, del más reciente al más viejo. */
  looks: LookParaGancho[];
  /** Prendas vivas en su clóset. */
  prendas: number;
  ahora: Date;
};

/**
 * Elige el gancho con una escalera de respaldos, porque el material personal no
 * está garantizado: de las 13 personas con opt-in, solo 5 tienen algún 👍.
 *
 * La regla que no es obvia: en `ultimo` se SALTAN los looks con 👎. A Islam, que
 * se fue justo después de rechazar uno, recordarle precisamente ese look sería
 * la peor carta posible — le estaríamos diciendo "vuelve por lo que no te
 * gustó".
 */
export function elegirGancho(d: DatosGancho): Gancho {
  const favorito = d.looks.find((l) => l.voto === "up");
  const ultimo = d.looks.find((l) => l.voto !== "down");
  const prendas = `<b style="color:#141414;font-weight:700;">${d.prendas} prendas</b>`;

  if (favorito) {
    const titulo = (favorito.titulo ?? "").trim();
    const cuando = haceCuanto(favorito.creadoEn, d.ahora);
    return {
      tipo: "favorito",
      // El asunto lleva SU título entre comillas angulares: es imposible
      // confundirlo con publicidad, porque nadie más pudo haberlo escrito.
      asunto: titulo
        ? `¿Ya estrenaste el «${titulo}»?`
        : "¿Ya estrenaste el look que te gustó?",
      kicker: cuando,
      titularHtml: `Ese te gustó. Hoy te armo el ${acento("siguiente")}.`,
      titularTexto: "Ese te gustó. Hoy te armo el siguiente.",
      card: {
        kicker: `Te gustó ${cuando}`,
        frase: escapar(titulo || "Tu look"),
        pie: escapar(listaPrendas(favorito.prendas)) || "con tu ropa de siempre",
      },
      parrafoHtml: `Tienes ${prendas} más esperando su turno. Dime a dónde vas y en segundos te armo otro con lo que ya está en tu clóset.`,
      cuerpoTexto: `${titulo ? `«${titulo}» ` : ""}te gustó ${cuando}. Tienes ${d.prendas} prendas más esperando su turno — dime a dónde vas y en segundos te armo otro.`,
    };
  }

  if (ultimo) {
    const titulo = (ultimo.titulo ?? "").trim();
    return {
      tipo: "ultimo",
      asunto: "¿Y si hoy no piensas qué ponerte?",
      kicker: "Tu último look",
      titularHtml: `Hoy te armo uno ${acento("nuevo")}.`,
      titularTexto: "Hoy te armo uno nuevo.",
      card: {
        kicker: `El último que te armé, ${haceCuanto(ultimo.creadoEn, d.ahora)}`,
        frase: escapar(titulo || "Tu look"),
        pie: escapar(listaPrendas(ultimo.prendas)) || "con tu ropa de siempre",
      },
      parrafoHtml: `Tus ${prendas} siguen ahí, listas. Dame diez segundos y te armo algo con ellas — para hoy, o para el plan que traigas.`,
      cuerpoTexto: `Tus ${d.prendas} prendas siguen ahí, listas. Dame diez segundos y te armo algo con ellas — para hoy, o para el plan que traigas.`,
    };
  }

  return {
    tipo: "closet",
    asunto: `Tus ${d.prendas} prendas no se van a combinar solas`,
    kicker: "Tu clóset",
    titularHtml: `Ya está lo difícil. Falta lo ${acento("divertido")}.`,
    titularTexto: "Ya está lo difícil. Falta lo divertido.",
    card: null,
    parrafoHtml: `Cargar tu ropa fue el trabajo pesado y ya lo hiciste: ${prendas} listas. Ahora la parte fácil — dime a dónde vas y yo las combino.`,
    cuerpoTexto: `Cargar tu ropa fue el trabajo pesado y ya lo hiciste: ${d.prendas} prendas listas. Ahora la parte fácil — dime a dónde vas y yo las combino.`,
  };
}
