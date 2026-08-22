# El improvement loop del motor

> **Qué evaluamos, con qué lo medimos, y qué tiene que pasar para que un cambio
> del motor salga a producción.**
>
> Documento canónico. Si algo de aquí y el código no coinciden, gana el código
> y este archivo está mal — arréglalo en el mismo commit.
> Escrito el 2026-08-19; la metodología pareada viene de
> `docs/como-decidir-un-cambio-del-motor.md` (2026-08-07), que sigue vigente y
> es la lectura técnica complementaria.

---

## 1. Por qué existe este documento

El 19 de agosto de 2026 salieron **nueve versiones del motor en 48 horas**.
Todas se midieron. Ninguna se midió contra la anterior.

Cada cambio se validó con su propio termómetro — "¿ya entrega 3 looks?", "¿la
regla dispara?", "¿desaparecieron los trajes en la cita?" — y todos dijeron que
sí. Mientras tanto la aprobación de Roberto sobre los mismos 6 briefs y el
mismo clóset se caía:

| ronda | prompt | 👍 | 👎 | aprobación |
|---|---|---|---|---|
| 2026-08-18 · 283d8d44 | v53 | 29 | 3 | **91%** |
| 2026-08-19 · 8f3647f3 | v55 | 23 | 9 | 72% |
| 2026-08-19 · 8559ec99 | v56 | 16 | 15 | **52%** |

Nadie lo vio hasta que Roberto votó la tercera ronda y dijo "es la peor que ha
salido, una basura". Se revirtió el texto del generador a v53 (prompt v57,
v0.2.266.0).

**La lección no es "medir más". Es medir LO CORRECTO:** el termómetro de un
arreglo dice si el arreglo funcionó, no si el motor mejoró. Sólo una cosa dice
eso, y es la sección 3.

---

## 2. Qué estamos evaluando exactamente (el universo)

Todo lo que sabemos de la calidad del motor sale de **rondas del comparador
votadas por Roberto**. Números reales al 2026-08-19:

| ronda | fecha | tipo | prompt | 👍 | 👎 | aprob. | comentarios | calif. al juez |
|---|---|---|---|---|---|---|---|---|
| 5d69fad7 | 08-06 | vistazo | v38 | 34 | 1 | 97% | 0 | — |
| ebaa9c40 | 08-06 | vistazo | v38 | 24 | 1 | 96% | 1 | — |
| 1a54eb73 | 08-06 | veredicto | v38 | 78 | 10 | 89% | 21 | — |
| 866ca13b | 08-07 | vistazo | v39 | 23 | 12 | 66% | 8 | — |
| 7d6bcd0d | 08-07 | veredicto | v43 | 102 | 24 | 81% | 36 | — |
| 1567b039 | 08-14 | veredicto | v52 | 101 | 15 | 87% | 34 | — |
| 283d8d44 | 08-18 | vistazo | v53 | 29 | 3 | 91% | 7 | 24 |
| 8f3647f3 | 08-19 | vistazo | v55 | 23 | 9 | 72% | 15 | 19 |
| 8559ec99 | 08-19 | vistazo | v56 | 16 | 15 | 52% | 16 | — |
| **total** | | | | **430** | **90** | **83%** | **138** | **43** |

Más: **105 pares votados** (qué lado ganó), **849 looks** guardados con sus
**252 críticas del juez**.

### ⚠️ De esos 520 votos, sólo 95 son utilizables

**El clóset de Roberto se recreó el 2026-08-18** (sus 65 prendas tienen esa
fecha de alta; ver `corpus-de-prendas-y-cuentas`). Los looks del comparador
guardan **sólo `item_ids`**, no los nombres de las prendas — así que los 393
votos de las rondas del 6 al 14 de agosto apuntan a prendas que ya no existen:
**0 de sus ids resuelven**. El voto sobrevivió; el look que lo motivó, no.

| | votos | ¿se puede reconstruir el look? |
|---|---|---|
| rondas 08-06 a 08-14 (v38–v52) | 393 | ❌ ninguna prenda viva |
| rondas 08-18 y 08-19 (v53, v55, v56) | **95** | ✅ todas |

