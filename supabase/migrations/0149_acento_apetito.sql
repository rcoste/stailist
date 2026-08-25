-- EL APETITO DE ACENTOS por persona: cuánto volumen de color quiere.
--
-- Dimensión de intake de stylist (¿cuánta atención quieres que atraiga tu
-- ropa?), independiente de la colorimetría y del arquetipo. Nació de Roberto
-- viendo el suéter cobalto de "Cobalto Bajo Cero": "probablemente no me lo
-- hubiera puesto; hubiera usado marino" — y sus propios swipes ya lo decían
-- (2 cartas audaces / 5 discretas). Marco completo:
-- docs/designs/acentos-y-colorimetria-por-zona.md.
--
-- Se DERIVA de los swipes del onboarding (lib/looks.ts, apetitoDeAcentos) y
-- la persona lo puede corregir en Perfil → estilo — el manual siempre gana,
-- mismo contrato que registro_por_plan. NULL = sin derivar todavía.
--
-- EL MOTOR NO LO CONSUME AÚN (el loop está en pausa; su activación es un
-- cambio del motor y pide su vuelta medida). Esta migración es solo el dato.
alter table public.profiles
  add column if not exists acento_apetito text
  check (acento_apetito in ('discreto', 'medio', 'protagonista'));
