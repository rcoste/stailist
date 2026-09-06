-- BLINDAJE DE ABUSO Y COSTO (bloque B1 de la auditoría pre-release, 2026-09-02)
--
-- Tres cosas que no pueden salir al público como estaban: la cuota diaria no
-- tenía por dónde leerse rápido, los buckets aceptaban cualquier archivo de
-- cualquier tamaño, y `anon` podía ejecutar funciones internas que no le
-- incumben.

-- ─── 1. EL ÍNDICE QUE LA CUOTA NECESITA ──────────────────────────────────────
--
-- `lib/cuotas.ts` pregunta, en CADA llamada de IA: "¿cuánto llevas gastado en
-- las últimas 24 horas?". Eso es un filtro por (user_id, created_at) y el único
-- índice que había era (tarea, created_at) — o sea, para esta pregunta la tabla
-- se recorría entera. Hoy da igual (400 filas); con la app abierta al público
-- ese recorrido pasa a estar en el camino crítico de cada look.
create index if not exists ai_calls_usuario_idx
  on public.ai_calls (user_id, created_at desc);

-- ─── 2. LÍMITES EN LOS BUCKETS ───────────────────────────────────────────────
--
-- Los cinco tenían `file_size_limit` y `allowed_mime_types` en null: sin tope
-- de tamaño y aceptando cualquier tipo. Con `catalog` y `destinos` públicos y
-- escribibles por cualquier sesión, eso servía para alojar archivos ajenos al
-- producto bajo el dominio de Supabase del proyecto.
--
-- 3 MB no es arbitrario: una foto de iPhone comprimida por `lib/image-compress`
-- ronda 300-800 KB, y el tope de cuerpo de Vercel son 4.5 MB. Deja cuatro veces
-- la foto típica y sigue por debajo del techo de la función.
--
-- HEIC entra en la lista porque el iPhone sube HEIC y la conversión ocurre en
-- el navegador (heic2any): si el navegador no alcanzó a convertir, el archivo
-- llega tal cual y rechazarlo aquí sería un fallo sin explicación.
update storage.buckets
   set file_size_limit = 3145728,  -- 3 MB
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
       ]
 where id in ('prendas', 'referencias', 'catalog', 'destinos', 'archetypes');

-- ─── 3. FUNCIONES QUE `anon` NO TIENE POR QUÉ EJECUTAR ───────────────────────
--
-- Supabase concede EXECUTE a anon y authenticated por default en todo lo que
-- se crea en `public`. De las ocho funciones del proyecto, sólo tres se llaman
-- de verdad sin sesión: `is_email_allowed` (el login pregunta antes de mandar
-- el código), `email_for_invite` (el deep-link pre-llena el correo) y
-- `join_waitlist` (el alta de la landing).
--
-- Las otras cinco son maquinaria interna —disparadores y el chequeo de admin— y
-- que estén expuestas no es una vulnerabilidad por sí sola, pero es superficie
-- regalada: `is_admin()` sin argumentos desde el cliente anónimo no debería ni
-- existir como llamada posible.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.enforce_allowlist() from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.guard_minor_consent_cols() from anon;
revoke execute on function public.rls_auto_enable() from anon;

-- Las tres que SÍ se llaman sin sesión se dejan explícitas, para que se lea que
-- fue una decisión y no un olvido de este archivo.
grant execute on function public.is_email_allowed(text) to anon;
grant execute on function public.email_for_invite(uuid) to anon;
