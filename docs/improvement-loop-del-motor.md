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

### El clóset de referencia (v1, 2026-08-22)

**Todas las corridas se generan sobre el clóset vivo de `roberto@kublau.com`.**
Roberto lo curó el 22 de agosto y decidió que ese sea la base de las pruebas:

| categoría | prendas | con foto suya |
|---|---|---|
| top | 48 | 12 |
| bottom | 27 | 1 |
| accesorio | 18 | 4 |
| calzado | 17 | 0 |
| abrigo | 12 | 3 |
| saco | 7 | 1 |
| **total** | **129** | **21** |

Perfil que lee el motor: hombre, 35-44, 183 cm, complexión promedio, corte
recto, **Invierno profundo** (base invierno con inclinación a otoño; prestados
vino y chocolate; evita camel, mostaza, beige amarillento), arquetipo "Pulido
con filo", dress code de trabajo *variable*, sin vetos declarados.

**LA REGLA QUE SALE DE AQUÍ: cambiar el clóset es abrir línea base nueva.** Ya
pasó dos veces — el reseteo del 18 de agosto dejó 393 votos huérfanos, y el
curado del 22 dejó al congelado de v57 sin 5 de sus prendas, o sea el retador
`prompt-anterior` rehusándose a correr. Cada vez que el clóset cambie hay que
**re-congelar** (`scripts/prompt-congelar.ts`) y anotar el corte en la bitácora;
las aprobaciones de antes y después no se comparan. Mientras se mida, conviene
dejarlo quieto.

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
uno o dos por día. *Matiz (2026-08-22): un cambio de PROMPT por vuelta, sin
excepción. Varias reglas de CÓDIGO pueden ir juntas en una versión si cada una
ya pasó sola su ablación (dispara en 👎, cero en 👍) — la ablación es la medición
individual; la ronda mide que el conjunto no empeore.*

**Cómo leer la ablación, aprendido a golpes:** que una regla dispare en looks
👍 sólo es ruido si la regla es de nivel "rompe". `cueros-que-no-se-hablan`
dispara en 7 👍 y 0 👎 — y aun así es correcta: Roberto confirmó cinco veces
"no va" para cinturón negro con mocasín burdeos, y aprueba el look igual. Un
👍 es "sale a la calle", no "no tiene detalles". Lo que NO puede pasar es que
una regla que tira looks dispare en 👍.

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
6. **Generar y juzgar — CON EL RETADOR QUE MIDE ESE CAMBIO.** La lección de
   la ronda 6868a52b (cerrada sin votar): `prompt-anterior` congela sólo el
   TEXTO del generador, así que mide cambios de prompt; un cambio de REGLAS o
   REPARADOR corre en el pipeline de hoy para los dos lados y esa ronda sale
   idéntica-contra-idéntica (puro ruido). **Cambio de prompt → `prompt-
   anterior`. Cambio de reglas/reparador → variante de ablación que las
   apague** (como `sin-reglas-v61`):
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
| 08-22 | 2bba08e0 | v58 | prompt-anterior (v57) | **100%** vs 82% | pre-registrado "≥": **v58 sale** (pares 3-1, 2 empates). Ruido ±12: dice "no empeoró". js6 fuera de muestra: sólo 2 👎 en la ronda, rompe 0/2, falsa alarma 1/17 — muestra chica, se sigue midiendo |
| — | — | — | — | — | **POOL v9 desde aquí: los planes dicen lo que diría una persona. Las aprobaciones de arriba (v8) y las de abajo (v9) NO se comparan.** |
| — | — | — | — | — | **CLÓSET DE REFERENCIA v1 desde aquí (129 prendas, 2026-08-22). v58 re-congelado sobre él. Corte de línea base otra vez.** |
| 08-22 | 075a3f12 | v58 | sin-coherencia-cromatica | 64% vs **79%** | **línea base con el clóset v1: 72%** (25 looks). La regla de color, 5ª ronda: 2-2, 2 empates, y el lado SIN ella aprobó más → **retirada en v59** (pre-registrado desde v53) |
| 08-24 | 6868a52b | v61 | prompt-anterior (v60) | — | **CERRADA SIN VOTAR: inválida.** v61 sólo cambió reglas; prompt-anterior no las aísla (corren en ambos lados). Nace la regla del paso 6 |
| 08-24 | 7abd9c9c | v61 | sin-reglas-v61 | **75%** vs 71% | pre-registrado "≥" cumplido: **v61 en main** (pares 2-2, 2 empates). js7 fuera de muestra: rompe 1/8, falsa alarma 2/22 — sigue viendo sin pesar. Los comentarios destaparon 2 reglas mudas, ARREGLADAS en v0.2.274.1 (lino por nombre; saco recupera su pantalón vía `conjunto`). Candidatas que quedan: chelsea en calor (1ª). lluvia-sin-impermeable ESTRECHADA en v64 (marcaba 5👎/6👍; ahora sólo capa que empapa). Boda sin corbata ENTRÓ por decreto (v63, v0.2.275.0): "no necesitas más cosas mías… eso debe de ser" — ablación 2/0, sin ronda propia por orden suya |
| 08-24 | eval 919c2f53 | v64 | — (absoluto) | **78%** | primera báscula con clóset v1: 35👍/10👎 de 45. Estilo/wow siguen bajos (3.13/2.84). Salieron: regla oxford (v65), diales cita/cena sembrados, y el clóset SIN corbata negra (el funeral la pide) |
| 08-22 | 08f46d3e | v58 | reparar-primero | 57% vs 50% | **no entra** (pre-registrado "≥"; pares 2-1, 3 empates). Dentro del ruido, pero la regla es la regla. Dato que importa: con código-primero, los looks que el juez NO tocó aprobaron 43% — el criterio propio del juez SÍ aporta. `juez-solo-repara` queda sin correr: su hipótesis ya perdió aquí |

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
4. ✅ **v58 — EN MAIN (v0.2.270.0)**, ganó la ronda 2bba08e0: 100% vs 82%. Lo que la
   ablación dijo de verdad (`scripts/ablacion-votos.ts`, 2026-08-22): **24 de
   sus 27 👎 no disparaban ninguna regla**, y la regla del abrigo NO estaba
   validada (chaqueta ligera a 8°: 1 👎 y 1 👍 — moneda al aire; lo que te
   dije antes estaba mal contado). Lo que sí salió limpio, y entró:
   - `negro-con-beige` (zapato/cinturón negro con chinos beige/caqui): 3 👎 /
     0 👍, reparable cambiando el calzado a café/burdeos y el cinturón detrás.
   - `mezclilla-con-saco` (camisa de mezclilla con saco/blazer/traje): 3 👎 /
     0 👍, reparable cambiando a camisa lisa de manga larga.
   - El reparador aprende `blazer-no-es-abrigo` (1 👎 entregado roto porque
     la regla detectaba y nadie reparaba).
   Tras v58 los 7 👎 que disparan regla se reparan 7/7 (antes 1/7). El texto
   del generador no cambia. Ronda: v58 contra `prompt-anterior` (v57).
