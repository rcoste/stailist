import { sendEmail, type SendResult } from "@/lib/email";

// Correo de invitación a la beta. Se manda al agregar a alguien a la allowlist
// (o al reenviar desde admin). NO lleva código ni magic link: solo un deep-link
// que cae en el login con el correo pre-llenado. El código de 6 dígitos se
// genera fresco cuando la persona le pica a "mándame el código" — así nada
// caduca antes de que lo use, y el link sobrevive a los escáneres de correo
// (no es una credencial de un solo uso, solo pre-llena un formulario).
//
// Estilo clavado al del correo semanal / consentimiento parental: papel hueso,
// wordmark st·ai·list con "ai" en serif itálica, botón negro, fuentes web-safe
// (Gmail ignora fuentes propias y borra SVG).

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stailist.co";

export const inviteUrl = (token: string) => `${SITE}/login?invite=${token}`;

// Valida forma UUID antes de tocar la DB (la columna es uuid — un string que no
// sea UUID revienta el cast con un 500 crudo). Igual que isConsentToken.
export const isInviteToken = (t: string | null | undefined): t is string =>
  !!t && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

export async function sendInviteEmail(
  to: string,
  token: string
): Promise<SendResult> {
  const url = inviteUrl(token);
  const sans =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
  const serif = "Georgia,'Times New Roman',serif";

  const subject = "Ya tienes tu lugar en stailist";

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f3f1;font-family:${sans};color:#141414;">
<div style="max-width:480px;margin:0 auto;padding:44px 24px;">
  <div style="font-size:24px;font-weight:700;letter-spacing:-0.045em;">st<span style="font-family:${serif};font-style:italic;font-weight:400;letter-spacing:0;">ai</span>list</div>

  <div style="margin:34px 0 0;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#6f6f6f;">Tu invitación</div>
  <h1 style="margin:12px 0 0;font-size:32px;line-height:1.1;font-weight:700;letter-spacing:-0.035em;color:#141414;">Estás dentro. Vamos a vestirte <span style="font-family:${serif};font-style:italic;font-weight:400;letter-spacing:0;">increíble</span>.</h1>

  <p style="margin:20px 0 0;font-size:17px;line-height:1.55;color:#363636;">Soy tu stylist personal. Con la ropa que <b style="color:#141414;">ya tienes</b>, te armo un look listo para tu día — pensado para ti y para el clima de tu ciudad.</p>
  <p style="margin:14px 0 0;font-size:17px;line-height:1.55;color:#363636;">Tu primer outfit está <b style="color:#141414;">a unos minutos</b> de aquí. Solo pícale al botón — ya te dejé tu correo puesto.</p>

  <p style="margin:28px 0 0;"><a href="${url}" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:15px;font-weight:700;letter-spacing:-0.01em;text-decoration:none;padding:15px 28px;border-radius:3px;">Entrar y armar mi primer look &rarr;</a></p>

  <p style="margin:30px 0 0;font-family:${serif};font-style:italic;font-size:17px;line-height:1.5;color:#363636;">Nos vemos en tu clóset.</p>
  <p style="margin:6px 0 0;font-size:13px;font-weight:700;letter-spacing:-0.01em;color:#141414;">&mdash; stailist</p>

  <p style="margin:30px 0 0;font-size:12px;line-height:1.55;color:#9a9a9a;">Recibes esto porque te invitaron a la beta de stailist. Si no la reconoces, ignora este correo y no pasa nada.</p>
</div></body></html>`;

  const text = [
    "Estás dentro — vamos a vestirte increíble.",
    "",
    "Soy tu stylist personal. Con la ropa que ya tienes, te armo un look listo",
    "para tu día — pensado para ti y para el clima de tu ciudad. Tu primer outfit",
    "está a unos minutos de aquí, con tu correo ya puesto.",
    "",
    `Entrar y armar mi primer look → ${url}`,
    "",
    "Nos vemos en tu clóset.",
    "— stailist",
    "",
    "Recibes esto porque te invitaron a la beta de stailist. Si no la reconoces, ignora este correo.",
  ].join("\n");

  return sendEmail({ to, subject, html, text });
}
