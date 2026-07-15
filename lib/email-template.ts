// Plantilla del correo semanal. v3 "Gen-Z monocromo" — clavada al lenguaje de la
// landing: sans grande y apretada + UNA palabra en serif itálica de acento, papel
// hueso, hairlines, tinta negra. Los correos NO cargan fuentes propias con
// fiabilidad (Gmail ignora Arimo/Instrument Serif) NI SVG (Gmail lo borra → el
// isotipo no viaja): reproducimos la dualidad con fuentes web-safe (Helvetica/Arial
// + Georgia itálica como sustituta del serif de acento).
//
// Es un EMPUJÓN de regreso, no el producto: el look se genera fresco al abrir /hoy
// (con el clima real del día), no lo pre-generamos aquí.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stailist.co";

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

// Wordmark st·ai·list con el "ai" en serif itálica (la firma de la marca).
const wordmark = `<span style="font-size:22px;font-weight:700;letter-spacing:-0.045em;color:#141414;line-height:1;">st<span style="font-family:${SERIF};font-style:italic;font-weight:400;letter-spacing:0;">ai</span>list</span>`;

// Banner de descubrimiento al pie: cada apertura invita a probar un feature.
// Rota por semana (mismo tip para todos en un envío dado). Nota editorial
// hairline, NO un segundo botón — no le pelea al CTA principal.
type Feature = { title: string; desc: string; cta: string; path: string };
const FEATURES: Feature[] = [
  {
    title: "¿Un viaje pronto?",
    desc: `Arma tu maleta en <b style="font-weight:700;color:#141414;">modo Viaje</b>: una cápsula que cabe en carry-on y se reparte en outfits por día — con el clima de cada parada.`,
    cta: "Probar modo Viaje",
    path: "/viaje",
  },
  {
    title: "Menos ropa, más looks.",
    desc: `Descubre tu <b style="font-weight:700;color:#141414;">cápsula</b>: te muestra cuánto rinde de verdad cada prenda y qué te falta para desbloquear más combinaciones.`,
    cta: "Ver mi cápsula",
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

function featureBannerHtml(): string {
  const f = weeklyFeature();
  return `<tr><td style="padding:30px 6px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e3e0;">
        <tr><td style="padding:22px 0 0;font-family:${SANS};">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#9a9a9a;">Para sacarle más</span>
          <div style="margin:12px 0 0;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#141414;">${f.title}</div>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.55;color:#363636;">${f.desc}</p>
          <a href="${SITE}${f.path}" style="display:inline-block;margin:12px 0 0;font-size:14px;font-weight:700;letter-spacing:-0.01em;color:#141414;text-decoration:none;border-bottom:1.5px solid #141414;padding-bottom:1px;">${f.cta} &rarr;</a>
        </td></tr>
      </table>
    </td></tr>`;
}

export function weeklyEmail(opts: { unsubToken: string }) {
  const bajaUrl = `${SITE}/api/email/baja?token=${opts.unsubToken}`;
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

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f3f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1;">
    <tr><td align="center" style="padding:44px 20px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;font-family:${SANS};">

        <tr><td style="padding:0 6px 20px;border-bottom:1px solid #e4e3e0;">${wordmark}</td></tr>

        <tr><td style="padding:32px 6px 0;">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#6f6f6f;">Tu look de la semana</span>
        </td></tr>

        <tr><td style="padding:14px 6px 0;">
          <h1 style="margin:0;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-0.035em;color:#141414;">El lunes es más fácil con el look ya <span style="font-family:${SERIF};font-style:italic;font-weight:400;letter-spacing:0;">resuelto</span>.</h1>
        </td></tr>

        <tr><td style="padding:18px 6px 0;">
          <p style="margin:0;font-size:16px;line-height:1.6;color:#363636;">Abre la app y en segundos tienes un outfit con la ropa que <b style="color:#141414;font-weight:700;">ya tienes</b> — pensado para tu día y el clima de tu ciudad. Tú solo eliges.</p>
        </td></tr>

        <tr><td style="padding:28px 6px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:6px;">
            <tr><td style="padding:24px 22px;">
              <span style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);">Tu look de hoy</span>
              <div style="margin:11px 0 0;font-family:${SERIF};font-style:italic;font-size:23px;line-height:1.25;color:#ffffff;">Lo de siempre, pero bien pensado.</div>
              <div style="margin:16px 0 0;padding-top:15px;border-top:1px solid rgba(255,255,255,0.16);font-size:12.5px;letter-spacing:0.02em;color:rgba(255,255,255,0.66);">con tu ropa &nbsp;&middot;&nbsp; para tu día &nbsp;&middot;&nbsp; con el clima de hoy</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:28px 6px 0;">
          <a href="${hoyUrl}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:-0.01em;padding:15px 26px;border-radius:3px;">Armar mi look de hoy &rarr;</a>
        </td></tr>

        <tr><td style="padding:32px 6px 0;">
          <p style="margin:0;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.5;color:#363636;">Nos vemos en tu clóset.</p>
          <p style="margin:6px 0 0;font-size:13px;font-weight:700;letter-spacing:-0.01em;color:#141414;">&mdash; stailist</p>
        </td></tr>

        ${featureBannerHtml()}

      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
        <tr><td style="padding:28px 6px 0;">
          <p style="margin:0;font-size:12px;line-height:1.55;color:#9a9a9a;font-family:${SANS};">
            Recibes esto porque pediste tu look semanal.
            <a href="${bajaUrl}" style="color:#9a9a9a;text-decoration:underline;">Date de baja</a> cuando quieras.
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
