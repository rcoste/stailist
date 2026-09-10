-- 0156 · reportes: el buzón que la app no tenía.
--
-- Roberto, 2026-09-09: "sería bueno poner algún botón para que los usuarios
-- puedan reportar algún problema o sugerencia… creo que eso es más fácil que
-- de memoria me lo expliquen".
--
-- HASTA HOY el único canal era `hola@stailist.co`, escondido en la página de
-- términos. Para reportar algo había que encontrarlo ahí. En la práctica el
-- feedback llegaba por WhatsApp a Roberto, o no llegaba: Val intentó verse un
-- look CUATRO veces el 2026-09-09, falló las cuatro por una caída del proveedor
-- de imágenes, y no reportó nada — se rindió.
--
-- EL CONTEXTO VA EN LA FILA, no en el texto. Lo que hace útil un reporte no es
-- la descripción sino saber dónde estaba, con qué versión y qué le acababa de
-- pasar. Pedírselo a la persona es pedirle que haga de soporte técnico.
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- "problema" | "idea": la misma puerta para los dos, porque obligar a
  -- clasificar antes de escribir es una decisión que frena el impulso.
  tipo text not null default 'problema',
  texto text not null,
  -- Dónde estaba (ruta), con qué versión, y su user agent. Todo automático.
  ruta text,
  version text,
  agente text,
  -- Foto OPCIONAL que la persona sube (bucket `prendas`, misma RLS por carpeta).
  -- No es una captura automática: html2canvas pesa ~200KB y falla con imágenes
  -- de otro dominio y con las fuentes; el contexto de arriba reconstruye mejor.
  foto_path text,
  -- Lo que ya se sabía sin preguntarle: sus últimos eventos y si tuvo un fallo
  -- de IA reciente. Es lo que convierte "no me funcionó" en algo accionable.
  contexto jsonb not null default '{}'::jsonb,
  -- Para el admin: marcar lo ya visto sin borrarlo.
  atendido_en timestamptz
);

create index if not exists reportes_created_idx on public.reportes (created_at desc);
create index if not exists reportes_user_idx on public.reportes (user_id, created_at desc);

alter table public.reportes enable row level security;

-- Cada quien escribe los suyos y ve los suyos. El admin lee todo por service
-- role (withDb), como el resto del panel.
drop policy if exists "reportes propios: insertar" on public.reportes;
create policy "reportes propios: insertar" on public.reportes
  for insert with check (auth.uid() = user_id);

drop policy if exists "reportes propios: leer" on public.reportes;
create policy "reportes propios: leer" on public.reportes
  for select using (auth.uid() = user_id);
