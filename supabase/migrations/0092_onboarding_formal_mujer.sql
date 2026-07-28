-- Equilibra el checklist de onboarding: la mujer no podía marcar ropa formal.
--
-- El hallazgo (medido, no supuesto): el desbalance NO está en la biblioteca
-- —mujer tiene 27 prendas formales contra 24 de hombre, y va por delante en
-- TODAS las categorías— sino en el subset curado que se ofrece al registrarte:
--
--     hombre: 40 prendas ofrecidas, 23 formales (58%)
--     mujer:  33 prendas ofrecidas,  9 formales (27%)
--
-- Consecuencia real: una mujer termina el onboarding con un clóset que no puede
-- vestir una ocasión formal. Su calzado formal eran unos flats y unos botines —
-- CERO tacones. No tenía ningún abrigo formal (el hombre tiene dos), un solo
-- bottom (wide-leg) y ningún pantalón de vestir ni falda. Después la cápsula le
-- reporta esos huecos como si no tuviera la ropa, cuando lo que pasó es que
-- nunca se la ofrecimos para marcar.
--
-- No hay que generar nada: las 108 piezas formales de mujer YA existen en la
-- biblioteca con su imagen. Esto solo promueve 12 al checklist, eligiendo
-- BÁSICOS que alguien probablemente ya tiene (el checklist pregunta "¿tienes
-- esto?", así que una pieza statement ahí no sirve) y espejeando la forma de la
-- curaduría de hombre: abrigo, pantalón/falda de vestir, calzado de tacón, saco
-- estructurado, camisa/blusa y un vestido de trabajo.
--
-- Deja el subset de mujer en 45 contra 40 de hombre: más, pero es que su
-- guardarropa tiene categorías que el de hombre no (vestidos y faldas).

update public.archetypes
set onboarding_subset = true
where segment = 'mujer'
  and slug in (
    -- abrigo (tenía 0 formales; hombre tiene 2)
    'abrigo-largo-lana-gris',
    'gabardina-mujer',
    -- bottom (tenía solo el wide-leg)
    'pantalon-sastre-recto-negro',
    'falda-lapiz-negra',
    'falda-midi-negra',
    -- calzado (no tenía UN solo tacón)
    'tacon-negro-vestir-m',
    'tacon-nude',
    'cf-mules-negras',
    -- saco (tenía marino y oversize; faltaba el negro estructurado)
    'blazer-estructurado-negro-mujer',
    -- top
    'camisa-oxford-blanca-mujer',
    'blusa-seda-negra',
    -- vestido (tenía el negro básico; falta el de trabajo)
    'vestido-lapiz-negro'
  );
