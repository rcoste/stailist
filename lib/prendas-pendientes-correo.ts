import { CUOTAS } from "@/lib/cuotas";
import { ZONA } from "@/lib/admin/adquisicion";
import { SERIF, SITE, bloque, boton, documento, filas, kicker, serifItalica, urlBaja } from "@/lib/email-marca";

// EL AVISO DE "YA PUEDO SEGUIR CON TU CLÓSET".
//
// Cuando alguien sube más prendas que el tope diario de imágenes limpias
// (lib/cuotas.ts, "renders"), las que sobran entran con su foto original y se
// pulen cuando la persona vuelve (lib/renders-pendientes.ts). En pantalla se le
// promete "mañana te aviso cuando pueda seguir": este correo cumple esa promesa.
//
// Idea de Roberto (2026-10-05): que el tope sea una razón para volver al día
// siguiente y no un "se acabó". El correo no dice que las prendas "ya están":
// se pulen cuando entra, y así sólo se paga la imagen de quien regresa.
//
// UNO por tanda: no se repite hasta que la persona suba prendas nuevas que
// vuelvan a quedarse pendientes.

/** No se le escribe a nadie de madrugada: el cron corre cada hora. */
export const HORA_MIN = 9;
export const HORA_MAX = 21;

export function horaEnCdmx(ahora: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ZONA, hour: "numeric", hourCycle: "h23" }).format(ahora)
  );
}

export type CandidataAviso = {
  /** Prendas que siguen con su foto, esperando su imagen limpia. */
  pendientes: number;
  /** Cuándo entró la más reciente de ésas (ISO). */
  ultimaPendiente: string | null;
  /** Imágenes limpias que generó en las últimas 24 horas. */
  renders24h: number;
  /** Último aviso de éstos que se le mandó (ISO), si alguno. */
  avisoEnviado: string | null;
};

export type VeredictoAviso = { toca: true } | { toca: false; motivo: string };

export function leTocaAviso(c: CandidataAviso, ahora: Date): VeredictoAviso {
  if (c.pendientes <= 0 || !c.ultimaPendiente) return { toca: false, motivo: "sin pendientes" };
  // Ya se le avisó de esta tanda.
  if (c.avisoEnviado && new Date(c.avisoEnviado) >= new Date(c.ultimaPendiente)) {
    return { toca: false, motivo: "ya avisada" };
  }
  // Avisar antes de que haya cupo sería invitarla a entrar para nada: el tope
  // es de 24 horas móviles, así que "mañana" llega cuando sus renders de ayer
  // dejan de contar.
  const libres = CUOTAS.renders - c.renders24h;
  if (libres < Math.min(c.pendientes, CUOTAS.renders)) return { toca: false, motivo: "aún sin cupo" };
  const hora = horaEnCdmx(ahora);
  if (hora < HORA_MIN || hora >= HORA_MAX) return { toca: false, motivo: "fuera de horario" };
  return { toca: true };
}

export function correoPrendasPendientes(o: { unsubToken: string; pendientes: number }) {
  const bajaUrl = urlBaja(o.unsubToken);
  const closetUrl = `${SITE}/closet`;
  const n = o.pendientes;
  const cuantas = n === 1 ? "la prenda que faltaba" : `las ${n} prendas que faltaban`;
  const hoy = n > CUOTAS.renders ? ` Hoy alcanzo a dejar ${CUOTAS.renders}; el resto, mañana.` : "";
  const subject = "ya puedo seguir con tu clóset";
  const parrafo = `Ayer subiste tanta ropa que no alcancé a pulir la imagen de todas. Ya puedo seguir: abre tu clóset y dejo ${cuantas} con su imagen limpia mientras lo ves.${hoy}`;

  const text = [
    "Ya puedo seguir con tu clóset.",
    "",
    parrafo,
    "",
    `Abrir mi clóset → ${closetUrl}`,
    "",
    "Mientras tanto ya puedes armar looks con todas: están en tu clóset.",
    "— stailist",
    "",
    `Recibes esto porque tienes una cuenta en stailist. Date de baja: ${bajaUrl}`,
  ].join("\n");

  const cuerpo = filas([
    bloque("32px 6px 0", kicker("Tu clóset")),
    bloque(
      "14px 6px 0",
      `<h1 style="margin:0;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-0.035em;color:#141414;">Ya puedo seguir con ${serifItalica(
        "tu clóset"
      )}.</h1>`
    ),
    bloque("22px 6px 0", `<p style="margin:0;font-size:16px;line-height:1.6;color:#363636;">${parrafo}</p>`),
    bloque("28px 6px 0", boton({ href: closetUrl, texto: "Abrir mi clóset" })),
    bloque(
      "32px 6px 0",
      `<p style="margin:0;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.5;color:#363636;">Mientras tanto ya puedes armar looks con todas: están en tu clóset.</p>
          <p style="margin:6px 0 0;font-size:13px;font-weight:700;letter-spacing:-0.01em;color:#141414;">&mdash; stailist</p>`
    ),
  ]);

  const html = documento({
    cuerpo,
    motivo: "Recibes esto porque tienes una cuenta en stailist.",
    bajaUrl,
  });
  return { subject, html, text };
}
