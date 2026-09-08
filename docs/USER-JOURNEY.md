# stailist — User Journey (referencia canónica)

> El flujo completo de valor, paso a paso, como lo vive la usuaria, **verificado
> contra el código y la base de producción el 2026-09-07** (v0.2.306.0).
> La versión anterior de este archivo llevaba desde junio diciendo "magic
> link", "15 fotos", "15 básicos", "prompt v24", "visión con Claude" y "cero
> usuarios" — nada de eso era cierto. Si algo de aquí deja de coincidir con el
> código, gana el código y este archivo se corrige.
>
> La spec original (`docs/designs/mvp-onboarding-90s.md`) es HISTÓRICA:
> describe lo que se planeó el 2026-06-10, no lo que existe.

## La promesa

Era "primer outfit en <2 minutos". **Se retiró de la app el 2026-09-05** (B0 de
la auditoría pre-release): el TTV real medido desde que arranca el onboarding
(`profiles.onboarding_started_at`, migración 0152) es de ~8 minutos, y Roberto
decidió NO recortar el onboarding ("lo veo bien, va generando valor"). Hoy la
app dice "en unos minutos". La objeción queda registrada en
`docs/auditorias/PLAN-de-ataque-2026-09-01.md`.

## Primera visita — 9 pantallas

| # | Pantalla | Qué pasa | Dónde vive |
|---|---|---|---|
| 1 | **Login** | Correo → llega un **código de 6 dígitos** (OTP de Supabase, sin contraseña ni magic link). **Registro abierto desde 2026-09-06**: cualquiera entra. El freno es el ritmo: 3 códigos por correo y hora, 10 por IP (`lib/ritmo-login.ts`). La `allowlist` sólo sirve para mandar invitaciones desde `/admin/acceso` | `app/login/` |
| 2 | **Género** | hombre / mujer. Decide qué segmento de la biblioteca ves (los cortes y renders son distintos por segmento; unisex = misma prenda) | `app/onboarding/genero/` |
| 3 | **Edad** | Rango, no fecha (`lib/edad.ts`). 13-17 → correo del tutor y link público de consentimiento; mientras no confirme, subir fotos queda bloqueado en el servidor. Inmutable una vez puesta (trigger, migración 0082) | `app/onboarding/edad/` |
| 4 | **Gustos (swipes)** | **27 cartas** de looks (`lib/looks.ts`: 25 unisex + coquette y "de salir" sólo mujer → 27 mujer / 25 hombre), fotos generadas con `gen-looks-genz.mjs`. El mazo va en round-robin por familias para que las primeras contrasten. **Escape opcional a las 12 decisiones** (v0.2.249.6, se guarda `escape` para medir si se usa). Salen 8 taste tags calibrados por rareza y un arquetipo de estilo | `app/onboarding/gustos/` |
| 5 | **Colorimetría** | Quiz de **6 preguntas** (`QUIZ` en `lib/colorimetria.ts`) → 4 estaciones con sub-estaciones. Opción de foto con ensemble Claude+Gemini. SIN selfie obligatoria. Termina en el reveal de la paleta | `app/onboarding/colorimetria/` |
| 6 | **Acentos** | Apetito de color: discreto / medio / protagonista (`docs/designs/pantalla-apetito-acentos.md`). Tiene "mejor luego" | `app/onboarding/acentos/` |
| 7 | **Clóset exprés** | Checklist de básicos con imagen de arquetipo: **57 para mujer** (49 + 8 unisex), **53 para hombre** (45 + 8). Pestaña **Trajes** = las dos piezas en una tarjeta (`attrs.conjunto`); quien sólo tiene el saco lo marca en Sacos. CERO fotos obligatorias | `app/onboarding/closet/` |
| 8 | **Tu primer look** | Desde v0.2.250.0 anuncia que se arma el look de tu día a día (fija `last_objective`); las ocasiones se piden después desde "crear un look" | `app/onboarding/objetivo/` |
| 9 | **💥 Wow** | 2-3 looks con justificación de una línea, streaming NDJSON con frases de datos reales de la usuaria (`lib/gen-frases.ts`). Voto 👍/👎. Tras el primer 👍, prompt de instalar la PWA (`notifyFirstLike`, una sola vez) | `app/onboarding/wow/` + `app/api/generate/` |

**Orden y persistencia:** género y edad son pre-pasos; `profiles.onboarding_step`
lleva la cuenta de 4 → 9 (`lib/onboarding.ts`, 0 = gustos … 5 = completo).
Interrumpir en el paso N y volver = retomas en el paso N; no se puede saltar por URL.

## El motor (lo que arma el wow y todo lo demás)

