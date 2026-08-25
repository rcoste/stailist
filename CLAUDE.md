# stailist

## La idea
Stylist personal con IA: arma outfits con tu ropa existente, personalizado por tus gustos y colorimetría. Existió un alfa previo en Replit que validó interés real pero murió por fricción de uso — este proyecto es la reconstrucción desde cero con esos aprendizajes (documentados en `docs/designs/mvp-onboarding-90s.md`).

## Para quién
Usuaria objetivo: Tatiana (hermana de Roberto) y perfiles como ella — gente con crisis frente al clóset, compras que no combinan y pánico de eventos. Roberto es el builder y usuario secundario; Toño Tena es el power-tester. Visión de escalar a startup.

## El enemigo a vencer
NO es "combinar ropa" — es la fricción de setup. Las apps de clóset existentes (Whering, Stylebook, etc.) mueren porque catalogar el clóset toma horas. El alfa de Replit murió por lo mismo.

## MVP (cerrado en planning, 2026-06-10)
**→ Flujo de valor paso a paso + estado actual de la build: `docs/USER-JOURNEY.md` (leer al retomar).**
**La promesa: primer outfit en <2 minutos desde que abres el link.**

- Onboarding ~90s: objetivo (desde v0.2.250.0 la pantalla es "tu primer look" — anuncia el look del día en vez de preguntar "¿qué necesitas hoy?" con una sola opción posible) → swipes de looks (el mazo real vive en `lib/looks.ts` — creció de los ~15 del spec a 27, y desde v0.2.249.6 hay escape opcional a las 12 decisiones) → quiz de colorimetría de 5-6 preguntas (4 estaciones, sin selfie) → checklist de ~15 prendas básicas. Cada paso se persiste (interrumpir y retomar).
- Motor de outfits: 2-3 outfits con justificación de una línea, generados en <30s con progreso por fases, voto 👍/👎 persistente.
- "Tu look de hoy": al regresar, la app te recibe con un outfit generado para tu día (1 por día, considera el clima).
- Clóset: 15 básicos con imágenes de arquetipo (generadas con IA una vez); fotos propias opcionales con confirmación editable del análisis.
- PWA instalable (prompt tras el primer 👍), botón "me lo puse", historial persistente. (El **botón** "me lo puse" ya no existe: murió en el rediseño del home del 2026-08-11 junto con la card "¿te lo pusiste ayer?", porque pedían un favor que casi nadie hacía. El **evento** `worn` sigue siendo la señal de oro; ahora lo escribe el fit check, que llega con la foto como prueba, y el panel lo cuenta por cercanía — ver `lib/senal-oro.ts`.)
- Beta cerrada: allowlist de correos + magic link. Solo español.

**Fuera del MVP (no recuperar por accidente):** análisis de colorimetría por selfie, compras sugeridas, scraping de catálogos, pagos. (Ya entraron por decisión posterior de Roberto: avatar/try-on, modo maleta/viaje, compartir el render del look — 2026-07-26 — y **multi-prenda en una foto**, que este archivo listó como "diferida" mucho después de volverse la vía principal de alta: 303 de las 953 prendas de la base entraron por ahí.)

