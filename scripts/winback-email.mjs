// Correo ÚNICO de regreso para quienes probaron la app y no volvieron.
// Warm, low-pressure, con baja de un clic. NO es el semanal (ese es opt-in);
// este es un re-engagement de una sola vez a gente que ya se registró.
//
// SEGURIDAD: dry-run por defecto — imprime a quién le llegaría y NO manda nada.
// Para enviar de verdad: node scripts/winback-email.mjs --send
//
// Cohorte "lapsed": onboarding completo, sin actividad en >=5 días, excluyendo
// cuentas dev (@stailist.app) y la cuenta primaria de Roberto.
import { Client } from "pg";
import { readFileSync } from "node:fs";

const env = (k) =>
  readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(k + "="))
    ?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");

const SEND = process.argv.includes("--send");
const TOKEN = env("POSTMARK_SERVER_TOKEN");
const SITE = env("NEXT_PUBLIC_SITE_URL") ?? "https://stailist.co";
const DB = env("DATABASE_URL");

function email({ unsubToken }) {
  const bajaUrl = `${SITE}/api/email/baja?token=${unsubToken}`;
  const hoyUrl = `${SITE}/hoy`;
  const subject = "Tu stylist tiene looks nuevos para ti ✨";
  const text = [
    "Hola,",
    "",
    "Probaste stailist hace poco — gracias por darte la vuelta. Estuvimos puliendo",
    "un montón de cosas desde entonces, y tu stylist ya tiene ideas frescas para tu clóset.",
    "",
    "¿Te armo un look para hoy? Toma 30 segundos y considera el clima de tu ciudad.",
    "",
    `Armar mi look → ${hoyUrl}`,
    "",
    "— stailist",
    "",
    `Si no era para ti, todo bien: ${bajaUrl}`,
  ].join("\n");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f3f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1;"><tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border:1px solid #e6e3df;border-radius:14px;"><tr><td style="padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#8a857e;font-weight:700;">stailist</div>
      <h1 style="margin:18px 0 0;font-size:26px;line-height:1.15;font-weight:700;">Tu stylist tiene looks nuevos para ti</h1>
      <p style="margin:16px 0 0;font-size:16px;line-height:1.5;color:#57534e;">Probaste stailist hace poco — gracias por darte la vuelta. Estuvimos puliendo un montón de cosas desde entonces, y tu stylist ya tiene ideas frescas para tu clóset.</p>
      <p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#57534e;">¿Te armo un look para hoy? Toma 30 segundos y considera el clima de tu ciudad.</p>
      <a href="${hoyUrl}" style="display:inline-block;margin:28px 0 0;background:#1a1a1a;color:#f4f3f1;text-decoration:none;font-size:16px;font-weight:600;padding:14px 28px;border-radius:6px;">Armar mi look →</a>
    </td></tr></table>
    <p style="max-width:460px;margin:20px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#a8a29e;text-align:center;">Recibes esto porque te registraste en stailist. <a href="${bajaUrl}" style="color:#a8a29e;text-decoration:underline;">No quiero más correos</a>.</p>
  </td></tr></table>
</body></html>`;
  return { subject, text, html };
}

const client = new Client({ connectionString: DB });
await client.connect();
const { rows } = await client.query(`
  select p.email, p.email_unsub_token,
    greatest(
      (select max(e.created_at) from events e where e.user_id = p.id),
      (select max(o.created_at) from outfits o where o.user_id = p.id)
    )::date as ultimo_uso
  from profiles p
  where p.onboarding_step >= 5
    and p.email not like '%@stailist.app'
    and p.email <> 'roberto@kublau.com'
    and greatest(
      (select max(e.created_at) from events e where e.user_id = p.id),
      (select max(o.created_at) from outfits o where o.user_id = p.id)
    ) < now() - interval '5 days'
  order by ultimo_uso
`);

console.log(`\nCohorte de regreso: ${rows.length} personas\n`);
for (const r of rows) console.log(`  ${r.email.padEnd(34)} · último uso ${r.ultimo_uso.toISOString().slice(0, 10)}`);

if (!SEND) {
  console.log(`\n[DRY-RUN] No se mandó nada. Para enviar: node scripts/winback-email.mjs --send\n`);
  const sample = email({ unsubToken: "<token>" });
  console.log(`Asunto: ${sample.subject}\n\n${sample.text}\n`);
  await client.end();
  process.exit(0);
}

console.log(`\nEnviando de verdad…\n`);
let ok = 0, fail = 0;
for (const r of rows) {
  const { subject, text, html } = email({ unsubToken: r.email_unsub_token });
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Postmark-Server-Token": TOKEN },
    body: JSON.stringify({ From: "stailist <hola@stailist.co>", To: r.email, Subject: subject, HtmlBody: html, TextBody: text, MessageStream: "broadcast" }),
  });
  const d = await res.json().catch(() => ({}));
  if (res.ok && (d.ErrorCode ?? 0) === 0) { ok++; console.log(`  ✓ ${r.email}`); }
  else { fail++; console.log(`  ✗ ${r.email} — ${res.status} ${d.Message ?? ""}`); }
}
console.log(`\nEnviados: ${ok} · fallidos: ${fail}\n`);
await client.end();
