// Plantilla del correo semanal. Monocromo v3 (tinta #1a1a1a sobre papel #f4f3f1),
// tipografía del sistema (los correos NO cargan fuentes propias con fiabilidad).
// Es un EMPUJÓN de regreso, no el producto: el look se genera fresco al abrir /hoy
// (con el clima real del día), no lo pre-generamos aquí.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stailist.co";

export function weeklyEmail(opts: { unsubToken: string; nombre?: string | null }) {
  const hola = opts.nombre ? `Hola, ${opts.nombre}` : "Hola";
  const bajaUrl = `${SITE}/api/email/baja?token=${opts.unsubToken}`;
  const hoyUrl = `${SITE}/hoy`;

  const subject = "Tu look de la semana te espera ✨";

  const text = [
    `${hola},`,
    "",
    "Empieza la semana con el pie derecho. Tu stylist ya tiene ideas para ti — abre la app y arma tu look de hoy en segundos, con el clima de tu ciudad.",
    "",
    `Arma mi look → ${hoyUrl}`,
    "",
    "— stailist",
    "",
    `Si ya no quieres estos correos, date de baja aquí: ${bajaUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f3f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border:1px solid #e6e3df;border-radius:14px;">
        <tr><td style="padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
          <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#8a857e;font-weight:700;">stailist</div>
          <h1 style="margin:18px 0 0;font-size:26px;line-height:1.15;font-weight:700;color:#1a1a1a;">${hola}, tu look de la semana te espera</h1>
          <p style="margin:16px 0 0;font-size:16px;line-height:1.5;color:#57534e;">Empieza la semana con el pie derecho. Tu stylist ya tiene ideas para ti — arma tu look de hoy en segundos, con el clima de tu ciudad.</p>
          <a href="${hoyUrl}" style="display:inline-block;margin:28px 0 0;background:#1a1a1a;color:#f4f3f1;text-decoration:none;font-size:16px;font-weight:600;padding:14px 28px;border-radius:6px;">Armar mi look →</a>
        </td></tr>
      </table>
      <p style="max-width:460px;margin:20px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#a8a29e;text-align:center;">
        Recibes esto porque pediste tu look semanal.
        <a href="${bajaUrl}" style="color:#a8a29e;text-decoration:underline;">Date de baja</a> cuando quieras.
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