5. ⬜ **Lino en oficina con UNA sola pieza.** Dicho 4 veces el 08-19 — pero la
   ablación también enseñó 7 👍 con una camisa de lino en oficina. No es regla
   de código (sería 4 👎 / 7 👍); quedó como "resta" en el juez (js5+).
6. ⬜ **Manga corta bajo chamarra** (2 👎 / 1 👍). Y sin dato: `manga` viene
   vacío en sus prendas de lino; el juez lo ve en la foto, el código no.
7. ⬜ **Café en total black** (2 👎 / ~1 👍). Candidata, aún floja.
8. ✅ **`colores-que-no-se-leen` RETIRADA** (v59, v0.2.272.0): cinco rondas sin
   ganar; en la quinta el lado sin ella aprobó más (79% vs 64%).
9. ⬜ **Candidatas nuevas de la ronda 075a3f12** (sus comentarios, sin medir
   todavía): camisa azul en boda de noche (3×: "sería mejor blanco"); cuello
   de tortuga con camisa debajo ("no va… o al menos no así"); mocasín café con
   traje negro ("ya te lo había dicho" — 3ª vez de café-en-total-black);
   charol fuera de smoking/jaquet/frac ("investiga": tiene razón — el charol
   es de etiqueta, no de traje de calle); traje cruzado sin corbata ("se ve
   raro… investigar": el problema que él vio es que iba ABIERTO — un cruzado
   se lleva abotonado; sin corbata pasa si va cerrado); abrigo impermeable
   técnico a 17° "demasiado caluroso". Y uno de dial, no de regla: "está
   abusado el traje completo + algo; mejor blazers para smart casual".

