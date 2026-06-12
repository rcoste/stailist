# stailist — User Journey (referencia canónica)

> El flujo completo de valor, paso a paso, como lo vive la usuaria.
> Fuente: planning 2026-06-10 (spec completa en `docs/designs/mvp-onboarding-90s.md`).
> **La promesa: primer outfit en <2 minutos desde que abres el link.**

## Primera visita — onboarding (~90 segundos)

| # | Paso | Qué pasa | Tiempo | Estado |
|---|------|----------|--------|--------|
| 1 | **Login** | Correo → si está en la allowlist, llega magic link (sin contraseña). Si no: mensaje "beta por invitación" | — | ✅ construido + QA local (falta prueba con buzón real) |
| 2 | **Objetivo** | "¿Qué necesitas hoy?" — 5 opciones cerradas: día a día / oficina / evento / viaje / refrescar estilo. Un tap | 10s | ✅ construido + QA local |
| 3 | **Swipes de gustos** | ~15 fotos de looks; ❤️/✕ por gesto O botones (desktop + accesibilidad). Genera el taste vector (tags estéticos → contexto del prompt, sin ML) | 30s | ✅ mecánica construida + QA local (cards con swatches; fotos reales pendientes de GOOGLE_GENERATIVE_AI_API_KEY) |
| 4 | **Quiz de colorimetría** | 5-6 preguntas (piel, ojos, cabello, qué colores le favorecen) → paleta de 4 estaciones + regla near-face. SIN selfie | 20s | ✅ construido + QA local |
| 5 | **Clóset exprés** | Checklist de 15 básicos ("tengo esta, esta…"). CERO fotos obligatorias — el arma contra la fricción que mata a la competencia | 30s | ✅ construido + QA local (lista de básicos pendiente de validación por Roberto) |
| 6 | **💥 Momento wow** | 2-3 outfits con justificación ("los tonos tierra te encienden la cara"), generados <30s con progreso por fases ("leyendo tu clóset… combinando colores…"). Voto 👍/👎 | <30s | 🟡 motor completo (prompt v1 + structured outputs + streaming + votos + TTV); SOLO falta ANTHROPIC_API_KEY para probarlo de verdad |

**Regla dura:** cada paso se persiste — interrumpir en el paso 3 y volver = retomas en el paso 3.
**Tras el primer 👍:** prompt de instalación PWA ("agrégame a tu pantalla de inicio") — UNA sola vez, en el pico emocional.

## Día 2 en adelante — el hábito

| # | Paso | Qué pasa | Estado |
|---|------|----------|--------|
| 7 | **"Tu look de hoy"** | Al abrir: outfit ya generado para su día (1/día, considera clima vía Open-Meteo). Votar, "otro look", "me lo puse" | 🟡 pantalla existe con demo estático |
| 8 | **Clóset crece a su ritmo** | Fotos opcionales → IA detecta atributos → confirmación editable en un tap. Falla la detección → captura manual, nunca bloquea | 🟡 pantalla existe, sin upload aún |
| 9 | **La app aprende** | Cada voto/uso se persiste y entra como contexto en generaciones futuras (regla de variedad: no repite lo reciente) | ⬜ pendiente |

## Estado actual del código (2026-06-11, fin de sesión 2 de build)

- ✅ Repo + scaffold Next.js + design system (DESIGN.md + tokens en globals.css) + logo burdeos
- ✅ Supabase: schema completo con RLS (6 tablas), allowlist, bucket privado, 15 arquetipos sembrados, clients escritos
- ✅ Auth completo: magic link + allowlist server-side (UI **y** trigger en DB que bloquea signups directos a la API — migración 0003), proxy.ts protege rutas, "/" enruta según onboarding_step
- ✅ Onboarding pasos 2-5 construidos y QA'd en navegador con usuario de prueba (qa-stailist@kublau.com, quedó en paso wow): objetivo → swipes (taste vector) → quiz colorimetría (4 estaciones) → checklist (items reales en DB). Persistencia por paso verificada: interrumpir y volver retoma donde ibas, y no puedes saltarte pasos por URL
- ✅ Motor de outfits (lib/engine/): prompt v1 versionado, structured outputs con enum de item_ids (imposible inventar prendas), clima Open-Meteo con fallback, regla de variedad 14 días, ruta /api/generate con streaming NDJSON de fases, votos 👍/👎 idempotentes, instrumentación TTV/generation_timing. Degrada con mensaje claro sin API key
- ✅ Herramienta scripts/db.mjs para correr SQL/migraciones contra la DB (no hay psql en la máquina)
- 🟡 BLOQUEADO el momento wow real: falta ANTHROPIC_API_KEY (el evento needs-anthropic-setup no existe en raicode — ir manual a la pestaña del wizard)
- ⬜ Por construir: look del día real en /hoy (hoy muestra demo) + clóset/historial leyendo DB → upload de fotos → PWA + prompt post-primer-👍
- ⬜ Assets one-off pendientes: ~15 fotos de swipes + 15 imágenes de arquetipos (requieren GOOGLE_GENERATIVE_AI_API_KEY, sub-flow Gemini)
- ⬜ Pendiente de Roberto: respuesta a la pregunta de Vercel (dispara needs-vercel-setup); correos de Tatiana y Toño para la allowlist; validar lista de básicos (`supabase/migrations/0002`); probar el login con su correo real

## Criterios de éxito del experimento (no perder de vista)

- TTV <2 min (medido automático en `events`)
- ≥1 de cada 3 outfits con 👍 de Tatiana/Toño en una semana real
- Señal de oro: alguien se pone un outfit sugerido la primera semana
