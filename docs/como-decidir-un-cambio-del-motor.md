# Cómo decidir si un cambio del motor mejora

Escrito el 2026-08-07, después de shippear ocho versiones del motor en un día
sin poder demostrar que ninguna mejorara. Esto es lo que se aprendió y lo que
hay que hacer en su lugar.

## El número que lo empezó todo

Dos corridas del eval **con el mismo código** dieron **76% y 88%** de aprobación.

Doce puntos de diferencia sin que nada cambiara. Con esa varianza, comparar dos
versiones con una corrida cada una **no puede distinguir** una mejora de 5-10
puntos del ruido. Y así se tomaron varias decisiones ese día.

**La varianza que domina es la del DÍA, no la del motor.** Un brief de lluvia
con un clóset corto produce peores looks que uno de diario templado; qué briefs
le toquen a cada corrida mueve el promedio más que el cambio que se quiere
medir.

## La regla

> **Un cambio del motor se decide con el comparador PAREADO, nunca con dos
> corridas sueltas del eval.**

Comparar A y B sobre el **mismo** brief cancela la varianza del día por
construcción. Es la diferencia entre medir dos personas con la misma báscula y
medirlas en dos básculas distintas.

| | sin parear | pareado |
|---|---|---|
| muestra para detectar +0.2 pts | ~169 looks por lado | **~22 pares** |
| costo | ~$26 | **~$3** |
| ¿el ruido del día se cuela? | sí | no |

## El procedimiento

**1. Un flag que apague el cambio.** Una variante cambia **UNA** sola cosa; si
cambiara dos, el resultado no diría cuál causó la diferencia. Va en
`OpcionesGeneracion` y se propaga hasta donde haga falta.

**2. La variante, en `VARIANTES_MOTOR`** (`lib/comparador/motor.ts`), con su
`ayuda` explicando qué mide.

**3. La regla pre-registrada, ANTES de generar.** Qué cuenta como ganar y qué se
hace si no gana. Explicar la derrota después de verla es justo lo que el
pre-registro mata.

**4. Generar y juzgar:**

```bash
npx tsx scripts/comparador-generar.ts <corridaId>
npx tsx scripts/comparador-juzgar.ts <corridaId>
```

El marcador sale también en `/admin/comparador/motor/<id>`.

**5. Leer el `t`, no el marcador.** `|t| > 2` es señal; por debajo, la
diferencia no sobrevive al ruido y el script dice cuántos pares harían falta.

## Lo que este instrumento NO decide

**Qué modelo usar.** Un juez Claude tiende a preferir looks escritos por Claude,
y ese sesgo corrompe un Opus-contra-Gemini. Eso se queda con el **voto ciego
humano**. El script avisa solo cuando las dos variantes cambian de modelo.

**Si el motor es bueno en términos absolutos.** El pareado dice "A contra B",
no "A está bien". Para el nivel absoluto está el eval (`/admin/evales`), y para
saber si la rúbrica sigue siendo confiable está la calibración humana — que se
re-mide, no se asume.

## Las tres capas, y para qué sirve cada una

| capa | qué responde | cuándo |
|---|---|---|
| **reglas de código** (`reglas-ejecucion.ts`) | ¿rompe algo comprobable? | siempre, gratis |
| **eval** (`/admin/evales`) | ¿en qué nivel está el motor? | por versión |
| **comparador pareado** | ¿este cambio mejora? | **para decidir** |
| **calibración humana** | ¿la rúbrica sigue viendo como Roberto? | cada tanto, 20-30 looks |

La cuarta no es opcional: un juez contra el que se optimiza deja de medir. El
acuerdo con Roberto se **re-mide** (últimas: 90% texto, 90% visión), no se
supone.
