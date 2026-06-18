-- Motor de "siguiente mejor paso" post-onboarding (ver docs/designs/post-onboarding-nudges.md).
-- Estado por usuario del ciclo de vida de cada nudge:
--   { "<nudge_id>": { "shown_at": ts, "dismissed_at": ts, "done_at": ts } }
-- Las SEÑALES que disparan los nudges se derivan de datos que ya existen
-- (events, outfits, items, capsule_target); aquí solo vive lo que NO se puede
-- derivar: si el usuario ya vio / descartó / completó cada nudge.
-- Default '{}' → aditivo, no rompe nada existente. RLS ya cubre profiles.
alter table public.profiles
  add column if not exists journey_state jsonb not null default '{}'::jsonb;
