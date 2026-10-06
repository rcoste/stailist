-- DESDE DÓNDE Y CON QUÉ ENTRÓ CADA CUENTA (2026-10-06).
--
-- Una vez por cuenta, al arrancar el onboarding (app/onboarding/genero/page.tsx):
-- el aparato (celular / tablet / computadora, lib/dispositivo.ts) y el país y
-- estado que Vercel deduce de la IP (lib/lugar.ts). La IP no se guarda.
--
-- El aparato ya se guardaba desde el 2026-10-01, pero escondido en el evento
-- onboarding_started; se copia aquí para que el admin lo lea de un solo lugar.
-- Las cuentas anteriores se llenan una vez con scripts/rellenar-pais-aparato.mts.

alter table public.profiles
  add column if not exists dispositivo text
    check (dispositivo in ('celular', 'tablet', 'computadora')),
  add column if not exists pais text
    check (pais ~ '^[A-Z]{2}$'),
  add column if not exists region text
    check (region ~ '^[A-Z0-9]{1,3}$');

update public.profiles p
set dispositivo = e.dispositivo
from (
  select distinct on (user_id) user_id, data->>'dispositivo' as dispositivo
  from public.events
  where type = 'onboarding_started'
    and data->>'dispositivo' in ('celular', 'tablet', 'computadora')
  order by user_id, created_at
) e
where e.user_id = p.id and p.dispositivo is null;
