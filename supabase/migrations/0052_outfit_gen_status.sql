-- Generación en background: el look del día se crea como placeholder
-- (gen_status 'generating'), se genera FUERA de la petición (Next after(), que
-- en Vercel Pro + Fluid Compute sigue corriendo aunque el cliente se vaya), y el
-- cliente hace polling. Resiliente a bloquear/cambiar de app a media carga.
--
--   gen_status: null = completo (legacy/sincrónico) | 'generating' | 'ready' | 'error'
--   gen_error:  código de error cuando falla (para mostrar reintento)

alter table public.outfits
  add column if not exists gen_status text,
  add column if not exists gen_error text;