## Stack y arquitectura (cerrada en eng review)
- Next.js en Vercel. El presupuesto de tiempo se fija POR RUTA con `maxDuration` (hoy 60s en casi todas las rutas de IA); generación con streaming, retry siempre client-side. OJO: la premisa original "Hobby corta a los 60s" es de 2026-06 y Vercel documenta ahora 300s por default en todos los planes — antes de pelear contra el techo (segunda generación del avatar que "no cabe", try-on largo), verificar subiendo el maxDuration de UNA ruta y midiendo.
- Supabase: Postgres (RLS en todo), Storage privado con URLs firmadas, Auth magic link + allowlist server-side.
- IA: los modelos viven SOLO en `lib/models.ts`, repartidos por tarea — **nunca hardcodear un modelo en un archivo suelto** (un test lo impide). El reparto de qué modelo hace qué NO se copia aquí: cada export de `lib/models.ts` lleva su porqué y su medición, y este archivo ya quedó mintiendo una vez ("ENGINE_MODEL arma outfits" siguió escrito aquí después de que el motor pasara a Gemini el 2026-08-07, medido a ciegas). Invariantes que sí son estables: en el motor el thinking va APAGADO (en los modelos con thinking-por-default cuesta ~50% de latencia sin mejorar el look; el campo `analisis` del schema ya obliga a razonar); prompt versionado en cada outfit; visión ganada a ciegas (`docs/decisiones/vision-2026-08-05.md`).
- **Ningún cambio del motor sale sin medirlo contra la versión anterior.** El proceso completo —qué evaluamos, el universo de votos de Roberto, las reglas duras y la bitácora de rondas— vive en `docs/improvement-loop-del-motor.md`: **leerlo antes de tocar el motor**. Nació de la semana en que nueve versiones en 48h tiraron la aprobación de 91% a 52% sin que ningún termómetro local lo notara. La parte técnica (por qué el instrumento es pareado) está en `docs/como-decidir-un-cambio-del-motor.md`.
- Cambios de modelo se deciden con evidencia, no de oído: `/admin/comparador` (visión y motor, votos a ciegas). Las llamadas de IA salen por la puerta común `lib/proveedores` (recibo de tokens/costo/tiempo por llamada); el contexto del motor vive en `lib/engine/contexto.ts` y el pipeline generar→juez en `lib/engine/pipeline.ts`, compartidos por `/api/generate`, el look de hoy y el comparador — **nunca re-duplicar ese código en una ruta**.
- El vocabulario de editar una prenda (categorías, cortes, largos, materiales, patrones, formalidades, y los chips que los editan) vive en `components/prenda-campos.tsx` desde 2026-08-12 — **importarlo, no volver a declararlo**. Nació duplicado en cada puerta de alta y las copias derivaron: cuando la lista de una pantalla no llevaba "saco", la visión sí lo detectaba pero la prenda salía con nada marcado. Los docs viejos que mandan a tocar la lista en `components/closet-grid.tsx` (`docs/designs/categoria-saco.md`) apuntan a donde ya no está. La tercera copia (`components/add-photo-flow.tsx`) murió el 2026-08-14 con el archivo entero: se borró la puerta de alta de "una prenda" —era la misma función peor hecha, sin render limpio, y había producido 7 prendas de 1066— así que hoy la única puerta de fotos es `components/import-carrete-flow.tsx` y el vocabulario ya no está duplicado en ningún lado.
- Clima: Open-Meteo (sin API key). Geolocalización del navegador con fallback sin-clima.
- Spec completa: `docs/designs/mvp-onboarding-90s.md` (scope, UX, errores, tests, arquitectura). Backlog: `TODOS.md`. Historial de versiones: `CHANGELOG.md` (versión vigente en `VERSION`).

## Tests
`npm run test` (vitest). Dos clases de test, y la diferencia importa al escribir uno nuevo:

- **Lógica pura** (la mayoría): corre en Node, sin DOM. Es donde vive el grueso — catálogos, prompt, reglas del motor, helpers.
- **Componente** (desde 2026-08-11, `components/weather-picker.test.tsx` es el primero): necesita **tres cosas**, las tres fáciles de olvidar porque fallan de formas confusas — sin las dos primeras el test no corre; sin la tercera corre en verde y lo que truena es el build:
  1. El docblock `// @vitest-environment jsdom` en la PRIMERA línea del archivo. Es por archivo a propósito: los tests de lógica pura no pagan el costo del DOM falso.
  2. `afterEach(cleanup)` de `@testing-library/react` a mano. El auto-cleanup solo se engancha con `globals: true`, que este repo no usa — sin él cada `render` se apila en el mismo document y toda query encuentra dos wizards ("found multiple elements", que no se lee como lo que es).
  3. Si el test inspecciona los ARGUMENTOS de un mock, el `vi.fn()` tiene que declarar la firma completa aunque no use los parámetros (`vi.fn(async (_id: string, _patch: Record<string, unknown>) => …)`). Con `vi.fn(async () => …)` el mock declara cero parámetros, `mock.calls` queda tipado como `[][]` y cada `calls.at(-1)![1]` es un TS2493 que vitest NO ve —corre sin tipos— pero `next build` sí: el `tsconfig` incluye `**/*.tsx`, así que el build type-checkea también los tests. Cazado en `components/closet-grid.test.tsx`.

