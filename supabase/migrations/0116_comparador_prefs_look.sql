-- La preferencia look por look ANOTADA DESPUÉS de que el par ya se votó.
--
-- Vive aparte de `votos_look` a propósito, y la distinción es todo el punto:
--
--   votos_look  → se emitieron A CIEGAS y ANTES de poder ver el marcador.
--                 Son los que derivan `voto`, y `voto` es lo que la regla
--                 pre-registrada lee. Sellados.
--   prefs_look  → se anotan al completar las marcas, cuando la corrida ya
--                 tiene todos sus votos y el reveal es alcanzable. Siguen
--                 siendo ciegos por par (las columnas nunca dicen qué variante
--                 son), pero ya no son ciegos al marcador global.
--
-- Por eso NO derivan `voto` ni lo modifican. Son una segunda lectura, más
-- débil y etiquetada como tal — y existe porque los primeros 16 pares del
-- veredicto se votaron mirando solo el primer look: la preferencia sobre los
-- looks 2 y 3 no estaba registrada en ninguna parte.
--
-- Forma: {"<variante>": {"<índice de look>": "gana"}} — misma que votos_look,
-- resuelta a la variante real para que el ciego no viva en la base.
alter table comparador_motor_pares
  add column if not exists prefs_look jsonb;

comment on column comparador_motor_pares.prefs_look is
  'Preferencia por look anotada tras el voto (post-reveal del marcador global). NO deriva voto ni cuenta para la regla pre-registrada.';
