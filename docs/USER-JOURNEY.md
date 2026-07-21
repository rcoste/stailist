# stailist — User Journey (referencia canónica)

> El flujo completo de valor, paso a paso, como lo vive la usuaria.
> Fuente: planning 2026-06-10 (spec completa en `docs/designs/mvp-onboarding-90s.md`).
> **La promesa: primer outfit en <2 minutos desde que abres el link.**

## Primera visita — onboarding (~90 segundos)

| # | Paso | Qué pasa | Tiempo | Estado |
|---|------|----------|--------|--------|
| 1 | **Login** | Correo → si está en la allowlist, llega magic link (sin contraseña). Si no: mensaje "beta por invitación" | — | ✅ construido + QA local (falta prueba con buzón real) |
| 2 | **Objetivo** | "¿Qué necesitas hoy?" — 5 opciones cerradas: día a día / oficina / evento / viaje / refrescar estilo. Un tap | 10s | ✅ construido + QA local |
| 3 | **Swipes de gustos** | ~15 fotos de looks; ❤️/✕ por gesto O botones (desktop + accesibilidad). Genera el taste vector (tags estéticos → contexto del prompt, sin ML) | 30s | ✅ construido: 25 estilos mujer / 24 hombre (coquette es women-only) con fotos reales en `public/looks/` (49 imágenes) → `computeTasteTags` saca 8 tags calibrados por rareza (√DF), en orden de fuerza |
| 4 | **Quiz de colorimetría** | 5-6 preguntas (piel, ojos, cabello, qué colores le favorecen) → paleta de 4 estaciones + regla near-face. SIN selfie | 20s | ✅ construido + QA local |
| 5 | **Clóset exprés** | Checklist de 15 básicos ("tengo esta, esta…"). CERO fotos obligatorias — el arma contra la fricción que mata a la competencia | 30s | ✅ construido + QA local (lista de básicos pendiente de validación por Roberto) |
| 6 | **💥 Momento wow** | 2-3 outfits con justificación ("los tonos tierra te encienden la cara"), generados <30s con progreso por fases ("leyendo tu clóset… combinando colores…"). Voto 👍/👎 | <30s | ✅ construido y cableado: motor `lib/engine/` (prompt v24 + structured outputs + streaming NDJSON + juez de 2ª pasada + votos + TTV), `ANTHROPIC_API_KEY` configurada |

**Regla dura:** cada paso se persiste — interrumpir en el paso 3 y volver = retomas en el paso 3.
**Tras el primer 👍:** prompt de instalación PWA ("agrégame a tu pantalla de inicio") — UNA sola vez, en el pico emocional.

## Día 2 en adelante — el hábito

| # | Paso | Qué pasa | Estado |
|---|------|----------|--------|
| 7 | **"Tu look de hoy"** | Al abrir: outfit ya generado para su día (1/día, considera clima vía Open-Meteo). Votar, "otro look", "me lo puse" | ✅ construido y cableado: genera vía `/api/look-of-day` en background + polling (sobrevive cerrar la app), persistencia 1-look/día (índice único `user_id`+`look_date`, migración 0001), clima Open-Meteo + fallback manual, acciones reales ("otro look" con razones, "me lo voy a poner"=`worn`, favorito, try-on integrado) |
| 8 | **Clóset crece a su ritmo** | Fotos opcionales → IA detecta atributos → confirmación editable en un tap. Falla la detección → captura manual, nunca bloquea | ✅ construido: upload en `/closet` (`add-photo-flow.tsx`) → `/api/analizar-prenda` (Claude Opus visión extrae 7+ atributos; desde v21 también material, patrón y color secundario, validados server-side vía `lib/prenda-atributos.ts`) → confirmación editable antes de guardar |
| 9 | **La app aprende** | Cada voto/uso se persiste y entra como contexto en generaciones futuras | ✅ construido (2026-06-23, prompt v16): `lib/engine/taste-signal.ts` lee el feedback real (se lo puso=`worn`, 👍/👎 con su razón, "otro look" con razón) y lo inyecta como señal SUAVE al generador **y** al juez; el motor se inclina hacia lo que gustó y se aleja de lo rechazado, generalizando el patrón (no copia looks). La regla de variedad de 14 días (anti-repetición) sigue aparte |

## Estado actual del código (2026-06-23; motor/viaje actualizados 2026-07-21, v24)

> Actualizado verificando cada afirmación contra el código. El MVP del journey está **completo y cableado**; el proyecto ya superó al MVP con features extra (avatar/try-on, viaje, colorimetría por foto). El tapón real ya NO es build — es el experimento (cero usuarios todavía).