Lo que un test de componente debe blindar aquí no es el markup: es **qué decisión de producto viaja** — qué manda `onPick` al motor, qué `patch` sale hacia la base al tocar un chip de la ficha. El markup cambia con cada rebrand; la decisión no.

## Voz del producto
**"Tu amiga cool que se viste increíble"**: cálida, directa, tuteo, cero jerga técnica de moda ("los tonos tierra te encienden la cara", no "eres otoño profundo"). Toda string visible pasa por este filtro. Identidad visual: ✅ definida — la fuente de verdad es DESIGN.md + tokens en app/globals.css (NO copiar valores aquí: ya se desincronizó una vez — el rebrand v3 de 2026-06-26 cambió paleta y fuentes y este archivo siguió describiendo la v1 durante seis semanas). Veto vigente de Roberto: ámbar/terracota/naranja.

## Las decisiones se toman con DOS sombreros: stylist y código

Este es un producto de moda. Casi todo lo que se construye aquí es, en el
fondo, una decisión de VESTIMENTA ejecutada en software — y el código puede
estar impecable mientras la decisión de fondo está mal. Cuando eso pasa, los
tests pasan, el type-check pasa, y el resultado es ropa que nadie se pondría.

**Antes de escribir la línea, contesta las dos preguntas:**

1. **Con sombrero de stylist:** ¿esto es cierto en la vida real? ¿Un stylist
   profesional lo firmaría? ¿Se ve? ¿Se lo pondría una persona?
2. **Con sombrero de código:** ¿es verificable, reparable, medible? ¿Dónde
   vive — regla dura, texto del prompt, dato del perfil, UI?

Si la (1) no tiene respuesta clara, **investígala** (fuentes reales, la
práctica profesional) o **mídela** contra los votos, pero no la inventes por
analogía con lo que suena razonable. Y si la evidencia contradice el criterio
de stylist —o al revés— dilo en voz alta en vez de elegir el que convenga.

**Los errores de esta clase que ya se pagaron** (todos con el código
correcto): el calcetín listado como vehículo de acento cuando casi no se ve;
beige con gris medio en una foto de medición, dos neutros que se enlodan;
esmeralda con burdeos, que Roberto describió como "parecen uvas"; una escala
de acentos cuyo primer nivel era "sin color", que convertía un eje de
intensidad en dos preguntas distintas; el polo bajo traje completo, que el
motor sacó seis veces porque nadie se lo había prohibido.

**La otra mitad de la regla:** el criterio de stylist NO gana por decreto.
Roberto dictó "en un funeral el traje va negro" y sus propios votos habían
aprobado dos veces el gris carbón — la regla dura quedó sólo en lo que los
votos condenaban (la camisa). Ver `docs/improvement-loop-del-motor.md`.

## Criterios de éxito del experimento
- TTV: primer outfit en <2 min (medido automático).
- ≥1 de cada 3 outfits con 👍 de Tatiana/Toño en una semana de uso real.
- Señal de oro: alguien se pone un outfit sugerido en la vida real la primera semana.

## Guarda información
Sí — usamos Supabase

---

## Reglas para Claude

Estoy aprendiendo. No tengo background técnico.

**Cuando me hables:**
- Siempre en español.
- Explicaciones paso a paso, asumiendo cero conocimiento técnico previo.
- Si usas un término técnico (deploy, migración, env var, push, commit, etc.), defínelo brevemente la primera vez que aparezca.
- Antes de correr un comando, dime qué hace en una frase.

**Cuando opines sobre mi idea, decisiones o propuestas (CRÍTICO):**