Consecuencias, y las tres importan:

1. **La base real para calibrar al juez son 95 looks (27 👎), no 520.** Cualquier
   porcentaje sobre esa base se mueve varios puntos con un solo caso.
2. **Deuda a pagar antes de la próxima ronda:** que `comparador_motor_lados.looks`
   guarde el **nombre** de cada prenda junto al id. Es aditivo y barato, y hace
   que el histórico sobreviva al siguiente reseteo de clóset. Sin eso, cada
   limpieza de cuentas borra la base de evaluación en silencio.
3. **Los 138 comentarios de Roberto NO se perdieron** — son texto, no ids. Siguen
   sirviendo como corpus de sus criterios ("no van los mocasines negros con
   chinos beige"), que es de donde salen las reglas. Lo que se perdió es la
   capacidad de reproducir el look.

### Cómo leer esa tabla sin engañarse

- **Los vistazos son comparables entre sí**: siempre los mismos 6 briefs (cita,
  oficina templado, boda, diario frío 8°, oficina calor, diario lluvia) sobre el
  mismo clóset. 91% → 52% es una caída real, no ruido de escenario.
- **Los veredictos ciclan el pool completo** (22 pares). Su aprobación NO es
  comparable con la de un vistazo.
- **El universo está desbalanceado: 83% son 👍.** Un juez que dijera "todo bien,
  siempre" acertaría 83% y sería inútil. **La cifra que importa son los 90 👎:
  ¿los caza?** Nunca reportar "acierto global" sin el recall de los 👎.
- **Los 138 comentarios valen más que los 520 pulgares.** El pulgar dice *qué*;
  el comentario dice *por qué* ("habíamos quedado que lino no para el trabajo").
  Son los que se convierten en reglas.

### Lo que NO tenemos, y hay que decirlo en voz alta

- **Roberto tiene 0 votos en producción.** Toda su señal es del comparador:
  looks generados para compararse entre sí, no looks que usó un martes.
- **Entre TODAS las usuarias hay 22 votos** en la app real (16 👍 / 6 👎) y
  11 "me lo puse". La señal de producto es casi inexistente — ver
  `experimento-quien-usa-de-verdad`.
- **De los 520 votos, 393 quedaron huérfanos** al recrearse el clóset (ver el
  recuadro arriba). Utilizables: 95.
- **Es un solo clóset y una sola persona.** Un juez calibrado aquí replica a
  Roberto (hombre, su colorimetría, sus 65 prendas). Para Tatiana o Andy no
  está probado, y hoy no hay con qué probarlo (3 y 4 votos).

---

## 3. Las cuatro varas, y quién sostiene cada una

| vara | qué contesta | quién | costo | ¿decide? |
|---|---|---|---|---|
| **Reglas de código** (`reglas-ejecucion.ts`) | ¿rompe algo comprobable? | nadie, corre solo | gratis | no, pero **repara** |
| **Eval** (`/admin/evales`) | ¿en qué nivel absoluto está? | automático | ~$ | no |
| **Juez** (`critic.ts`, `juez-stylist.ts`) | ¿qué falla y cómo se arregla? | modelo | ~$0.5/ronda | **hoy no** (ver abajo) |
| **Voto de Roberto** (pareado) | **¿este cambio mejora?** | Roberto, 10 min | ~$2/ronda | **SÍ** |

**Hoy el juez NO decide, y hay que saber por qué:**

- El juez de producción lleva **0 rechazos en 64 looks** — prefiere entregar
  roto antes que rechazar (por eso el punto 4b sigue gateado a una señal que
  nunca llega; ver `motor-4-reject-regen-gating`).
- En la ronda que Roberto calificó de basura, las rúbricas dieron "producción
  5-1" mientras su aprobación caía a 52%. **El juez no vio la regresión.**
- Su problema no es equivocarse al señalar: de sus 43 calificaciones, 30 fueron
  "acuerdo" y 13 "exageró". Nótese que **"exageró" ≠ "erróneo"** — es "eso está
  ahí, pero no me importa tanto". Contarlos como fallos fue un error de lectura
  (de ahí salió el "47% de acierto", que subestima al juez).
- **Su problema es lo que NO ve**: chaqueta ligera a 8° teniendo abrigo, lino en
  oficina, tenis rojos con traje. Ve bien y castiga poco.

**A dónde va esto:** que el juez pueda votar en lugar de Roberto — el loop
automático A vs B. La condición es calibrarlo primero contra los 520 votos y
que pase una vara (sección 6). Optimizar contra un juez no validado es
optimizar contra una moneda al aire.

---

## 4. El proceso, paso a paso

**Una cosa por vuelta.** Nueve cambios en 48h fue el error; el ritmo sano es
uno o dos por día.

1. **Elegir UN cambio.** Si toca dos cosas, el resultado no dice cuál causó qué.
2. **Clasificarlo** — y esto decide el resto del camino:
   - **Regla de código** (verificable: materiales, temperatura, colores, capas)
     → riesgo bajo. Se prueba contra los looks ya votados (ablación, gratis) y
     sólo pasa si dispara en los 👎 correctos y en **cero** de los 👍.
   - **Cambio de prompt** (gusto, criterio, tono) → riesgo alto. **Cambia todos
     los looks, incluidos los que iban bien.** Es lo que rompió v54 y v56.
3. **Un flag que lo apague**, en `OpcionesGeneracion`, y su variante en
   `VARIANTES_MOTOR` (`lib/comparador/motor.ts`) con su `ayuda`.
4. **La regla pre-registrada, ANTES de generar.** Qué cuenta como ganar y qué se
   hace si pierde. Explicar la derrota después de verla es lo que el
   pre-registro mata.
5. **Congelar el prompt vigente ANTES de subir de versión — obligatorio:**
   `npx tsx scripts/prompt-congelar.ts roberto@kublau.com --nota "qué cambió"`.
   Es lo que alimenta al retador `prompt-anterior` (paso 6): sin congelado de la
   versión de ayer, ese lado falla claro y la ronda no se puede correr.
   Hacerlo el día que la versión está viva es trivial; reconstruirla después es
   arqueología.
6. **Generar y juzgar.** Para un cambio del motor el retador es
   `prompt-anterior` (la versión de ayer con el juez y el reparador de hoy);
   los demás retadores (apagar un flag, otro modelo) son para ablaciones:
   ```
   npx tsx scripts/correr-vistazo.ts prompt-anterior roberto@kublau.com
   npx tsx scripts/comparador-juzgar.ts <corridaId>
   ```
   Ojo al leer: en este retador **"Producción" es lo nuevo** y "Prompt
   anterior" es el control. Si el control gana, lo nuevo no sale.
7. **Roberto vota** en `/admin/comparador/motor/<id>` (10 min). Sólo 👍/👎 por
   look. Calificar al juez es opcional y sólo cuando se esté calibrando al juez.
8. **Decidir contra la regla pre-registrada.** Cruce en `/<id>/cruce`.
9. **Si sale, se documenta**: CHANGELOG + fila en la bitácora (sección 7).

---

## 5. Las reglas duras

1. **Ningún cambio del motor sale sin una ronda "nuevo vs anterior" con
   aprobación de Roberto igual o mayor.** La que faltó esta semana.
   El retador `prompt-anterior` existe desde v0.2.268.0; exige congelar antes
   de subir de versión (paso 5 del proceso).
2. **El termómetro de un arreglo no es el termómetro del motor.** "La regla
   dispara" no es "el motor mejoró".
3. **Un vistazo de 6 pares tiene ±12 puntos de ruido** (medido: 76% y 88% con el
   mismo código). Sirve como **guardia contra regresiones** (91→52 se ve
   clarísimo), no para detectar mejoras chicas. Una ventaja de ~5 puntos no es
   una ventaja: confírmala con un veredicto de 20 pares antes de creerla.
4. **Lo comprobable va en código, no en el prompt.** De los 15 👎 del 19 de
   agosto, 13 eran comprobables. El reparador de cueros bajó los looks rotos de
   3 a 0 sin tocar el prompt; v54 y v56 tocaron el prompt y costaron 39 puntos.
5. **Decirle al motor qué NO hacer sin decirle qué SÍ, lo obliga a improvisar.**
   v56 quitó los trajes en la cita y trajo mezclilla + blazer. Toda prohibición
   nueva lleva su alternativa.
6. **Una regla de gusto necesita ≥2 confirmaciones de Roberto** en rondas
   distintas antes de entrar al prompt. Es su guardrail contra el whack-a-mole.
7. **Nunca optimizar contra el juez sin re-medir su acuerdo con Roberto.** Un
   juez contra el que se optimiza deja de medir.
8. **Los reportes de rondas viven en pantallas de la app, nunca en archivos
   HTML** — un archivo no captura su opinión (`rondas-en-la-app-no-html`).

---

## 6. El plan del loop automático (a dónde va esto)

La meta de Roberto: A vs B corriendo solo, el juez decidiendo, retadores que se
suceden. Tres etapas, y la primera es la que habilita todo:

**Etapa 1 — calibrar el juez contra los votos utilizables (95, no 520).** El juez lee un look y
predice 👍/👎; se mide contra el voto real de Roberto en looks que no vio al
afinarlo. Vara para soltarlo: **≥85% de acuerdo, y recall alto sobre los 90 👎**
(la primera ronda calificada dio 88%, así que es alcanzable). Sin tocar el motor.

**Etapa 2 — loop con correa.** El juez decide A vs B, pero: las reglas de código
que proponga salen solas (con ablación); los cambios de prompt los **propone,
no los shippea**; y Roberto vota **1 de cada 3 rondas** como auditoría. Si su
voto y el del juez se separan, el loop se detiene.

**Etapa 3 — la escalera de retadores** tal cual la describió Roberto: el que
gana se vuelve el actual y aparece un retador nuevo. Sólo cuando la etapa 2
acumule varias vueltas sin que la auditoría la desmienta.

---

## 6-bis. El examen del juez (2026-08-22, sobre los 95 utilizables)

Para cada look se cruzó el voto de Roberto con la crítica que el juez stylist
ya tenía guardada. Base: 27 👎 y 68 👍. *(Un juez que dijera "todo bien" siempre
acertaría 72% — por eso la cifra que importa es la primera columna.)*

| umbral del juez | js3 (guardado) | **js5** (2026-08-22) |
|---|---|---|
| sólo "rompe" — caza 👎 / falsa alarma 👍 | 22% / 7% | **48% / 12%** |
| "rompe" o "resta" — caza 👎 / falsa alarma 👍 | 70% / 56% | **85% / 40%** |
| cualquier hallazgo — caza 👎 / falsa alarma 👍 | 85% / 69% | 89% / 66% |

Se mide con `npx tsx scripts/examen-juez.ts` (en seco, $0) o `--correr` (el
juez vigente sobre los mismos looks, ~$0.08). **js5 se afinó mirando estos 95
looks, así que su número es optimista: el que vale es el de la próxima ronda
votada.** Lo que cambió de js3 a js5: la vara de Roberto escrita con sus casos
(qué le hace decir "ni al caso" y qué aprueba sin comentario), "plano" fuera de
lo que pesa, y dos líneas de REGLAS_DE_LA_CASA que sus votos refutaron
(burdeos no es café; una pieza de lino en oficina ya resta).

**Diagnóstico: el juez ve, pero no pesa.** Ejemplos textuales: "camisa negra
para una boda es como de cholo… fatal, fatal, fatal" → el juez lo puso
`color/resta`. "Camisa de mezclilla con blazer, hazme el puto favor" →
`plano/resta`. Dos 👎 pasaron sin **ningún** hallazgo: el lino en la oficina y
la camisa de vestir bajo la overshirt.

Recalibrar un umbral es mucho más barato que enseñar a ver — pero la validación
tiene que ser sobre rondas NUEVAS, porque estos 95 looks son también los que se
usarían para afinar.

## 7. Bitácora de rondas

Una fila por ronda. **Se llena el día que se corre**, no después.

| fecha | ronda | prompt | retador | aprob. | qué se decidió |
|---|---|---|---|---|---|
| 08-06 | 5d69fad7 | v38 | — | 97% | — |
| 08-06 | ebaa9c40 | v38 | — | 96% | — |
| 08-06 | 1a54eb73 | v38 | — | 89% | — |
| 08-07 | 866ca13b | v39 | — | 66% | — |
| 08-07 | 7d6bcd0d | v43 | — | 81% | — |
| 08-14 | 1567b039 | v52 | — | 87% | — |
| 08-18 | 283d8d44 | v53 | sin-coherencia-cromatica | **91%** | empate; la regla de color no se gana el lugar (1ª vez) |
| 08-19 | 8f3647f3 | v55 | sin-reparar-codigo | 72% | el reparador se queda (cueros rotos 3 → 0) |
| 08-19 | 8559ec99 | v56 | sin-coherencia-cromatica | **52%** | **regresión**: revertido a v53 (prompt v57). La regla de color pierde 3-1 (4ª ronda sin ganar) |

---

## 8. Estado al 2026-08-19 y qué sigue

**Vigente:** prompt v57 = el texto de v53 (el del 91%). Se quedan las reglas de
código de v55, el reparador de cueros, js3 (el juez conoce las reglas de la
casa) y los grados en el brief.

**La fila, en orden, uno a la vez y cada uno medido:**

1. ✅ **Retador "prompt anterior"** — HECHO v0.2.268.0. Variante
   `prompt-anterior`: corre la última versión congelada de este clóset dentro
   del pipeline de hoy; se rehúsa si no hay congelado, si el pool cambió o si
   el clóset cambió. v57 ya está congelado como primera línea base.
2. ✅ **Guardar el nombre de las prendas en los looks del comparador** — HECHO
   v0.2.267.0: `LookMotor.prendas` se congela al generar (`conNombres`), el
   script que juzga lo usa de respaldo, y los 102 lados vivos se rellenaron. Los
   203 huérfanos quedan como están: no hay de dónde sacar el nombre.
3. ✅ **Calibrar la GRAVEDAD del juez** — HECHO v0.2.269.0 (js5), ver 6-bis.
   Pendiente de VALIDAR en la próxima ronda votada: si "rompe" se sostiene
   cerca de 45-50% de caza con ≤15% de falsa alarma sobre looks que no vio,
   el juez puede empezar a votar con correa (etapa 2).
4. **Abrigo de verdad para el frío.** Validado por sus votos: los 3 looks con el
   abrigo de lana → 👍👍👍; los de chaqueta ligera a 8° → "ninguno está bien
   para ese frío". Las prendas ya traen `temporada`.
5. **Lino en oficina con UNA sola pieza.** Dicho 4 veces el 08-19.
   `full-lino-en-oficina` está acotada a lino arriba **y** abajo y ese recorte
   quedó refutado.
6. **Manga corta bajo chamarra** (2 👎).
7. **Calzado que choca con la base** (tenis rojos con traje, bota café con
   pantalón negro, derby chocolate en total black).
8. **Quitar la coherencia cromática** — 4 rondas sin ganarse el lugar. Baja
   prioridad: quita ruido, no sube calidad.

**Pool v9, preparado en la rama `pool-v9` (2026-08-22), se mergea DESPUÉS
de que Roberto vote la ronda 2bba08e0.** Los `plan` de los eventos pasan de
etiqueta de catálogo ("una cita en un restaurante") a lo que diría una persona
en el wizard ("una cita para cenar con alguien que me gusta — es la segunda
vez que salimos; restaurante de mantel, viernes a las 9"). Roberto: "¿qué tipo
de cita? hay muchísimos contextos que influyen" — y el motor recibía el mismo
texto que él. Consecuencias: (1) las aprobaciones de v8 y v9 no se comparan
entre sí — la bitácora arranca línea base nueva; (2) hay que **re-congelar v57
bajo pool v9** (`scripts/prompt-congelar.ts`) antes de la siguiente ronda con
`prompt-anterior`, porque el congelado de v8 ya no casa.

**Conversaciones abiertas** (no son tareas): el rol del juez de producción
(¿recompone o sólo detecta? mete 5 violaciones por 3 que arregla), versionar el
prompt del juez (hoy no se versiona), y el contexto por persona.
