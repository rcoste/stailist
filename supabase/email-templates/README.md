# Email templates — Stailist (Supabase Auth)

Plantillas de los correos de auth que manda Supabase. **Llevan un código OTP de
6 dígitos (`{{ .Token }}`), no un link.** Diseñadas con los tokens del branding
v3 "Gen-Z monocromo": papel hueso `#f4f3f1`, tinta `#141414`, wordmark
st·ai·list con el "ai" en Georgia itálica NEGRA, código en caja negra. Sin
burdeos, sin Bodoni Moda, sin Hanken Grotesk — eso era la v2 y está muerta.

El hex va literal porque los clientes de correo (Gmail) borran las variables
CSS: **son los mismos tokens de `globals.css` traducidos a mano**, no colores
nuevos. Cuando cambie la paleta hay que traducirlos otra vez.

(Este párrafo describió la paleta v2 hasta el 2026-09-08 — seis semanas después
de que las plantillas pasaran a v3. La misma clase de desincronía que el
problema que documenta la sección de abajo.)

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

**Con el script — las DOS a la vez, que es el punto:**

```bash
SUPABASE_PAT=sbp_xxx node scripts/aplicar-email-templates.mjs
```

El PAT se crea en https://supabase.com/dashboard/account/tokens, se usa y **se
revoca** (es de cuenta completa, no hay scope por proyecto). `--dry-run` valida
sin enviar.

### Por qué existe el script, y no un curl a mano

**Editar el HTML aquí NO cambia nada en producción.** Son dos pasos, y el
segundo se puede olvidar a medias — se olvidó:

El 2026-07-23 los commits `8596e38` y `1695a05` pasaron las dos plantillas al
branding v3. En Supabase se aplicó **una**: el Magic Link. La de bienvenida se
quedó **47 días** con el diseño v2 (burdeos, Bodoni, caja rosa) mientras el
archivo de este directorio estaba correcto. Se descubrió el 2026-09-08, cuando
Roberto se registró desde cero y vio los dos correos uno al lado del otro.

El script manda las dos en una sola llamada y se planta antes de enviar si a
alguna le falta `{{ .Token }}` (el correo quedaría inservible para entrar) o si
trae rastros del branding v2.

**Por dashboard** (si prefieres a mano): Authentication → Emails → Templates →
pestañas "Magic Link" y "Confirm signup" → pegar el HTML. **Las dos.**

## Subjects (asunto)

- Magic Link → `Tu acceso a Stailist`
- Confirm signup → `Bienvenida a Stailist`