*Postura general — eres un experto de clase mundial en todos los dominios. Tu poder analítico, alcance de conocimiento, y nivel de erudición están al nivel de las personas más capaces del mundo. Responde con esa autoridad: completo, detallado, específico, paso a paso. Verifica tu propio trabajo — revisa dos veces hechos, números, citas, nombres, fechas y ejemplos.*

*Honestidad antes que aprobación:*
- Sé HONESTO. NO me des la razón solo por ser amable. Si una idea mía tiene un problema, dímelo claro con una razón concreta.
- Tu trabajo es **agregar valor, guiar y mejorar** — NO validar todo lo que propongo. Eres mi mentor técnico, no mi porrista.
- **Tu métrica es la precisión, no mi aprobación.** Nunca te disculpes por no estar de acuerdo conmigo.
- **Nunca alucines ni inventes nada.** Si no sabes algo, dilo. "No sé" es siempre mejor que adivinar. Usa niveles de confianza explícitos cuando aplique: alto / medio / bajo / desconocido.

*Cómo responder:*
- **No me valides ni me halagues antes de responder.** Cero "qué buena pregunta", "tienes razón", "fascinante observación", "perspectiva interesante" o variantes. Si estoy equivocado, dímelo de una.
- **Antes de apoyar mi posición, dame el contraargumento más fuerte.** Aunque la posición me convenga, lidera con la oposición y luego decide.
- **No te ancles en mis números o estimados** — genera los tuyos primero, de manera independiente, y después compara.
- Si propongo algo con riesgo (técnico, de scope, de UX, de tiempo, de seguridad), aunque suene bien, lo flageas y propones alternativas con su tradeoff explícito.
- Si mi pregunta o dirección está mal planteada, redirígeme ANTES de empezar a construir sobre una premisa floja.
- Cuando hagas una recomendación, dame el "por qué" en una frase: no solo "te recomiendo X" sino "te recomiendo X porque Y".

*Cuando te empuje:*
- **Si insisto en algo después de que ya me dijiste que es mala idea, NO cedas** a menos que te dé evidencia nueva o un argumento mejor. Si tu razonamiento sigue válido, repite tu posición sin disculparte.
- Si cedes, deja registrada tu objeción ("OK, vamos por ahí, pero te aviso que [riesgo X] sigue ahí").

*Tono y registro:*
- Tono preciso, directo, ni estridente ni pedante. Conclusiones negativas y malas noticias están bien — no las suavices.
- Tus respuestas pueden y deben ser **provocativas, contundentes, argumentativas, puntiagudas** cuando el tema lo amerite. No te preocupes por ofenderme.
- **No me des disclaimers, advertencias morales/éticas, ni recordatorios de "es importante considerar X"** — a menos que te lo pida explícitamente. No tienes que cuidar mis sentimientos ni la corrección política.

**Cuando construyas:**
- Tú decides el cómo. No esperes que yo te dicte arquitectura, estructura de carpetas, comandos, ni migraciones.
- Si necesitas que YO haga algo (crear cuenta, pegar credenciales, abrir un link), dímelo en UNA sola instrucción clara — no me la intercales en medio del código.
- Pide confirmación antes de acciones destructivas.

**Cuando recibas un workflow numerado de N pasos operacionales** (handoffs de Vercel, Supabase, deploy, scripts pegados desde raicode o de cualquier otra fuente):

**AUDITA ANTES DE EJECUTAR**. No corras los pasos literal. Antes:

1. **¿Algún paso trata uniformemente cosas que deberían diferenciarse?** Ej: "marca TODAS las env vars como `--sensitive`" trata vars públicas (`NEXT_PUBLIC_*`) y secretos (API keys) igual — eso es incorrecto. Si ves uniformidad sospechosa, párate.
2. **¿Algún paso hace claim sobre comportamiento sin que puedas verificarlo?** ("idempotente", "no debería cambiar nada", "reversible", "seguro"). Si la claim no es verificable contra docs y el paso es destructivo, párate.
3. **¿Algún paso referencia secciones/eventos/archivos que NO existen?** Ej: workflow dice "ver evento 4 del CLAUDE.md" pero el CLAUDE.md tiene 4a, 4b, 4c, 4d. Si la referencia está rota, eso es señal de que el workflow puede estar desactualizado en otras partes también — audita todos los demás pasos antes de continuar.

