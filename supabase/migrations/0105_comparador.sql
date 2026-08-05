-- El comparador: poner modelos a competir y decidir con evidencia cuál usar.
--
-- DE DÓNDE SALE
-- Roberto, después de tres bugs de arnés en un día y de una factura que se
-- multiplicó por siete: "ahorita lo estamos haciendo muy en caja negra y sin
-- un proceso. Yo te pido cambios y no sé bien qué sí cambia". Y sobre las
-- pruebas en terminal: "eso es muy gris; que veamos quién lo hace bien y así
-- decidimos qué usar".
--
-- POR QUÉ UNA PANTALLA Y NO UN SCRIPT
-- Los tres bugs de aquel día tienen la misma raíz: los scripts IMITABAN al
-- motor en vez de llamarlo. Uno barajaba el clóset una sola vez cuando
-- producción lo baraja en cada llamada; otro consultaba la cuenta equivocada;
-- otro pasaba el historial vacío. Ninguno de los tres "hallazgos" era del
-- producto. Una pantalla que llama el mismo código que corre en producción
-- mata esa clase entera de error por construcción, no por disciplina.
--
-- EMPIEZA POR VISIÓN, no por el motor. Dos razones:
--   1. Es donde está el dinero: en julio se leyeron 436 prendas contra ~34
--      generaciones de looks. La visión cuesta unas tres veces lo que el motor.
--   2. Tiene respuesta correcta. La prenda existe y está en la foto, así que se
--      cuentan aciertos en vez de pedir opiniones. Comparar el MOTOR entre
--      proveedores es mucho más turbio: nuestro prompt lleva 37 versiones
--      afinadas contra Claude, y dárselo a otro modelo mide "nuestro prompt en
--      sus manos", no al modelo.

-- Una corrida: N prendas leídas por M modelos.
create table if not exists public.comparador_vision (
  id uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now(),
  -- De quién es el clóset que se está leyendo. La primera corrida es sobre el
  -- de Roberto a propósito: comparar visión manda fotos a terceros, y su propio
  -- clóset no compromete datos de nadie más.
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Los ids de modelo que compiten, en el orden en que se eligieron.
  modelos jsonb not null,
  -- 'corriendo' | 'juzgando' | 'cerrada'
  estado text not null default 'corriendo' check (estado in ('corriendo','juzgando','cerrada')),
  nota text
);

-- Una lectura: lo que UN modelo dijo de UNA prenda.
create table if not exists public.comparador_vision_lecturas (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.comparador_vision(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  modelo_id text not null,
  -- Lo que devolvió el modelo, tal cual. null si falló.
  analisis jsonb,
  error text,
  -- El recibo de la llamada. Esto es lo que faltaba en el proyecto entero: dos
  -- meses sin saber cuánto cuesta leer una prenda contra armar un look, porque
  -- la factura de Anthropic sólo llega por día y por modelo.
  tokens_entrada int,
  tokens_salida int,
  costo_usd numeric(10, 6),
  ms int,
  -- EL JUICIO. Qué campos leyó MAL, según Roberto viendo la foto. Vacío = todo
  -- bien; null = todavía sin juzgar. Se guardan los campos y no un "mejor/peor"
  -- porque aquí no hay gusto que valga: la prenda es la que es.
  campos_mal text[],
  unique (corrida_id, item_id, modelo_id)
);

create index if not exists comparador_vision_lecturas_corrida
  on public.comparador_vision_lecturas (corrida_id);

alter table public.comparador_vision enable row level security;
alter table public.comparador_vision_lecturas enable row level security;

create policy "comparador_vision admin" on public.comparador_vision
  for all using (public.is_admin()) with check (public.is_admin());

create policy "comparador_vision_lecturas admin" on public.comparador_vision_lecturas
  for all using (public.is_admin()) with check (public.is_admin());
