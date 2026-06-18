# Plan: Sistema de "siguiente mejor paso" post-onboarding

> Estado: plan aprobado 2026-06-18. **Piezas 1-4 + motor construidas y en prod
> (2026-06-18).** Falta validar el flujo vivo en cuentas reales y afinar copy/
> umbrales con Tatiana/Toño. Voz de marca: "tu amiga cool" (ver CLAUDE.md).

## Contexto
Tras el onboarding (~90s) el usuario cae en `/hoy` sin orientación. Tres
problemas: (a) el clóset se prellenó con básicos de la biblioteca pero no se nota
que son "asumidos" ni cómo hacerlos suyos; (b) la Biblioteca y la cápsula están
semi-escondidas; (c) el try-on se subutiliza. Meta: guiar **uno a la vez, por
comportamiento**, sin fricción antes del primer outfit (proteger el <2 min y el
aha). El alfa de Replit murió de fricción de setup: cada nudge debe ganarse su
lugar.

## Estado actual (verificado 2026-06-18)
- Flujo: gustos → colores → checklist de básicos → objetivo → wow (primeros
  outfits) → `/hoy` (`lib/onboarding.ts`).
- Clóset = tabla `items` (`source` archetype|photo, soft-delete) (`0001_initial.sql:83`).
- Comportamiento ya registrado en `events`: `vote_up/down`, `worn`,
  `onboarding_step`, `pwa_prompt_shown`… (`0001_initial.sql:121`).
- `/closet` muestra clóset + card de cápsula + link "+ Biblioteca" semi-escondido.
- **El prompt de instalar PWA YA EXISTE** y se dispara en el primer 👍
  (`components/pwa-install.tsx`); maneja Android (nativo) e iOS (instrucciones
  manuales "Compartir → Agregar a inicio"). Es, de facto, el primer nudge de la
  secuencia — solo estaba suelto.
- `profiles` NO tiene estado de "nudges vistos/descartados".

## Arquitectura del motor (la robustez)
Una columna nueva + señales derivadas + un resolvedor puro. Sin sobre-ingeniería
para beta de 3.

1. **Estado de nudges:** nueva columna `profiles.journey_state jsonb` default `{}`.
   Por nudge guarda su ciclo de vida: `{ "<nudge>": {shown_at, dismissed_at,
   done_at} }`. Una migración; RLS ya cubre `profiles`.
2. **Señales (derivadas de datos que YA existen):**

   | Señal | De dónde |
   |---|---|
   | Dio 1er / 2º 👍 | `events` type=`vote_up` (cuenta) |
   | Usó "Hoy" N veces | `outfits` where `is_look_of_day` (por `look_date`) |
   | Editó su clóset | `items` con `source='photo'` o algún `deleted_at` |
   | Abrió la cápsula | `profiles.capsule_target` no nulo |
   | Instaló PWA | `events` type=`pwa_installed` / localStorage |

3. **Resolvedor puro `nextBestAction(profile, signals) → un nudge | null`**
   (`lib/journey.ts`, testeable como `lib/capsule.ts`). Reglas: uno a la vez,
   gateado por comportamiento, suprime `dismissed`/`done`. Server-side al render.

## Secuencia de piezas
```
Onboarding → primer outfit (AHA, intocable)
   │
   ▼ 1er 👍  → instalar PWA      (YA EXISTE; pieza 0 de facto)
   │
   ▼ 2º 👍   → P2: ofrecer try-on/avatar   (se mueve aquí para no chocar con la PWA)
   │
   ▼ Hoy ≥2  → P3: "haz tu clóset real" → Biblioteca
   │
   ▼ enganchó→ P4: descubrir cápsula   (≥2 días o ≥2 votos)

P1 (clóset/Biblioteca claros): UI PERMANENTE en /closet, no un nudge temporal.
   Es la base que P3 referencia. SE CONSTRUYE PRIMERO.
```

**Decisión clave (primer 👍):** PWA y try-on competían por el mismo momento. Se
ordena: **PWA en el 1er 👍, try-on (P2) en el 2º 👍** (o al volver a la app). Uno
a la vez.

## Pieza 1 (primera) — claridad del clóset/Biblioteca
Postura: **aclarar + invitar fácil, NO regañar**.
- En `/closet`: línea que diga que estos son los básicos asumidos y que puede
  hacerlos suyos (voz de marca).
- Sacar la Biblioteca del escondite: "+ Biblioteca" pasa a entrada clara ("Agrega
  tu ropa real").
- Sin nag, sin bloquear. Un toque para llegar a la Biblioteca. No introduce
  `journey_state` (es UI permanente; el motor entra con P2).

## Criterios de éxito (cualitativos, n=3)
- Tatiana/Toño entienden sin explicación que el clóset es suyo y corregible, y
  encuentran la Biblioteca solos.
- Descubren la cápsula sin señalárselas.
- TTV al primer outfit sigue <2 min (ningún nudge antes del primer outfit).

## Archivos (estimado)
| Archivo | Cambio |
|---|---|
| `supabase/migrations/00XX_journey_state.sql` | + columna `journey_state` (P2+) |
| `lib/journey.ts` (nuevo) | resolvedor puro + tipos de señales |
| `app/closet/page.tsx`, `components/capsule-card.tsx` | P1: claridad + Biblioteca visible |
| `components/nudge.tsx` (nuevo) | nudge reusable (P2-P4) |
| `app/hoy/*`, `app/onboarding/wow/*` | P2/P3: disparar tras 👍 / uso |

## Esfuerzo (incremental, un commit por pieza)
P1 ~medio día · motor+P2 ~1 día · P3 ~medio día · P4 ~medio día.

## Fuera de alcance / Fase 2
- **Notificaciones push ("ya está tu outfit").** Depende de que la PWA esté
  INSTALADA (en iOS 16.4+ el push web solo va para PWA instalada con permiso).
  Necesita service worker de push, suscripciones en servidor, llaves VAPID y un
  cron diario. Fase 2, tras validar que la gente instala la PWA.
- Tour/coachmarks tipo overlay. Gamificación/streaks. Rehacer el onboarding.

## Rollback
Cada pieza es aditiva. `journey_state` default `{}` no rompe nada; revertir =
quitar el render del nudge (la columna queda inerte).