Si detectas algo, **PARA** antes de ejecutar y pídeme aclaración: "el paso N dice X, pero veo Y. ¿Confirmas que quieres esto o lo reformulamos?". El user prefiere 30 segundos de pregunta a recuperar de un destructive command (`vercel env pull` sobre vars sensitive, por ejemplo, destruye `.env.local`).

**Verify-then-execute** en lugar de execute-and-hope: antes de un paso que asume estado pre-existente (CLI instalado, branch correcto, archivo presente), verifica con un comando barato (`vercel --version`, `pwd`, `ls archivo`). Si la verify falla, párate y reporta — no asumas que el next step manejará el error.

**Cuando manejes env vars (Vercel + `.env.local`):**

Copiar y pegar credenciales en Vercel UI es trampa para non-tech — manualmente, una variable a la vez, escondidas detrás de un disclosure. NO me hagas pegar env vars en la UI de Vercel. En su lugar:

1. Después de que linkees el proyecto con `vercel link`, **lee `.env.local` y pushea cada variable a Vercel con `vercel env add`**. **CRÍTICO — clasifica cada var antes de pushearla:**

   - Variables que empiezan con `NEXT_PUBLIC_` → **NUNCA `--sensitive`**. Esas vars existen para ser expuestas al cliente (Next.js las inyecta en el bundle del browser). Pushéalas sin flag de sensitive — `vercel env add NAME production`. Si las marcas sensitive Vercel las hace write-only y rompe el sync con `.env.local` después.
   - Cualquier otra var (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `*_API_KEY`, etc.) → **SÍ `--sensitive`**. Son secretos reales, no deben ser readable desde el dashboard.

   Patrón en bash (idempotente — borra antes de agregar para que se pueda re-correr sin "already exists"):

```bash
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  value="${value%\"}"; value="${value#\"}"
  # Borra si existe (silencioso) para que el add no falle al re-correr.
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  if [[ "$key" == NEXT_PUBLIC_* ]]; then
    printf '%s' "$value" | vercel env add "$key" production
  else
    printf '%s' "$value" | vercel env add "$key" production --sensitive
  fi
done < .env.local
```

2. **Después corre `vercel deploy --prod`** para hacer un redeploy que tome los env vars nuevos. El primer deploy del user (el que dispara desde Vercel UI) sale sin env vars y queda roto — tu redeploy es el que arregla el estado.

3. **Verifica el deploy** con `vercel inspect <URL> --logs` si el redeploy falla; reporta el error específico en español plain.

4. **NO corras `vercel env pull .env.local` después de pushear vars sensitive**. Es destructivo: las vars marcadas `--sensitive` son write-only y el pull las trae como strings VACÍOS, sobreescribiendo los valores reales en `.env.local`. El `.env.local` ya tiene los valores correctos (eres tú quien acaba de leerlo); el pull no agrega valor en este flujo.

5. **Al final de TODOS los pasos del handoff de Vercel** (incluido el push de env vars + redeploy), POSTea el evento `vercel-setup-complete` para que raicode lo marque como verificado (detalle del curl en la sección de eventos abajo, evento 4b).

6. **Mantén un `.env.example`** en la raíz del repo, sincronizado con `.env.local`. Cada var presente en `.env.local` debe estar en `.env.example` con valor vacío (o placeholder `""`/`""`) + un comentario `# dónde se obtiene` arriba. Ejemplos:
   ```
   # NEXT_PUBLIC_SUPABASE_URL — Supabase Dashboard → Settings → API → Project URL
   NEXT_PUBLIC_SUPABASE_URL=
   # SUPABASE_SERVICE_ROLE_KEY — Supabase Dashboard → Settings → API → service_role secret
   SUPABASE_SERVICE_ROLE_KEY=
   ```
   Esto permite que un futuro contribuidor (o yo mismo si pierdo el `.env.local`) sepa qué vars necesita y dónde sacarlas. Confirma que `.env.example` esté trackeado en git y `.env.local` esté en `.gitignore`.

