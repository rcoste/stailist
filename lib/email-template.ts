// Las CARTAS. El membrete (wordmark, paleta, font stacks, pie de baja) vive en
// lib/email-marca.ts; aquí solo va lo que cambia entre un correo y otro.
//
// Dos correos, dos momentos distintos y deliberadamente separados:
//   · semanal — el lunes, para quien sigue viniendo. Ritmo.
//   · reenganche — una sola vez, a las ~48-72h de que alguien se apagó. Rescate.
//
// Ninguno de los dos pre-genera el look: son un EMPUJÓN de regreso, no el
// producto. El look se arma fresco al abrir /hoy, con el clima real del día.

import {
  SERIF,
  SITE,
  bloque,
  boton,
  cardNegra,
  documento,
  filas,
  kicker,
  notaHairline,
  serifItalica,
  urlBaja,
} from "@/lib/email-marca";

// ─────────────────────────────────────────────────────────────────────────────
// SEMANAL
// ─────────────────────────────────────────────────────────────────────────────

// Banner de descubrimiento al pie: cada apertura invita a probar un feature.
// Rota por semana (mismo tip para todos en un envío dado). Nota editorial
// hairline, NO un segundo botón — no le pelea al CTA principal.
type Feature = { title: string; desc: string; cta: string; path: string };
const FEATURES: Feature[] = [
  {
    title: "¿Un viaje pronto?",
    desc: `Arma tu maleta en <b style="font-weight:700;color:#141414;">modo Viaje</b>: lo justo que cabe en carry-on, repartido en outfits por día — con el clima de cada parada.`,
    cta: "Probar modo Viaje",
    path: "/viaje",
  },
  {
    title: "Menos ropa, más looks.",
    desc: `Descubre tus <b style="font-weight:700;color:#141414;">esenciales</b>: te muestran cuánto rinde de verdad cada prenda y qué te falta para desbloquear más combinaciones.`,
    cta: "Ver mis esenciales",
    path: "/closet",
  },
  {
    title: "Verte antes de salir.",
    desc: `Crea tu avatar una vez y prueba cualquier outfit <b style="font-weight:700;color:#141414;">puesto en ti</b> — con tus prendas reales, no una modelo.`,
    cta: "Crear mi avatar",
    path: "/perfil",
  },
  {
    title: "Los tonos que te encienden la cara.",
    desc: `Tu <b style="font-weight:700;color:#141414;">Cartera de color</b>: llévala a la tienda y sabe al instante si algo va con tu paleta.`,
    cta: "Abrir mi Cartera",
    path: "/cartera",
  },
];

// Índice rotativo por semana (días desde epoch / 7). Determinista dentro de un
// mismo envío: todos los correos del lunes muestran el mismo feature.
function weeklyFeature(): Feature {
  const week = Math.floor(Date.now() / (7 * 864e5));
  return FEATURES[week % FEATURES.length];
}

