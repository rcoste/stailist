# Email templates — Stailist (Supabase Auth)

Plantillas de los correos de auth que manda Supabase. **Llevan un código OTP de
6 dígitos (`{{ .Token }}`), no un link.** Diseñadas con los tokens del design
system (burdeos `#722F37` + neutros cálidos, Bodoni Moda + Hanken Grotesk con
fallbacks email-safe). El hex va literal porque los clientes de correo (Gmail)
borran las variables CSS — **son los mismos tokens de `globals.css`, no colores
nuevos**.

## Por qué código OTP y no magic link

El magic link (`token_hash` en la URL) rompía con Outlook/Hotmail: su escáner de
seguridad (Safe Links) **pre-visita el link y consume el token de un solo uso**
antes de que el usuario lo abra → "link caducó". El código de 6 dígitos lo
resuelve en general: un escáner no puede teclear un código. Además funciona
cross-browser, en iPhone, y dentro de la PWA (los links abren el navegador y
rompen el flujo de la PWA; el código se teclea sin salir de la app).

## Cuáles existen

| Archivo | Template en Supabase | Cuándo |
|---|---|---|
| `magic-link.html` | **Magic Link** (`mailer_templates_magic_link_content`) | Login normal. Lleva el código. |
| `confirm-signup.html` | **Confirm signup** (`mailer_templates_confirmation_content`) | Primer correo de usuario nuevo. Lleva el código. |

> Los nombres de archivo conservan el slot de Supabase (magic_link / confirmation)
> aunque el contenido ya sea un código, no un link.

Los demás templates de Supabase (Reset Password, Change Email, Invite,
Reauthentication) **no se usan**: no hay contraseñas, ni UI de cambio de correo,
y el allowlist es propio.

## El flujo (código de los dos lados)

1. `app/login/actions.ts` → `sendCode`: valida allowlist + `signInWithOtp({ email })`.
   Supabase genera el OTP; el template lo muestra con `{{ .Token }}`.
2. `app/login/login-form.tsx`: paso 1 (correo) → paso 2 (input de 6 dígitos).
3. `actions.ts` → `verifyCode`: `verifyOtp({ email, token, type: 'email' })`.
   Deja la sesión en cookies y redirige a `/`.

Ya **no** existe la ruta `app/auth/confirm` (era para los links).

## Cómo aplicarlos en Supabase

**Por Management API** (`PATCH /v1/projects/{ref}/config/auth`): campos
`mailer_templates_magic_link_content` / `mailer_templates_confirmation_content`
y `mailer_subjects_magic_link` / `mailer_subjects_confirmation`. El curl necesita
`User-Agent: curl/*` o Cloudflare tira 403 (code 1010).

**Por dashboard:** Authentication → Emails → Templates → pestañas "Magic Link" y
"Confirm signup" → pegar el HTML.

## Subjects (asunto)

- Magic Link → `Tu acceso a Stailist`
- Confirm signup → `Bienvenida a Stailist`
