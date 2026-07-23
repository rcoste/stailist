-- Rebalanceo del clóset precargado de MUJER (onboarding_subset). El anterior era
-- muy señorial: falda midi, blusa de lino, cuello alto, tacón nude, mocasines,
-- gabardina, vestido camisero/floral — un guardarropa de oficina de 40 años. Con
-- usuarias adolescentes (13-17) se sentía "monja siglo 19".
--
-- Las prendas juveniles YA existían en la biblioteca (tenis, hoodie, jeans
-- mom/wide, falda mini, cargo, sudadera, top corset, t-shirt dress, blazer
-- oversize) pero estaban fuera del subset. Aquí las promovemos y sacamos del
-- precargado las más clásicas/redundantes (siguen en la biblioteca, solo no
-- aparecen en el checklist de arranque). Mezcla juvenil + clásico para todas:
-- el checklist deja que cada usuaria marque lo suyo.
begin;

-- Apagar todo el subset de mujer y volver a prender solo la mezcla curada.
update public.archetypes set onboarding_subset = false where segment = 'mujer';

update public.archetypes set onboarding_subset = true where slug in (
  -- Clásicos versátiles (sirven a todas, base de guardarropa)
  'blusa-blanca', 'camiseta-rayas', 'top-tirantes', 'sueter-gris-mujer',
  'camisa-blanca-mujer', 'jeans-claros-mujer', 'pantalon-wide-leg',
  'botines-mujer', 'botas-negras-mujer', 'flats-nude',
  'blazer-azul-marino-mujer', 'vestido-negro', 'chamarra-mezclilla-mujer',
  'chaqueta-piel',
  -- Juveniles (ya existían en la biblioteca, ahora en el precargado)
  'hoodie-oversize-gris-mujer', 'sudadera-crema-mujer', 'top-corset-negro',
  'sueter-oversize-crema', 'jeans-mom-mujer', 'jeans-wide-mujer',
  'falda-mini-negra', 'cargo-verde-mujer', 'shorts-mezclilla-mujer',
  'tenis-blancos-mujer', 'tenis-retro-mujer', 'blazer-oversize-negro',
  'vestido-tshirt-gris', 'vestido-blanco-verano'
);

commit;
