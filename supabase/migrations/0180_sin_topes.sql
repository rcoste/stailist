-- CUENTAS SIN TOPE POR PERSONA (2026-10-18, pedido de Roberto).
--
-- Una persona cercana armando su maleta de verdad topó con la cuota de dibujos
-- de esenciales (40 al día) a media sesión: rehízo su cápsula dos veces y cada
-- una dibuja piezas nuevas. Para quien estamos acompañando a mano, el tope
-- estorba más de lo que protege.
--
-- Va en su PROPIA tabla y no como columna de `profiles`, a propósito: cada
-- persona puede editar su propio perfil ("own profile update"), así que una
-- columna ahí la podría prender cualquiera desde el navegador. Aquí no hay
-- política de escritura: sólo se agrega desde la base (scripts/db.mjs).
--
-- Lo que NO quita: el interruptor MOTOR_PAUSADO ni el freno global de dinero
-- de toda la app (TOPE_USD_DIA_GLOBAL), que sigue siendo la red de seguridad.
create table if not exists public.sin_topes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado timestamptz not null default now(),
  -- Por qué (sin nombres: el repo es público, la nota vive sólo en la base).
  nota text
);

alter table public.sin_topes enable row level security;

-- Cada quien sólo puede LEER si su propia cuenta está exenta (lib/cuotas.ts lo
-- consulta con la sesión de la persona). Sin políticas de insert/update/delete.
drop policy if exists "lee su propia exencion" on public.sin_topes;
create policy "lee su propia exencion" on public.sin_topes
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.sin_topes from anon;
revoke insert, update, delete on public.sin_topes from authenticated;
grant select on public.sin_topes to authenticated;
