// Spike: manda UN correo de prueba por Postmark API para confirmar que el camino
// de envío funciona (token válido + remitente verificado) antes de construir todo.
//   Uso: node scripts/test-email.mjs destinatario@correo.com [from]
import { readFileSync } from "node:fs";

const env = (k) =>
  readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(k + "="))
    ?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");

const TOKEN = env("POSTMARK_SERVER_TOKEN");
const to = process.argv[2];
const from = process.argv[3] ?? "hola@stailist.co";
if (!to) { console.error("Falta destinatario"); process.exit(1); }

const res = await fetch("https://api.postmarkapp.com/email", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Postmark-Server-Token": TOKEN,
  },
  body: JSON.stringify({
    From: `stailist <${from}>`,
    To: to,
    Subject: "prueba de envío — stailist",
    HtmlBody: "<p>Si ves esto, el camino de envío por Postmark API funciona. 🎉</p>",
    TextBody: "Si ves esto, el camino de envío por Postmark API funciona.",
    MessageStream: "outbound",
  }),
});
const data = await res.json().catch(() => ({}));
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(data, null, 2));