export function weeklyEmail(opts: { unsubToken: string }) {
  const bajaUrl = urlBaja(opts.unsubToken);
  const hoyUrl = `${SITE}/hoy`;
  const f = weeklyFeature();

  const subject = "Ya te tengo tu look de la semana";

  const text = [
    "Tu look de la semana",
    "",
    "El lunes es más fácil con el look ya resuelto. Abre la app y en segundos",
    "tienes un outfit con la ropa que ya tienes — pensado para tu día y el clima",
    "de tu ciudad. Tú solo eliges.",
    "",
    `Armar mi look de hoy → ${hoyUrl}`,
    "",
    "Nos vemos en tu clóset.",
    "— stailist",
    "",
    `Para sacarle más — ${f.title} ${SITE}${f.path}`,
    "",
    `Recibes esto porque pediste tu look semanal. Date de baja: ${bajaUrl}`,
  ].join("\n");

  const cuerpo = filas([
    bloque("32px 6px 0", kicker("Tu look de la semana")),
    bloque(
      "14px 6px 0",
      `<h1 style="margin:0;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-0.035em;color:#141414;">El lunes es más fácil con el look ya ${serifItalica(
        "resuelto"
      )}.</h1>`
    ),
    bloque(
      "18px 6px 0",
      `<p style="margin:0;font-size:16px;line-height:1.6;color:#363636;">Abre la app y en segundos tienes un outfit con la ropa que <b style="color:#141414;font-weight:700;">ya tienes</b> — pensado para tu día y el clima de tu ciudad. Tú solo eliges.</p>`
    ),
    bloque(
      "28px 6px 0",
      cardNegra({
        kicker: "Tu look de hoy",
        frase: "Lo de siempre, pero bien pensado.",
        pie: "con tu ropa &nbsp;&middot;&nbsp; para tu día &nbsp;&middot;&nbsp; con el clima de hoy",
      })
    ),
    bloque("28px 6px 0", boton({ href: hoyUrl, texto: "Armar mi look de hoy" })),
    bloque(
      "32px 6px 0",
      `<p style="margin:0;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.5;color:#363636;">Nos vemos en tu clóset.</p>
          <p style="margin:6px 0 0;font-size:13px;font-weight:700;letter-spacing:-0.01em;color:#141414;">&mdash; stailist</p>`
    ),
    notaHairline({
      kicker: "Para sacarle más",
      titulo: f.title,
      desc: f.desc,
      cta: f.cta,
      href: `${SITE}${f.path}`,
    }),
  ]);

  const html = documento({
    cuerpo,
    motivo: "Recibes esto porque pediste tu look semanal.",
    bajaUrl,
  });

  return { subject, text, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// REENGANCHE DE 48 HORAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El correo que trae de vuelta a quien probó stailist y se está apagando.
 *
 * POR QUÉ NO ES EL SEMANAL CON OTRO TEXTO: el semanal llega los lunes y a Andy
 * —78 prendas, avatar, 8 looks, 3 con 👍— le habría llegado el día 17, cinco
 * días después de irse el 12. La gente abandona a los 2-3 días; un rescate que
 * llega a los 7 no rescata a nadie. Ese hueco es toda la razón de este archivo.
 *
 * POR QUÉ VA PERSONALIZADO CON SU PROPIO LOOK: lo que descarta la hipótesis del
 * onboarding es que Andy hizo todo bien Y le gustaron sus looks. No le faltó
 * entender el producto ni tener un buen primer resultado: le faltó una razón
 * para volver. Un boletín genérico no es una razón; "«Corsé Rebelde de Noche»,
 * el que te gustó el martes" sí — es imposible confundirlo con publicidad,
 * porque nadie más pudo haberlo escrito.
 *
 * SIN IMÁGENES, a propósito: las fotos y renders viven en Storage privado y se
 * sirven con URLs FIRMADAS que expiran. Un correo se abre tres días después —
 * las imágenes llegarían rotas. La plantilla es tipográfica y esa es su fuerza.
 *
 * EL FIT CHECK VA AL PIE, NUNCA COMO BOTÓN: pedir "enséñame la foto" de frente
 * es exactamente el favor que ya mató a la card "¿te lo pusiste ayer?" (se
 * quedó bajo el 10% de respuesta). Primero se da valor, luego se pide.
 */
export function reengagementEmail(opts: {
  unsubToken: string;
  gancho: import("@/lib/reenganche").Gancho;
}) {
  const bajaUrl = urlBaja(opts.unsubToken);
  // `?generar=1` abre el wizard de "armar look" ya desplegado. Es un tap para
  // ARRANCAR, no para tener el look: el wizard sigue preguntando ocasión,
  // momento y clima. Cerrar ese hueco (precargar su objetivo de siempre) toca
  // el wizard, que es superficie probada — se decide aparte.
  const hoyUrl = `${SITE}/hoy?generar=1`;
  const g = opts.gancho;

  const text = [
    g.titularTexto,
    "",
    g.cuerpoTexto,
    "",
    `Armar mi look de hoy → ${hoyUrl}`,
    "",
    "Nos vemos en tu clóset.",
    "— stailist",
    "",
    "¿Ya te lo pusiste? Enséñame la foto y te digo cómo te queda — y de paso me aprendo tu clóset solito.",
    "",
    // "porque tienes una cuenta", NO "porque activaste los correos": la
    // preferencia `email_semanal` viene en 'semanal' POR DEFECTO desde la
    // migración 0076, así que casi nadie la activó a mano. Decirle a alguien
    // que pidió algo que nunca pidió es la clase de frase que se contesta con
    // un botón de "esto es spam", y una queja pesa mucho con 13 personas.
    `Recibes esto porque tienes una cuenta en stailist. Date de baja: ${bajaUrl}`,
  ].join("\n");

  const cuerpo = filas([
    bloque("32px 6px 0", kicker(g.kicker)),
    bloque(
      "14px 6px 0",
      `<h1 style="margin:0;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-0.035em;color:#141414;">${g.titularHtml}</h1>`
    ),
    ...(g.card
      ? [bloque("28px 6px 0", cardNegra(g.card))]
      : []),
    bloque(
      "22px 6px 0",
      `<p style="margin:0;font-size:16px;line-height:1.6;color:#363636;">${g.parrafoHtml}</p>`
    ),
    bloque("28px 6px 0", boton({ href: hoyUrl, texto: "Armar mi look de hoy" })),
    bloque(
      "32px 6px 0",
      `<p style="margin:0;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.5;color:#363636;">Nos vemos en tu clóset.</p>
          <p style="margin:6px 0 0;font-size:13px;font-weight:700;letter-spacing:-0.01em;color:#141414;">&mdash; stailist</p>`
    ),
    notaHairline({
      kicker: "Una cosa más",
      titulo: "¿Ya te lo pusiste?",
      desc: `Enséñame la foto y te digo cómo te queda — y de paso <b style="font-weight:700;color:#141414;">me aprendo tu clóset</b> solito.`,
      cta: "Hacer un fit check",
      href: `${SITE}/hoy`,
    }),
  ]);

  const html = documento({
    cuerpo,
    motivo: "Recibes esto porque tienes una cuenta en stailist.",
    bajaUrl,
  });

  return { subject: g.asunto, text, html };
}
