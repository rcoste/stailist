// APLICA LAS PLANTILLAS DE CORREO DE AUTH A SUPABASE — LAS DOS, SIEMPRE.
//
// POR QUÉ EXISTE. El 2026-07-23 el commit 8596e38 pasó las dos plantillas al
// branding v3 y el 1695a05 les arregló los acentos. En Supabase se aplicó UNA:
// el Magic Link. La de bienvenida (Confirm signup) se quedó 47 días con el
// diseño v2 —burdeos, Bodoni, caja rosa— y nadie se enteró hasta que Roberto
// se registró desde cero el 2026-09-08 y vio los dos correos juntos: "está
// chistoso y mal que el OTP de bienvenida trae el diseño viejo".
//
// El repo estaba bien. Lo que falló fue el paso manual de aplicar, y falló de
// la forma más fácil de fallar: aplicando una de dos. Este script manda LAS
// DOS en una sola llamada, así "aplicar" vuelve a ser una acción atómica.
//
// USO (el token NUNCA se guarda en el repo ni en .env.local):
//   SUPABASE_PAT=sbp_xxx node scripts/aplicar-email-templates.mjs
//   SUPABASE_PAT=sbp_xxx node scripts/aplicar-email-templates.mjs --dry-run
//
// El PAT se crea en https://supabase.com/dashboard/account/tokens, se usa y se
// REVOCA (es de cuenta completa, no hay scope por proyecto). Mismo patrón que
// la vez anterior — está en la memoria del proyecto como PAT efímero.
//
// El User-Agent es obligatorio: sin él Cloudflare devuelve 403 (code 1010).
import { readFileSync } from "node:fs";

const REF = process.env.SUPABASE_PROJECT_REF ?? "owmvdpdczznygbuctnpv";
const PAT = process.env.SUPABASE_PAT;
const DRY = process.argv.includes("--dry-run");

if (!PAT && !DRY) {
  console.error(
    "Falta SUPABASE_PAT.\n" +
      "  1. Crea un token en https://supabase.com/dashboard/account/tokens\n" +
      "  2. SUPABASE_PAT=sbp_xxx node scripts/aplicar-email-templates.mjs\n" +
      "  3. Revócalo cuando termine (es de cuenta completa)."
  );
  process.exit(1);
}

// El slot de Supabase y el asunto viven aquí junto al archivo: el README los
// documentaba en prosa y la prosa no se ejecuta.
const PLANTILLAS = [
  {
    archivo: "supabase/email-templates/magic-link.html",
    campoContenido: "mailer_templates_magic_link_content",
    campoAsunto: "mailer_subjects_magic_link",
    asunto: "Tu acceso a Stailist",
    cuando: "login de alguien que ya tiene cuenta",
  },
  {
    archivo: "supabase/email-templates/confirm-signup.html",
    campoContenido: "mailer_templates_confirmation_content",
    campoAsunto: "mailer_subjects_confirmation",
    asunto: "Bienvenida a Stailist",
    cuando: "primer correo de alguien que se registra",
  },
];

const body = {};
for (const p of PLANTILLAS) {
  const html = readFileSync(p.archivo, "utf8");
  // Guardia barata contra aplicar una plantilla rota: sin el token no llega el
  // código y el correo queda inservible para entrar.
  if (!html.includes("{{ .Token }}")) {
    console.error(`✗ ${p.archivo} no contiene {{ .Token }} — no se aplica nada.`);
    process.exit(1);
  }
  // Y contra volver a mandar el branding muerto (v2: burdeos + Bodoni). Se mira
  // FUERA de los comentarios: las dos plantillas llevan uno que dice "sin
  // Bodoni Moda ni Hanken Grotesk (v2)", y buscar a secas lo marcaba como
  // infractor — la guardia acusaba justo a la nota que documenta el acierto.
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/#722F37|Bodoni|Hanken/i.test(sinComentarios)) {
    console.error(`✗ ${p.archivo} trae rastros del branding v2 — no se aplica nada.`);
    process.exit(1);
  }
  body[p.campoContenido] = html;
  body[p.campoAsunto] = p.asunto;
  console.log(`· ${p.archivo} → ${p.campoContenido} (${html.length} bytes) — ${p.cuando}`);
}

if (DRY) {
  console.log("\n--dry-run: nada se envió. Las dos plantillas pasaron las guardias.");
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${PAT}`,
    "Content-Type": "application/json",
    // Sin esto Cloudflare tira 403 (code 1010).
    "User-Agent": "curl/8.7.1",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`✗ ${res.status} ${res.statusText}\n${(await res.text()).slice(0, 600)}`);
  process.exit(1);
}
console.log("\n✓ Las DOS plantillas aplicadas. Revoca el PAT ahora.");