- **Prompt v73** (`lib/engine/prompt.ts`), versionado en cada outfit. v74 se midió y se descartó.
- **Generador: Gemini 3.5 Flash** (`MODELO_MOTOR` en `lib/models.ts`, ganado a ciegas el 2026-08-07: mismos looks, -42% costo, -44% latencia). **Juez: Sonnet 5** (`MODELO_JUEZ`). `ENGINE_MODEL` (Opus 5) ya NO arma outfits: queda para cápsula ideal y viaje.
- Contexto en `lib/engine/contexto.ts`, pipeline generar→juez en `lib/engine/pipeline.ts`; los comparten `/api/generate`, el look de hoy y `/admin/comparador`. Structured outputs con enum de `item_ids` (no puede inventar prendas).
- **Ningún cambio del motor sale sin medirse** contra la versión anterior con el instrumento pareado: `docs/improvement-loop-del-motor.md`. El loop está en pausa desde 2026-08-25.
- Cuotas diarias por persona (`lib/cuotas.ts`): 20 looks, 5 avatares, 15 try-ons, 120 fotos leídas; freno de $5 por persona; `MOTOR_PAUSADO` como kill switch. Cada llamada deja recibo en `ai_calls` (`/admin/ia`), imágenes incluidas desde v0.2.301.0.

## Día 2 en adelante — el hábito

| # | Paso | Qué pasa | Dónde vive |
|---|---|---|---|
| 10 | **Inicio** | Pestaña "inicio" (`/hoy`). Con look del día se abre en él (1/día, clima Open-Meteo con fallback manual; se genera en background y sobrevive cerrar la app). Sin look: "¿qué look armamos?" con el CTA "crear un look", que abre el wizard de planes (ocasión, fecha, clima de la hora en que te vistes). Barra inferior: inicio · clóset · diario | `app/hoy/`, `components/tab-bar.tsx` |
| 11 | **Fit check** | Subes la foto del outfit puesto → el espejo opina y escribe el evento `worn`. **Es la única fuente de la señal de oro**: el botón "me lo puse" murió en v0.2.223.0 (<10% lo usaba). `/admin` la cuenta por cercanía: fit check a ≤24h de un look generado (`lib/senal-oro.ts`) | `app/api/espejo/` |
| 12 | **Clóset crece** | La única puerta de fotos es `components/import-carrete-flow.tsx` (**varias prendas en una foto** — 303 de 953 prendas entraron así). Visión con **Gemini 3.1 Flash-Lite** (`VISION_MODEL`, ganado a ciegas: `docs/decisiones/vision-2026-08-05.md`) → confirmación editable con el vocabulario de `components/prenda-campos.tsx` → render limpio. Falla la lectura → captura manual, nunca bloquea | `app/closet/`, `app/api/analizar-prenda/` |
| 13 | **La app aprende** | `lib/engine/taste-signal.ts` lee 👍/👎 con razón, `worn` y "otro look" y los inyecta como señal suave al generador y al juez. Regla de variedad de 14 días aparte | `lib/engine/` |
| 14 | **Te busca** | Correo semanal (lunes) y correo de reenganche a las 48h sin volver, **opt-in** desde B2 (migración 0153). Baja con un clic | `app/api/cron/` |

## Lo que superó al MVP (construido y en prod)

Avatar + try-on multi-vista (Gemini imagen) · Viaje (wizard multidestino, cápsula,
clima histórico, looks, empacar) · Esenciales/cápsula ideal · Colorimetría por
foto · Vetos, silueta, "tu estilo en tus palabras" · Wizard de planes con look por
adelantado · Compartir el pasaporte y el render del look · Wishlist · Privacidad,
términos, borrar cuenta, editar edad (B2) · Panel `/admin` (actividad, IA,
comparador, evales, "ver como").

**Fuera del MVP, sigue fuera:** compras sugeridas, scraping de catálogos, pagos.

## Quién lo usa de verdad (2026-09-07)

25 perfiles, 24 con onboarding completo. Toño nunca entró; Tatiana está
partida en 3 cuentas; las usuarias reales son Andy, Islam y **Val**, la más
activa y la única nueva con señal de oro (2 fit checks). Sus 👎 son "los
colores" y apuntan al guiño de la paleta (candidata del loop, en pausa). La
premisa del setup está refutada: las usuarias SÍ catalogan (31-81 prendas) y
aun así se van en 1-6 días; el cuello es la retención, no el alta.

## Criterios de éxito (cómo se miden hoy)

- **TTV**: desde `onboarding_started_at` hasta el primer look (`/admin`). Real: ~8 min.
- **Aprobación**: ≥1 de cada 3 looks con 👍. El voto es <10% de los looks; el instrumento serio es el pareado del improvement loop.
- **Señal de oro**: fit check a ≤24h de un look generado (`lib/senal-oro.ts`, ventana 90 días, sólo `source = daily`).
