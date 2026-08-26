# Norma vs código: la formalidad sólo viaja si fue declarada

> Diseño acordado con Roberto la noche del 2026-08-25, para ejecutarse en
> sesión limpia. Estado APROBADO EN DIRECCIÓN, pendiente su OK final sobre
> este doc antes de tocar código. Leer junto con
> `docs/registro-por-ocasion.md` (la investigación que alimenta la capa de
> norma) y la memoria `improvement-loop-plan-agosto`.

## El problema, con la línea exacta

Roberto, votando la ronda de v73: *"con esas reglas estamos forzando a que
todas las cenas o comidas sean de saco… le estamos diciendo que siempre con
cóctel"*. Tiene razón, y es arquitectura:

**`components/weather-picker.tsx:468`**:
```ts
const formality = formalityManual ?? formalidadDeEvento(tipoEfectivo, momento) ?? null;
```
Si el usuario no toca los chips, **el default del catálogo se estampa como si
fuera un código declarado**. El sistema entero (generador, jueces, pantalla de
votar, briefs del pool) recibe *"Formalidad del evento: semiformal/coctel —
RESPÉTALA"* — la misma línea que produciría una invitación real. El motor no
puede distinguir "la invitación pide coctel" de "asumimos semiformal porque es
una cita". Era la fuente de fondo del overdressing que v71 y v72 trataban por
síntomas.

Y hay una **segunda escalada escondida**: cuando NO hay formalidad, el prompt
(`lib/engine/prompt.ts`, bloque de formalidad, rama `else if objective ===
"evento"`) dice *"Es un evento: en México tienden a ser más formales…
arréglalo más"* — otra empujada hacia arriba sin código.

## El principio (sombrero de stylist)

- **Ocasiones con CÓDIGO** (boda, gala, funeral, oficina formal): hay
  invitación o institución. El código se obedece como hoy (v71: techo/piso
  según dial). No se toca.
- **Ocasiones con NORMA** (cita, cena, fiesta, diario): nadie declaró nada;
  existe una costumbre con **rango** — la cena admite desde camisa + jeans
  oscuros hasta blazer. **La norma es un rango con centro; el código es un
  punto.** El pecado era estampar un punto sobre un rango.
- Red de seguridad: las líneas de norma del catálogo (v72/v73 en la rama
  `motor-v73`) ya cargan piso y techo ("un escalón arriba del diario", "el
  blazer es el techo"). Quitar el código fantasma no es permitir fachas.

## Sombrero de usuario (por qué esto ataca al enemigo #1)

- El enemigo del producto es la FRICCIÓN (CLAUDE.md). Tatiana no sabe si su
  cena es "semiformal · coctel" — ni debería. La pregunta pasa a *"¿trae
  dress code?"*, opcional; no contestar es la respuesta normal.
- La etiqueta de vuelta, sin código, habla en la voz del producto: *"sin
  dress code — te visto como se viste la gente para esto"*.
- El dial por fin respira: hoy "relajado" peleaba contra un código que nadie
  pidió; con norma, mueve el centro del rango.

## Los 6 pasos (sombrero de AI)

1. **Gate en el picker**: `formality` sale SOLO si es manual
   (`formalityManual`) o si el plan la nombra. El default del catálogo puede
   seguir mostrándose como *pista* en la UI ("lo típico aquí: saco sin
   corbata"), nunca viajar como código. UI: chips sin preselección + estado
   visible "sin código".
2. **Fallback del prompt → framing de norma**: la rama `else if evento`
   ("arréglalo más") se reemplaza por *"no hay código declarado — viste según
   cómo se viste la gente para esto (la línea del plan) y su dial; no lo
   trates como si hubiera invitación"*. OJO: esto es texto del GENERADOR →
   forma parte de v73, no del "mundo".
3. **Etiqueta de la pantalla de votar** (y del calibrador del eval): con
   formalidad null, mostrar "sin código declarado" en vez de traducir el
   código fantasma.
4. **Pool v11**: los briefs sociales (citas, cena-amigos, fiesta,
   comida-trabajo) pierden la formalidad estampada; boda/funeral/gala la
   conservan. `POOL_VERSION` v10→v11. **Cambio de pool = línea base nueva:
   re-congelar v71 bajo v11** (`scripts/prompt-congelar.ts`).
5. **Ronda**: v73-mundo-nuevo vs v71 (re-congelado), veredicto 20 pares
   (~$7). **Pre-registro sin ambigüedad: métrica primaria = aprobación en los
   briefs sociales ≥ v71; global como guardia de no-regresión.**
   Honestidad pactada: v73 lleva junto carnita + eje noche + fallback nuevo —
   tres piezas de UN diseño; si gana no se sabrá qué sub-pieza aportó cuánto,
   y se acepta (precedente: v71 llevó dos piezas).
6. **Cerrar la ronda 50794c69 en la bitácora SIN VOTAR** (instrumento sobre
   mundo viejo — precedente ba8f4caa/6868a52b). Roberto votó ~1 par; no se
   usa.

## Estado del mundo al cerrar la sesión del 2026-08-25 (para retomar)

- **Prod / main**: prompt **v71** (v0.2.289.0 mergeado tras ganar 259f284e
  93% vs 75%). v71 congelado DOS veces: la segunda (la válida) bajo pool v10
  CON el dial de fiesta sembrado.
- **Dial de Roberto**: `{cita, cena-amigos, fiesta}` = relajado (fiesta se
  sembró hoy con su OK).
- **Rama `motor-v73`** (sin mergear): las 4 líneas de catálogo con carnita +
  eje día/noche (v0.2.291.0, PROMPT_VERSION v73). La cláusula de noche está
  medida: beige/caqui de noche 2👎/0👍 (vetado), gris medio mixto 3👍 (NO
  vetado a propósito).
- **Rondas huérfanas**: 50794c69 (v73 vs v71, generada y juzgada, ~1 par
  votado) → cerrar sin votar, paso 6. La 65ded440 (v72) ya está cerrada en la
  bitácora como NO ENTRA.
- **Rama `motor-v72`**: obsoleta (v73 la continúa); borrarla al mergear v73.

## Cómo retomar mañana

En sesión nueva: *"lee docs/designs/norma-vs-codigo.md y ejecuta los 6
pasos"*. El doc + la memoria + la bitácora traen todo; no depende del chat de
hoy.
