# stailist — User Journey (referencia canónica)

> El flujo completo de valor, paso a paso, como lo vive la usuaria.
> Fuente: planning 2026-06-10 (spec completa en `docs/designs/mvp-onboarding-90s.md`).
> **La promesa: primer outfit en <2 minutos desde que abres el link.**

## Primera visita — onboarding (~90 segundos)

| # | Paso | Qué pasa | Tiempo | Estado |
|---|------|----------|--------|--------|
| 1 | **Login** | Correo → si está en la allowlist, llega magic link (sin contraseña). Si no: mensaje "beta por invitación" | — | ⬜ pendiente |
| 2 | **Objetivo** | "¿Qué necesitas hoy?" — 5 opciones cerradas: día a día / oficina / evento / viaje / refrescar estilo. Un tap | 10s | ⬜ pendiente |
| 3 | **Swipes de gustos** | ~15 fotos de looks; ❤️/✕ por gesto O botones (desktop + accesibilidad). Genera el taste vector (tags estéticos → contexto del prompt, sin ML) | 30s | ⬜ pendiente (faltan las ~15 imágenes — asset one-off) |
| 4 | **Quiz de colorimetría** | 5-6 preguntas (piel, ojos, cabello, qué colores le favorecen) → paleta de 4 estaciones + regla near-face. SIN selfie | 20s | ⬜ pendiente |
| 5 | **Clóset exprés** | Checklist de 15 básicos ("tengo esta, esta…"). CERO fotos obligatorias — el arma contra la fricción que mata a la competencia | 30s | ⬜ pendiente (catálogo ya sembrado en DB ✅) |
| 6 | **💥 Momento wow** | 2-3 outfits con justificación ("los tonos tierra te encienden la cara"), generados <30s con progreso por fases ("leyendo tu clóset… combinando colores…"). Voto 👍/👎 | <30s | ⬜ pendiente (necesita ANTHROPIC_API_KEY) |

**Regla dura:** cada paso se persiste — interrumpir en el paso 3 y volver = retomas en el paso 3.
**Tras el primer 👍:** prompt de instalación PWA ("agrégame a tu pantalla de inicio") — UNA sola vez, en el pico emocional.

## Día 2 en adelante — el hábito

| # | Paso | Qué pasa | Estado |
|---|------|----------|--------|
| 7 | **"Tu look de hoy"** | Al abrir: outfit ya generado para su día (1/día, considera clima vía Open-Meteo). Votar, "otro look", "me lo puse" | 🟡 pantalla existe con demo estático |
| 8 | **Clóset crece a su ritmo** | Fotos opcionales → IA detecta atributos → confirmación editable en un tap. Falla la detección → captura manual, nunca bloquea | 🟡 pantalla existe, sin upload aún |
| 9 | **La app aprende** | Cada voto/uso se persiste y entra como contexto en generaciones futuras (regla de variedad: no repite lo reciente) | ⬜ pendiente |

## Estado actual del código (2026-06-10, fin de sesión 1 de build)

- ✅ Repo + scaffold Next.js + design system (DESIGN.md + tokens en globals.css) + logo burdeos
- ✅ Supabase: schema completo con RLS (6 tablas), allowlist, bucket privado, 15 arquetipos sembrados, clients escritos
- ✅ Cascarón visual: layout + tabs + pantallas Hoy/Clóset/Historial **con datos de muestra** (esto es lo que se ve en local — es el "día 2" sin motor, NO el onboarding)
- ⬜ Por construir (en orden): auth magic link → 4 pantallas de onboarding (pasos 2-5) → motor de outfits (paso 6) → look del día real → upload de fotos
- ⬜ Bloqueado por sub-flows de raicode: Vercel (falta respuesta de Roberto a la pregunta de privacidad) y ANTHROPIC_API_KEY (sub-flow de Anthropic)
- ⬜ Assets one-off pendientes: ~15 imágenes de swipes + 15 imágenes de arquetipos
- ⬜ Pendiente de Roberto: correos de Tatiana y Toño para la allowlist; validar lista de básicos (`supabase/migrations/0002`)

## Criterios de éxito del experimento (no perder de vista)

- TTV <2 min (medido automático en `events`)
- ≥1 de cada 3 outfits con 👍 de Tatiana/Toño en una semana real
- Señal de oro: alguien se pone un outfit sugerido la primera semana
