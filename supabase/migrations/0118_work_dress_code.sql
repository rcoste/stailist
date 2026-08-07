-- El código de vestimenta del TRABAJO, una vez por persona.
--
-- POR QUÉ ES UN DATO DE PERSONA Y NO DE DÍA
-- El paraguas cambia cada mañana; dónde trabajas, no. Roberto, calificando la
-- corrida de verificación: "depende del tipo de oficina… hace falta definir
-- cómo se viste cada persona para ir a trabajar. El look está padre pero
-- depende". No pudo juzgar el look porque el motor no tenía el dato — y
-- tampoco lo tenía él.
--
-- Es el MISMO patrón que "evento" a secas y que el clima sin traducir: una
-- pregunta que el producto nunca hizo, y sin la cual ni el motor puede acertar
-- ni el humano puede calificar.
--
-- Valores (los mismos que la pantalla, en el orden en que se muestran):
--   formal          traje o saco (banca, despachos, legal)
--   business_casual camisa o polo, sin saco
--   casual          jeans y estoy bien (agencias, tech)
--   variable        depende del día: unos veo cliente y otros no
--
-- `variable` no es un cajón de sobra: Roberto lo pidió sin nombrarlo ("igual
-- hay una cena de trabajo importante donde sí importe ir de traje"). Forzar a
-- esa gente a un solo nivel sería mentirle al motor.
--
-- NULL = todavía no se le ha preguntado. Se pregunta la primera vez que elige
-- "trabajo" como ocasión, no en el onboarding: quien nunca lo use no paga nada.
alter table public.profiles
  add column if not exists work_dress_code text
  check (work_dress_code is null or work_dress_code in
    ('formal', 'business_casual', 'casual', 'variable'));

comment on column public.profiles.work_dress_code is
  'Código de vestimenta del trabajo. Se pregunta la primera vez que elige la ocasión "trabajo"; null = sin preguntar.';
