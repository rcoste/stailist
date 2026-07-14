// Envío de correos por la API de Postmark. Hasta ahora la app NO mandaba correos
// propios: el magic link va por Supabase (SMTP). Este es el primer camino de envío
// desde el server de la app — lo usa el correo semanal de "tu stylist te espera".
//
// El token es un "Server Token" de Postmark (API). El remitente tiene que estar
// verificado en Postmark (dominio stailist.co ya lo está para el magic link).

const POSTMARK_URL = "https://api.postmarkapp.com/email";

export const EMAIL_FROM = "stailist <hola@stailist.co>";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Postmark separa correos "transaccionales" de "broadcast" (marketing). El
  // semanal es broadcast → usa un Message Stream distinto para que los
  // unsubscribes y la reputación no contaminen los transaccionales (magic link).
  stream?: string;
};

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) return { ok: false, error: "POSTMARK_SERVER_TOKEN ausente" };

  const res = await fetch(POSTMARK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: EMAIL_FROM,
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.html,
      TextBody: input.text,
      MessageStream: input.stream ?? "outbound",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ErrorCode?: number;
    Message?: string;
    MessageID?: string;
  };
  if (!res.ok || (data.ErrorCode ?? 0) !== 0) {
    return { ok: false, error: `${res.status} · ${data.Message ?? "error"}` };
  }
  return { ok: true, id: data.MessageID ?? "" };
}