**Pool v9 — EN MAIN desde v0.2.270.1 (2026-08-22), tras votarse 2bba08e0.
v58 quedó congelado bajo v9 como línea base del retador `prompt-anterior`.** Los `plan` de los eventos pasan de
etiqueta de catálogo ("una cita en un restaurante") a lo que diría una persona
en el wizard ("una cita para cenar con alguien que me gusta — es la segunda
vez que salimos; restaurante de mantel, viernes a las 9"). Roberto: "¿qué tipo
de cita? hay muchísimos contextos que influyen" — y el motor recibía el mismo
texto que él. Consecuencias: (1) las aprobaciones de v8 y v9 no se comparan
entre sí — la bitácora arranca línea base nueva; (2) hay que **re-congelar v57
bajo pool v9** (`scripts/prompt-congelar.ts`) antes de la siguiente ronda con
`prompt-anterior`, porque el congelado de v8 ya no casa.

## 9. Conversación B — el rol del juez de producción (medido 2026-08-22)

**La pregunta de Roberto:** "se está volviendo el stylist cuando debería
corregir". ¿El juez de producción repara lo detectado, o recompone el look?

**Lo medido** (2 rondas sobre el clóset/pool actual, 59 looks):

| | |
|---|---|
| looks reescritos por el juez | **44 de 59 (75%)** — 2.3 prendas movidas por reescritura |
| reescritos que tenían una violación de regla de código antes | 33 (75% de las reescrituras) |
| reescritos **sin** ninguna violación previa — criterio propio | **11 (25%)** |
| violaciones de código antes → después | 55 → 15: **arregló 43, metió 3** |
| de qué habla al reescribir | frío/capas 9 · cueros 9 · formalidad 7 · lluvia 5 · mezclilla 5 · corbata 4 |

Dos correcciones al diagnóstico anterior: (1) el "mete 5 por cada 3 que
arregla" del 19 de agosto **ya no es cierto** — hoy arregla 43 y mete 3; (2)
el juez NO está recomponiendo a su gusto en la mayoría de los casos: 3 de cada
4 reescrituras responden a una violación que el código ya había detectado.

**El hallazgo de arquitectura que lo explica.** El orden del pipeline es
generador → **juez LLM** (recibe el bloque de violaciones y tiene libertad
sobre las cinco prendas) → reparador en código (sólo lo que el juez dejó) →
segundo intento LLM. O sea: el juez hace a mano, con 2.3 prendas movidas y una
llamada de ~$0.02, lo que el reparador en código haría tocando UNA prenda y
gratis. La lógica "primero el código" está escrita en `critic.ts`, pero se
aplica DESPUÉS de que el juez ya reescribió.

**Lo que sí es criterio propio (el 25%)**, leído uno por uno: casi todo es
*registro* — "pantalón de vestir con pinzas es demasiado sastre para un polo
casual", "tortuga bajo saco cruzado es choque de formalidades". Son llamadas
de stylist plausibles, no errores; pero son exactamente el territorio del
**dial por plan** (sección 3 capas), y hoy las decide el juez con su propio
gusto, sin leer el de la persona. Y al menos una vez la razón que da no
coincide con lo que hizo ("cambié por un chino en carbón" → metió el pantalón
técnico).

**Propuesta, medible, sin tocar el prompt del generador** — dos variantes del
comparador, UNA cosa cada una, con el voto de Roberto como árbitro:

1. `reparar-primero`: correr `repararEnCodigo` ANTES del juez y darle al juez
   el look ya reparado + sólo lo que el código no pudo. Hipótesis: las
   reescrituras bajan de 75% a ~30% sin perder aprobación, y el juez queda
   para lo que es criterio. Es un cambio de ORDEN, no de lógica.
2. `juez-solo-repara`: además, el juez sólo puede tocar las prendas que el
   bloque de violaciones nombra; sin violación pendiente, devuelve "ok" sin
   cambios. Mide si el 25% de criterio propio suma o resta — con el voto, no
   con opinión.

Si 1 gana o empata → entra. Si 2 gana → el juez deja de ser stylist y las
decisiones de registro pasan al dial por persona, que es donde Roberto las
quiere. Si 2 pierde → el criterio propio del juez vale, y lo que hay que
hacer es darle el dial de la persona en vez de quitárselo.

**Resultado (ronda 08f46d3e, 2026-08-22): la 1 NO entró** — 57% producción vs
50% código-primero, pares 2-1 con 3 empates. Y el dato que cierra la
conversación: con el código primero, los looks que el juez no tocó aprobaron
**43%**, contra 57% los que sí tocó. El juez reescribiendo con criterio
propio **suma**; "sólo reparar" perdería. Conclusión B: el juez se queda como
stylist; lo que falta es que lea el dial de la persona (tres capas), no
quitarle el criterio. Las dos variantes quedan en el catálogo por si se
re-mide con más pares.

**Conversaciones abiertas** (no son tareas): versionar el prompt del juez
(hoy no se versiona), y el contexto por persona (sección 9 y las tres capas).
