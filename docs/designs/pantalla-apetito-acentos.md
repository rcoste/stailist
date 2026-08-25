# La pantalla de apetito de acentos — "¿cuál te pondrías tú?"

> Decisión de Roberto (2026-08-25): el apetito NO se deriva de los swipes
> como medición — "gustar de una carta mide su estética completa, no el
> volumen de color". La derivación queda como semilla (fuente 'swipes');
> esta pantalla es la medición (fuente 'elegido'). Hermana de diseño de la
> pregunta de corte (fit_pref): aislar UNA variable con el mismo look.

## Qué mide

El volumen de color que la persona quiere llevar — la dimensión de intake
de stylist "¿cuánta atención quieres que atraiga tu ropa?". Tres posiciones:

- **discreto** — tonal, neutros, el color casi no habla
- **medio** — un acento chico y deliberado (bufanda, calcetín, calzado, bolso)
- **protagonista** — una pieza grande de color como statement

Independiente de la colorimetría (QUÉ colores) y del arquetipo (qué vibe).
Marco: `docs/designs/acentos-y-colorimetria-por-zona.md`.

## El diseño, y las tres decisiones que lo blindan

**1. MISMO look base, solo cambia el acento.** Tres fotos del mismo outfit:
la única diferencia entre ellas es dónde y cuánto color hay. Si cambia la
silueta o el registro entre fotos, se vuelve a medir "qué estética te
gusta" — el error exacto de derivar de los swipes.

**2. La pregunta es "¿cuál te pondrías TÚ?"** — no "¿cuál se ve mejor?".
Es la lección del propio Roberto con el cobalto: aprobar un look ("se ve
bien") y ponérselo son varas distintas, y esta pantalla existe para medir
la segunda.

**3. El color del ejemplo es FIJO y seguro, no personalizado.** La pantalla
mide volumen, no matiz. Un color que lee bien en casi toda colorimetría y
no pisa el veto de la casa (nada de ámbar/terracota/naranja): **burdeos** o
**verde botella**. Personalizar el color por estación de quien mira sería
ideal pero exige generar imágenes por estación (16+ fotos); v1 no.

## Los tres niveles, por género

**Hombre** — base: suéter/playera + pantalón + calzado en neutros (carbón,
marino, crudo):
1. discreto: la base tal cual, tonal — el interés es la textura
2. medio: misma base + **calcetín o bufanda burdeos** (o mocasín burdeos)
3. protagonista: la MISMA silueta con el **suéter en burdeos**

**Mujer** — base: knit + pantalón/falda + zapato en neutros:
1. discreto: tonal
2. medio: misma base + **bolso o zapato burdeos**
3. protagonista: el **top/knit en burdeos**

## Dónde vive

- **Onboarding:** un paso después del quiz de colorimetría (ya con el
  "reveal" fresco, el color está en mente). UNA pantalla, tres cartas,
  un tap. Skippable: si salta, queda la semilla de swipes. Costo ~8-10s
  contra la promesa de 90 — a decisión de Roberto si entra al flujo o
  queda solo para el Perfil.
- **Usuarios existentes:** entrada en Perfil → estilo (junto al dial de
  registro): muestra el valor derivado con la etiqueta "derivado de tus
  swipes — confírmalo" y las tres cartas para elegir. Elegir escribe
  fuente 'elegido'.

## Datos (ya migrado)

`profiles.acento_apetito` ('discreto'|'medio'|'protagonista') +
`acento_apetito_fuente` ('swipes'|'elegido'). El manual/elegido gana
siempre; el backfill de swipes jamás pisa un 'elegido'.

## Imágenes

6 fotos (3 niveles × 2 géneros), pipeline de la casa (gen-looks-genz.mjs,
concreto frío — mismo lenguaje visual del deck para que no se sienta de
otra app). Modelos: reglas de siempre (México: piel morena/mestiza).
Es el long pole del build: generarlas, pasar el ojo de Roberto, y recién
entonces armar la pantalla.

## Qué NO hace (todavía)

El motor no lee `acento_apetito` — el loop está en pausa. Cuando despierte,
la línea del prompt que lo consume entra con su ronda medida, igual que el
dial de registro (v60): sin dial, texto idéntico; con dial, la línea dice
hacia dónde Y qué sí.

## Orden de build

1. ✅ Datos + semilla + fuente (0149, 0150)
2. Imágenes (6) → ojo de Roberto
3. Card en Perfil → estilo (patrón del dial de registro)
4. Paso de onboarding (si Roberto decide que entra al flujo)
5. (con el loop despierto) la línea del motor + su medición