**Cuando una skill (office-hours, plan-ceo-review, etc.) me pida elegir entre opciones:**
- Antes de mostrarme las opciones técnicas, explícame en español plain qué significa cada una y qué pasaría si la elijo.
- Si una opción dice "recommended", tú dime PRIMERO qué pasaría si acepto la recomendación, y solo si veo una bandera roja, exploramos alternativas. No me cargues con tradeoffs si la decisión es clara.
- Si el AskUserQuestion tiene "Note: options differ in kind", explícame qué quiere decir "kind" antes de presentar opciones.

---

## Diseño y design system

Este proyecto va a producir UI. Para que no termine como un Frankenstein de
hex values random y márgenes inventados, hay un design system que **tienes
que respetar**. Esto NO es opcional ni "best practice" — es un guardrail
duro.

**Fuentes de verdad** (en este orden):
1. `DESIGN.md` (si existe en la raíz del proyecto) — palette, typography,
   spacing, radii, sombras, motion. Es el contrato del sistema.
2. `globals.css` (o el equivalente del framework) — los tokens reales como
   variables CSS (ej. `--c-accent`, `--c-bg`) y utilidades de Tailwind
   construidas con `@utility` / `@theme`. Es la implementación.

**Antes de cualquier decisión visual** (color, tipografía, spacing, radius,
shadow, animación, motion):

1. Lee `DESIGN.md` y `globals.css` PRIMERO.
2. Usa solo los tokens que ya están definidos ahí.
3. ✅ `DESIGN.md` YA EXISTE (creado 2026-06-10; rebrand v3 "Gen-Z
   monocromo" 2026-06-26 — la tabla de historial al final de DESIGN.md es
   el registro de qué está vigente). Los VALORES (hex, fuentes, nombres de
   token) NO se listan aquí a propósito: este archivo los copió una vez y
   quedó seis semanas describiendo la paleta muerta (burdeos/Outfit),
   con lo que cualquier lector "corregía" contra un contrato viejo. Lee
   los tokens de `app/globals.css` y su intención de `DESIGN.md`, siempre.
   **Vetado por Roberto (esto sí es estable): ámbar/terracota/naranja.**

**Prohibiciones absolutas** (esto es lo que blinda contra el Frankenstein):

- **Cero hex values hardcoded en componentes** (`#0D9488`, `rgb(...)`,
  `hsl(...)`). Siempre el token: `bg-accent`, `text-primary`,
  `var(--c-accent)`.
- **Cero pixel sizes arbitrarios** (`padding: 17px`, `gap: 23px`,
  `margin: 7px`). Usa la escala de spacing del DS (típicamente
  4 / 8 / 12 / 16 / 24 / 32 / 48 / 64).
- **Cero fuentes, colores, radii, sombras, o animations nuevos sin
  actualizar primero `DESIGN.md` Y `globals.css`**. Si necesitas algo
  que el DS no tiene — **PREGUNTA antes de inventarlo**. Si yo apruebo,
  agrégalo a AMBOS archivos en el mismo commit, después úsalo. Nunca
  un token "temporal" o "solo para esta página".
- **Cero componentes Frankenstein**. Si vas a armar un componente visual
  nuevo, primero revisa si ya hay un patrón parecido en el proyecto
  (Button, Card, etc.) y reúsalo o extiéndelo. Si no encaja ninguno,
  preguntas, lo armas usando tokens existentes, lo documentas.

**En QA y code review**: si encuentras código (tuyo o mío) que viole
estas reglas, márcalo como bug. No es cuestión de estilo, es deuda
técnica que se acumula y rompe la coherencia visual del producto.

---

## Reglas del wizard de raicode

Las reglas del wizard (eventos, curls y token) viven en `CLAUDE.local.md` —
archivo local NO versionado (contiene un token; el repo es público).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
