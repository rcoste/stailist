-- Biblioteca MUJER curada (~50 piezas) — lista de Roberto colapsada a siluetas
-- visualmente distintas. Todas segment='mujer', onboarding_subset=false (entran
-- a la biblioteca, no al wow inicial). Idempotente.

insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  -- Abrigos / outerwear
  ('abrigo-largo-lana-gris','Abrigo largo de lana','abrigo','mujer','{"color":"gris","color_hex":"#6E6E70","temporada":"frio","formalidad":"formal-casual"}','/archetypes/abrigo-largo-lana-gris.png',99,false),
  ('abrigo-cruzado-negro','Abrigo cruzado','abrigo','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal"}','/archetypes/abrigo-cruzado-negro.png',100,false),
  ('trench-corto-beige','Trench corto','abrigo','mujer','{"color":"beige","color_hex":"#C8B89A","temporada":"templado","formalidad":"formal-casual"}','/archetypes/trench-corto-beige.png',101,false),
  ('blazer-oversize-negro','Blazer oversize','abrigo','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/blazer-oversize-negro.png',102,false),
  ('blazer-cropped-crema','Blazer cropped','abrigo','mujer','{"color":"crema","color_hex":"#EFE6D6","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/blazer-cropped-crema.png',103,false),
  ('chaqueta-utility-olivo','Chaqueta utility','abrigo','mujer','{"color":"olivo","color_hex":"#5E6B43","temporada":"templado","formalidad":"casual"}','/archetypes/chaqueta-utility-olivo.png',104,false),
  ('harrington-marino','Harrington','abrigo','mujer','{"color":"azul marino","color_hex":"#27425F","temporada":"templado","formalidad":"casual"}','/archetypes/harrington-marino.png',105,false),
  ('cardigan-largo-gris','Cardigan largo','abrigo','mujer','{"color":"gris","color_hex":"#8A8784","temporada":"frio","formalidad":"casual"}','/archetypes/cardigan-largo-gris.png',106,false),
  ('chaleco-tejido-crema','Chaleco tejido','abrigo','mujer','{"color":"crema","color_hex":"#EFE6D6","temporada":"frio","formalidad":"casual"}','/archetypes/chaleco-tejido-crema.png',107,false),
  -- Tops
  ('camisa-oxford-azul','Camisa oxford','top','mujer','{"color":"azul claro","color_hex":"#AFC4DA","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/camisa-oxford-azul.png',108,false),
  ('camisa-satinada-marfil','Camisa satinada','top','mujer','{"color":"marfil","color_hex":"#F2EBDD","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/camisa-satinada-marfil.png',109,false),
  ('blusa-cuello-v-negra','Blusa cuello V','top','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/blusa-cuello-v-negra.png',110,false),
  ('blusa-lazo-blanca','Blusa con lazo','top','mujer','{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/blusa-lazo-blanca.png',111,false),
  ('blusa-wrap-estampado','Blusa wrap','top','mujer','{"color":"estampado","color_hex":"#C98B9B","temporada":"calor","formalidad":"formal-casual"}','/archetypes/blusa-wrap-estampado.png',112,false),
  ('playera-cuello-v-blanca','Playera cuello V','top','mujer','{"color":"blanco","color_hex":"#F5F5F0","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/playera-cuello-v-blanca.png',113,false),
  ('playera-manga-larga-negra','Playera manga larga','top','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"templado","formalidad":"casual"}','/archetypes/playera-manga-larga-negra.png',114,false),
  ('sueter-crewneck-verde','Suéter crewneck verde','top','mujer','{"color":"verde botella","color_hex":"#2F4538","temporada":"frio","formalidad":"casual"}','/archetypes/sueter-crewneck-verde.png',115,false),
  ('sueter-cuello-v-camel','Suéter cuello V camel','top','mujer','{"color":"camel","color_hex":"#B89968","temporada":"frio","formalidad":"casual"}','/archetypes/sueter-cuello-v-camel.png',116,false),
  ('top-satinado-champagne','Top satinado','top','mujer','{"color":"champagne","color_hex":"#E8D9B8","temporada":"calor","formalidad":"formal-casual"}','/archetypes/top-satinado-champagne.png',117,false),
  ('top-halter-negro','Top halter','top','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"calor","formalidad":"formal"}','/archetypes/top-halter-negro.png',118,false),
  ('top-corset-negro','Top corset','top','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}','/archetypes/top-corset-negro.png',119,false),
  -- Bottoms
  ('pantalon-sastre-recto-negro','Pantalón sastre recto','bottom','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}','/archetypes/pantalon-sastre-recto-negro.png',120,false),
  ('pantalon-plisado-gris','Pantalón plisado','bottom','mujer','{"color":"gris","color_hex":"#6E6E70","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/pantalon-plisado-gris.png',121,false),
  ('jeans-skinny-mujer','Jeans skinny','bottom','mujer','{"color":"azul oscuro","color_hex":"#2C3E55","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/jeans-skinny-mujer.png',122,false),
  ('jeans-wide-mujer','Jeans wide-leg','bottom','mujer','{"color":"azul medio","color_hex":"#5B7DA6","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/jeans-wide-mujer.png',123,false),
  ('jeans-mom-mujer','Jeans mom','bottom','mujer','{"color":"azul claro","color_hex":"#8CA6C0","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/jeans-mom-mujer.png',124,false),
  ('jeans-flare-mujer','Jeans flare','bottom','mujer','{"color":"azul oscuro","color_hex":"#2C3E55","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/jeans-flare-mujer.png',125,false),
  ('chino-beige-mujer','Chino','bottom','mujer','{"color":"beige","color_hex":"#C8B89A","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/chino-beige-mujer.png',126,false),
  ('cargo-verde-mujer','Cargo','bottom','mujer','{"color":"verde","color_hex":"#5E6B43","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/cargo-verde-mujer.png',127,false),
  ('shorts-mezclilla-mujer','Shorts de mezclilla','bottom','mujer','{"color":"azul","color_hex":"#5B7DA6","temporada":"calor","formalidad":"casual"}','/archetypes/shorts-mezclilla-mujer.png',128,false),
  ('shorts-lino-mujer','Shorts de lino','bottom','mujer','{"color":"beige","color_hex":"#D8C7A8","temporada":"calor","formalidad":"casual"}','/archetypes/shorts-lino-mujer.png',129,false),
  -- Faldas
  ('falda-mini-negra','Falda mini','bottom','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/falda-mini-negra.png',130,false),
  ('falda-slip-champagne','Falda slip','bottom','mujer','{"color":"champagne","color_hex":"#E8D9B8","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/falda-slip-champagne.png',131,false),
  ('falda-plisada-marino','Falda plisada','bottom','mujer','{"color":"azul marino","color_hex":"#27425F","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/falda-plisada-marino.png',132,false),
  ('falda-larga-columna-negra','Falda larga','bottom','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/falda-larga-columna-negra.png',133,false),
  ('falda-mezclilla-mujer','Falda de mezclilla','bottom','mujer','{"color":"azul","color_hex":"#5B7DA6","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/falda-mezclilla-mujer.png',134,false),
  -- Vestidos
  ('vestido-punto-camel','Vestido de punto','vestido','mujer','{"color":"camel","color_hex":"#B89968","temporada":"frio","formalidad":"casual"}','/archetypes/vestido-punto-camel.png',135,false),
  ('vestido-tshirt-gris','T-shirt dress','vestido','mujer','{"color":"gris","color_hex":"#8A8784","temporada":"calor","formalidad":"casual"}','/archetypes/vestido-tshirt-gris.png',136,false),
  ('vestido-slip-champagne','Slip dress','vestido','mujer','{"color":"champagne","color_hex":"#E8D9B8","temporada":"calor","formalidad":"formal-casual"}','/archetypes/vestido-slip-champagne.png',137,false),
  ('vestido-wrap-negro','Wrap dress','vestido','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/vestido-wrap-negro.png',138,false),
  ('vestido-cocktail-negro','Vestido cocktail','vestido','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}','/archetypes/vestido-cocktail-negro.png',139,false),
  ('vestido-noche-marino','Vestido de noche','vestido','mujer','{"color":"azul marino","color_hex":"#27425F","temporada":"todo-el-año","formalidad":"formal"}','/archetypes/vestido-noche-marino.png',140,false),
  -- Calzado
  ('tenis-minimalistas-negros-mujer','Tenis minimalistas negros','calzado','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/tenis-minimalistas-negros-mujer.png',141,false),
  ('tenis-retro-mujer','Tenis retro','calzado','mujer','{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/tenis-retro-mujer.png',142,false),
  ('slingbacks-negros','Slingbacks','calzado','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}','/archetypes/slingbacks-negros.png',143,false),
  ('kitten-heels-nude','Kitten heels','calzado','mujer','{"color":"nude","color_hex":"#D9BFA8","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/kitten-heels-nude.png',144,false),
  ('botines-punta-afilada','Botines de punta afilada','calzado','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}','/archetypes/botines-punta-afilada.png',145,false),
  ('botas-rodilla-negras','Botas a la rodilla','calzado','mujer','{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}','/archetypes/botas-rodilla-negras.png',146,false),
  ('botas-ecuestres-cafe','Botas ecuestres','calzado','mujer','{"color":"café","color_hex":"#5C4433","temporada":"frio","formalidad":"casual"}','/archetypes/botas-ecuestres-cafe.png',147,false),
  ('mules-camel','Mules','calzado','mujer','{"color":"camel","color_hex":"#B89968","temporada":"calor","formalidad":"formal-casual"}','/archetypes/mules-camel.png',148,false)
on conflict (slug) do nothing;