**Fundamentos**
- ✅ Repo + scaffold Next.js + design system (DESIGN.md + tokens en globals.css) + logo burdeos
- ✅ Supabase: schema con RLS, allowlist, bucket privado de Storage con URLs firmadas, clients escritos, `scripts/db.mjs` para migraciones
- ✅ Auth: magic link + allowlist server-side (UI **y** trigger en DB que bloquea signups directos), proxy protege rutas, "/" enruta según `onboarding_step`
- ✅ Infra de correos en prod: magic link nativo Supabase + Postmark, transaccionales por Postmark API, dominio stailist.co (muro resuelto 2026-06-18)

**Camino crítico del journey (pasos 1-9)**
- ✅ Onboarding completo construido y QA'd. Orden real (`lib/onboarding.ts`): género (pre-paso, no cuenta) → gustos/swipes → colorimetría → básicos (clóset) → objetivo → wow. El perfil permanente va primero; el objetivo —que es del momento— justo antes de generar. Persistencia por paso (interrumpir y retomar; no se puede saltar por URL)
- ✅ Motor de outfits (`lib/engine/`): prompt **v24** versionado (datos ricos por prenda — material/patrón/color secundario — + borrador de razonamiento interno antes de comprometer outfits; desde v23 el generador conoce el género — antes solo el juez — con reglas de estilismo para vestido/falda; desde v24 coherencia de señal: taste tags calibrados √DF en orden de fuerza, claves de estilo de las fotos de referencia y "tu estilo en tus palabras" entran al prompt), structured outputs con enum de `item_ids` (imposible inventar prendas), juez de 2ª pasada en Claude Sonnet 5 (veredicto ok/reparado/rechazado; `JUDGE_MODEL` compartido con Viaje), clima Open-Meteo con fallback, regla de variedad 14 días, **loop de aprendizaje** (`taste-signal.ts`), streaming NDJSON, votos idempotentes, instrumentación TTV/timing/critic_review
- ✅ "Tu look de hoy" (`/hoy`): generación real en background + polling, 1-look/día, acciones cableadas (ver paso 7 arriba)
- ✅ Clóset crece: upload de foto → análisis con Claude visión → confirmación editable (ver paso 8 arriba)
- ✅ `ANTHROPIC_API_KEY` y `GOOGLE_GENERATIVE_AI_API_KEY` configuradas — los bloqueos por key de sesiones anteriores ya no aplican

**Features que superan el MVP del journey** (construidas, cableadas)
- ✅ Avatar + try-on (Gemini): genera avatar full-body y lo viste con las prendas reales del outfit, cachea por outfit (`/api/avatar/generate`, `/api/tryon`)
- ✅ Viaje / itinerario: wizard multidestino → cápsula + clima histórico por parada + outfits del clóset (`/api/trip`); desde v21 los looks usan los datos de la prenda REAL (no la ideal de la cápsula), respetan la colorimetría near-face y una rejilla (`buildTripGrid`) garantiza que toda prenda empacada aparezca en al menos un look; desde v24 recibe la señal completa (vetos, referencia, palabras, feedback real), la maleta cumple un piso de suficiencia por días y planes (`capsuleFloor`) y cada ocasión del viaje recibe al menos un look (sin restaurar jamás un look con veto)
- ✅ Colorimetría enriquecida: quiz de 4 estaciones (+ hasta 12 sub-estaciones con flow); opción de foto con ensemble Claude+Gemini (`lib/colorimetria.ts`)
- ✅ Vetos de estilo (hard NOs), silueta (señal suave), "el toque" (tip de styling del juez), "tu estilo en tus palabras" (texto libre en Perfil → `profiles.style_words`, entra a todos los motores)

**Lo que falta de verdad (no es build)**
- ⬜ **El experimento**: cero usuarios reales. Faltan los correos de Tatiana y Toño en la allowlist y mandarles el link. ~15 min de logística — es el verdadero cuello de botella del proyecto
- ⬜ PWA instalable + prompt post-primer-👍 (verificar estado actual en código)
- 🟡 Loop de aprendizaje sin datos aún: funciona, pero solo afina cuando haya feedback real (otra razón por la que el experimento es el desbloqueo)

## Criterios de éxito del experimento (no perder de vista)

- TTV <2 min (medido automático en `events`)
- ≥1 de cada 3 outfits con 👍 de Tatiana/Toño en una semana real
- Señal de oro: alguien se pone un outfit sugerido la primera semana
