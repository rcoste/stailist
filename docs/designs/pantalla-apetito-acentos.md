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

## El diseño: grid de 3 niveles × 2 contextos, se elige la FILA

Diseño cerrado con Roberto (2026-08-25) después de descartar dos versiones
peores. La forma final es suya; el aislamiento de la variable es la lección
de `pares-corte.tsx`.

```
                 frío                        calor
discreto     abrigo + crew MARINO        polo NEUTRO
             (todo tonal)                (todo tonal)
medio        + bufanda burdeos           + tenis/cinturón burdeos
protagonista abrigo + crew COBALTO       polo ESMERALDA
```

**Se toca la FILA, no la celda.** La fila es el nivel; las dos columnas son
el mismo nivel en dos climas. Sin esto la respuesta sería ambigua ("¿eligió
por el acento o porque le gustó más el look de invierno?") — el error que
`pares-corte.tsx` documenta y que ya nos costó una vez.

**Dentro de cada columna, el look base es IDÉNTICO entre filas.** Misma
persona, misma pose, misma luz, mismas prendas: lo único que cambia es el
color de UNA pieza (o la aparición del acento chico). Ejemplo de Roberto,
literal: "la primera es el abrigo con un crew neck azul marino, que es más
neutral; el otro es con el cobalto".

**NO se segmenta por el clima de quien mira** — se le enseñan los dos.
Decisión de Roberto, y es la correcta: el apetito de acentos es un rasgo
ESTABLE de la persona; lo que cambia con el clima es el VEHÍCULO del acento
(bufanda en frío, calzado en calor), no cuánto acento quiere. Mostrar los
dos contextos calibra el gusto general y de paso enseña qué significa el
nivel en cada estación. (Se descartó mostrar solo el clima de hoy vía
Open-Meteo: mediría la situación, no el rasgo.)

**Los vehículos se eligen por VISIBILIDAD, no por ortodoxia.** El acento
más clásico de nivel medio en hombre es el calcetín, y en una miniatura no
se ve. Se usan bufanda (frío) y tenis o cinturón (calor), que son igual de
legítimos y sí se leen. Esto importa: la lección del 2026-08-17 (fotos de
cuerpo entero ilegibles en media pantalla) aplica al detalle fino, pero el
COLOR sobrevive a la miniatura mucho mejor que el corte — por eso este grid
puede tener 6 fotos donde `pares-corte` sólo podía con 2.

**La pregunta es "¿cuál te pondrías TÚ?"** — no "¿cuál se ve mejor?". La
lección del cobalto: aprobar y ponerse son varas distintas, y aquí medimos
la segunda.

**El color del acento es fijo y seguro** (burdeos/cobalto/esmeralda según
la pieza): la pantalla mide VOLUMEN, no matiz. Ninguno pisa el veto de la
casa (ámbar/terracota/naranja). Personalizar el matiz por estación de la
persona exigiría 16+ fotos; v1 no.

**Sin etiquetas de nivel bajo las fotos.** Igual que en `pares-corte`:
poner "discreto/medio/protagonista" convertiría "¿cuál te pondrías?" en
"¿cuál es la respuesta correcta?". El texto de cada fila, si acaso, describe
la escena, no el nivel.

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

12 fotos (3 niveles × 2 contextos × 2 géneros), pipeline de la casa (gen-looks-genz.mjs,
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
2. Imágenes (12: 3 niveles × frío/calor × 2 géneros) → ojo de Roberto
3. Card en Perfil → estilo (patrón del dial de registro)
4. Paso de onboarding (si Roberto decide que entra al flujo)
5. (con el loop despierto) la línea del motor + su medición
