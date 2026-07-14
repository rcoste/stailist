# Readiness para paid marketing (Google Ads) — stailist

**Estado:** análisis, NO construido. Escrito 2026-07-13.
**Pregunta que responde:** ¿qué falta técnicamente para correr una campaña de
AdWords que sirva para algo? (no "poner anuncios", sino "que el gasto genere
aprendizaje medible").

## TL;DR — la objeción primero

Correr paid HOY es llenar una cubeta agujereada. Los datos propios (ver
`memory/admin-visual-y-ver-como`) muestran **75% de retención de UN día**: la
gente entra, genera sus 3 outfits y no vuelve. Con amigos y asistencia en
eventos. El tráfico frío retiene PEOR, no mejor. El correo semanal (retención)
está construido pero **sin desplegar ni probar** que mueve la aguja.

**Recomendación:** el orden correcto es (1) desplegar el correo semanal + el
win-back, (2) ver 2-3 semanas si la retención sube, (3) recién entonces paid,
con presupuesto tope. Si Roberto decide correr paid antes igual, este doc lista
lo mínimo para que no sea dinero tirado.

## Los 4 bloqueadores técnicos (de mayor a menor)

### 1. El muro de allowlist (BLOQUEADOR DURO)
`app/login/actions.ts` → `is_email_allowed` RPC. Un correo fuera de la lista ve
"la beta es por invitación, pídele tu lugar a Roberto". **Un click de anuncio no
puede convertir.** Sin resolver esto, todo lo demás es inútil.

**Decisión requerida — ¿qué recibe el tráfico del anuncio?**
- **A) Registro abierto:** cualquiera se registra (quitar el gate en signup).
  Rápido. Contras: pierdes el control de la beta; mandas desconocidos a un
  producto con endurecimiento de "cero usuarios"; cada registro que completa
  onboarding QUEMA cuota de IA real (avatar Gemini + outfits Opus = $ por
  usuario); riesgo de abuso/spam de registros.
- **B) Solo waitlist:** el anuncio lleva a la landing → captura correo a la
  waitlist → apruebas por lote. Mantiene control, sin muro. Contra: la persona
  NO recibe valor inmediato (espera) → caída alta; y no pruebas el producto,
  pruebas la tasa de captura de la landing.
- **C) Abierto con tope (recomendado si se corre paid):** registro abierto pero
  con cap diario de altas + captura de UTM. Escala controlada, gasto acotado.

### 2. Cero atribución (UTM / gclid)
Hoy la waitlist guarda `source` ("landing-hero") pero NADA captura los parámetros
de URL del anuncio (`utm_source`, `utm_campaign`, `gclid`). Sin esto no sabes qué
anuncio/keyword trajo a quién → no puedes optimizar el gasto ni calcular
costo-por-registro. Vuelas a ciegas.
**Construir:** capturar `utm_*` + `gclid` de la URL en la landing, guardarlos con
la fila de waitlist Y en `profiles` al registrarse. ~2-3h.

### 3. Sin evento de conversión de vuelta a Google
AdWords optimiza hacia una conversión que TÚ le reportas (registro / primer
outfit / "me lo puse"). Sin señal de conversión (tag de Google Ads o conversión
offline vía `gclid`), el algoritmo no optimiza y sobrepagas. Ya tienes los
eventos internos (`first_outfit_ttv`, `worn`) — falta puentearlos a Google.
**Construir:** o bien gtag client-side en el hito de primer outfit, o guardar
`gclid` al registro y subir conversiones offline. ~medio día + setup de la cuenta
de Google Ads (tuyo).

### 4. Dependencia dura: deliverability del correo
El registro manda un OTP de 6 dígitos por correo. Si la entregabilidad está
floja (PENDIENTE de verificar — ver `memory/correo-semanal-y-winback`), los
códigos caen en spam → registro roto → gasto de anuncio tirado. **Verificar
inbox vs spam ANTES de cualquier paid.**

## Lo que YA está listo (no rehacer)
- Landing pública en `/` con captura de correo a waitlist.
- Medición de TTV automática (`first_outfit_ttv`) y "me lo puse" (`worn`).
- Admin visual + "ver como" para observar qué hace el tráfico nuevo.

## Orden de construcción (si se aprueba paid)
1. Verificar deliverability (bloqueador #4) — sin código, solo revisar Postmark.
2. Decidir #1 (A/B/C). Si C: registro abierto + cap diario.
3. Captura de UTM/gclid (#2).
4. Conversión a Google (#3) + setup de cuenta.
5. Campaña chica con presupuesto tope diario y un solo ad group para leer señal.

## Costo que se vuelve real con paid (flag)
Cada usuario que completa onboarding genera 1 avatar (Gemini) + varios outfits
(Opus) = costo de API por usuario. En tráfico orgánico es ruido; a escala de
paid es una línea de costo que hay que vigilar junto al CAC.
