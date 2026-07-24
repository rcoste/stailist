# stailist — qué es y cómo genera outfits hoy

> **Propósito de este documento:** dar contexto a una investigación (Deep Research)
> sobre el estado del arte en generación automática de outfits. Buscamos prior art,
> aprendizajes documentados y errores comunes de quienes ya intentaron esto —
> academia (fashion recommendation, outfit compatibility), productos comerciales
> (Stitch Fix, Amazon StyleSnap, Thread, Aesty, Whering, Stylebook, Cladwell…) y
> lo que sepa la industria del styling profesional.
>
> Estado: producto en beta cerrada, 21 perfiles registrados (incluye ~4 cuentas
> de prueba/desarrollo), señal de feedback aún escasa. Todo lo descrito aquí está
> en producción. Datos al 2026-07-23.

---

## 1. El producto

**stailist** es una stylist personal con IA que arma outfits **con la ropa que la
usuaria ya tiene** (no recomienda compras). Español, México, PWA móvil.

**La tesis central:** el problema difícil no es "combinar ropa" — es la **fricción
de setup**. Las apps de clóset digital (Whering, Stylebook, Cladwell) mueren porque
catalogar el guardarropa toma horas. Un alfa previo de este mismo producto murió
por eso. La promesa actual: **primer outfit en menos de 2 minutos** desde que abres
el link, sin fotos obligatorias.

**Cómo esquiva la fricción:** en el onboarding la usuaria marca de un checklist
~41 prendas básicas precargadas (33 específicas de mujer + 8 unisex, con imágenes
de catálogo generadas por IA). Ese "clóset aproximado" basta para generar. Subir
fotos de la ropa real es opcional y posterior.

**Usuaria objetivo:** mujeres 13-45 en México, con "crisis frente al clóset".
Hay usuarias adolescentes.

---

## 2. Qué sabe el sistema de la usuaria

Estas señales alimentan el motor. Ninguna es obligatoria salvo el clóset.

| Señal | Cómo se captura | Naturaleza |
|---|---|---|
| **Clóset** | Checklist de básicos + fotos opcionales (visión detecta prendas y atributos) | Obligatoria |
| **Colorimetría** | Quiz de 5-6 preguntas → 1 de 4 estaciones (sin selfie). Deriva paleta base, "colores prestados" y **lista EVITA** | Fuerte |
| **Gustos / vibe** | Swipe tipo Tinder sobre ~15 looks generados → `taste_tags` | Fuerte |
| **Arquetipo de estilo** | Texto generado tras el swipe ("Pulido con actitud") | Suave |
| **Vetos** | Hard NOs explícitos: prendas, colores, detalles que jamás quiere | **Absoluta** |
| **Silueta** | Complexión (5 opciones mujer / 6 hombre) + dónde carga volumen | **Suave** (ver §6) |
| **Estilo de referencia** | Foto de alguien que viste bien → resumen de vibe + veredicto de si le va | Suave |
| **Estilo en sus palabras** | Texto libre del perfil | Suave |
| **Contexto de vida** | Assessment de cápsula: en qué trabaja, qué hace | Suave |
| **Edad** | Rango declarado | Muy suave, solo extremos |
| **Feedback acumulado** | 👍/👎 con razón, "me lo puse", "otro look" | Creciente |
| **Clima** | Open-Meteo por geolocalización | Fuerte |
| **Ocasión** | Objetivo del día + formalidad explícita si es "evento" | Fuerte |

**Atributos por prenda** (del análisis de visión o del catálogo): nombre, categoría
(top/saco/bottom/calzado/abrigo/vestido/accesorio), color + **hex**, formalidad
(casual/formal-casual/formal), temporada, largo, corte, manga, material, patrón,
color secundario.

---

## 3. La arquitectura de generación

Dos pasadas con modelos distintos, en streaming (límite de 60s por función).

```
clóset + contexto
      ↓
[pre-filtro determinista]  applyVetoes() — quita prendas vetadas antes del prompt
      ↓
PASADA 1 · GENERADOR       Claude Opus · max_tokens 3072
      ↓                    Salida estructurada: { analisis, outfits[] }
      ↓                    2-3 outfits, cada uno: nombre, item_ids[], explicacion
      ↓
PASADA 2 · JUEZ            Claude Sonnet · UNO POR OUTFIT (en paralelo)
      ↓                    Veredicto: ok | reparado | rechazado
      ↓                    Puede intercambiar prendas del MISMO clóset
      ↓                    Añade "tip" opcional de cómo llevarlo
      ↓
[red de seguridad en código]  valida ids, respeta el ancla, descarta rechazados
      ↓
streaming al cliente, outfit por outfit conforme se aprueban
```

**Decisiones de implementación relevantes:**

- **`item_ids` van como `enum` de UUIDs reales** en el JSON Schema de salida — el
  modelo no puede alucinar prendas inexistentes; está restringido por construcción.
- **Campo `analisis` primero en el schema** (v21): el modelo razona en borrador
  (qué neutros hay, qué manda el clima, qué descarta y por qué, las 2-3
  combinaciones más fuertes) **antes** de comprometer los outfits. Sustituye
  extended thinking a bajo costo.
- **El juez corre por outfit, no por lote**, para poder mostrar cada look en cuanto
  se aprueba (percepción de velocidad).
- **Cada outfit guarda la versión del prompt** que lo generó, para medir si los
  cambios mejoran el ratio de 👍.

---

## 4. Las reglas de styling codificadas

Esto es el corazón, y donde más queremos saber si estamos reinventando la rueda o
repitiendo errores conocidos.

### 4.1 Colorimetría — regla "near-face"
- **Lo que toca la cara manda**: top y abrigo deben estar en su paleta o ser un
  neutro que la favorezca.
- **Regla dura:** jamás un color de su lista EVITA cerca de la cara. En bottom o
  calzado no importa.
- Si el clóset no tiene top en paleta: elegir el neutro más favorecedor y compensar
  con el resto.

### 4.2 Armonía del outfit
- **Ancla en neutros:** máximo 1-2 colores protagonistas; el resto neutro. Tres
  saturados juntos casi nunca funcionan.
- **Se juzga por el hex**, no por el nombre del color.
- **Máximo UN estampado protagonista**; el resto liso.
- **Materiales coherentes:** nada de lana en calor ni lino en frío; los pesos de
  tela de un mismo look deben "hablarse".
- **Proporción:** si arriba es holgado, abajo entallado (y viceversa). Evitar "todo
  holgado" o "todo pegado".
- **Vestido/falda:** cuidar largo contra calzado; definir cintura cuando ayude.

### 4.3 Capas con lógica de vida real *(añadida en v25 — ver §7)*
Orden natural obligatorio: camisa/playera debajo → suéter encima → saco/abrigo al
final. **Prohibidos combos que nadie usa**: chaleco sastre sobre suéter, saco
debajo de sudadera, camisa sobre suéter, dos abrigos juntos.
La prueba explícita en el prompt: *"si no te imaginas a una persona real saliendo
así a la calle, no lo armes"*.

### 4.4 "Mano de stylist" *(v25)*
Cuando el clóset lo permita, cada look lleva **una decisión visible**: una capa con
intención, un contraste de textura, o un color que remata sobre base neutra. Con un
guardarraíl explícito: **si el clóset solo da para lo simple, lo simple bien hecho
es la decisión** — jamás forzar una pieza para "vestir" el look.

### 4.5 Reglas antifallo específicas (nacidas de errores reales)
- **"Traje desparejado":** saco + pantalón del mismo color y tono que NO son un
  traje real se lee como conjunto roto. Se rompe el match poniendo el bottom en
  otro neutro.
- **Marino + negro SÍ combinan** — regla que se agregó y luego **se revirtió** al
  descubrir que era un mito (ver §7).
- **Default mexicano de formalidad:** las bodas y eventos formales en México son
  más arreglados que el default del modelo. Ante la duda, subir medio nivel.

### 4.6 Rúbricas del juez, distintas por género
- **Mujer:** más exigente (color, proporción, cintura y largos, capas, completitud)
  — "muchos grados de libertad".
- **Hombre:** más formulaica, lo esencial (color, coherencia de formalidad,
  proporción básica).
- **Neutra** cuando no hay género. *(Antes de v23, `null` caía a la rúbrica de
  hombre — la menos exigente. Bug de sesgo por defecto.)*

### 4.7 El "tip" (cómo llevarlo)
Un movimiento de styling opcional por look. Restricciones aprendidas a golpes:
- **Solo sobre prendas que están en el look.** Prohibido sugerir prendas ausentes.
- **Movimientos seguros por default** (dejar una capa abierta, abrir un botón,
  arremangar) porque **el modelo no ve la prenda**, solo tipo/color/formalidad.
- **Movimientos de riesgo** (fajar, cuffear) dependen del largo/corte exacto: solo
  si la prenda claramente lo permite, o fraseados en condicional.
- **Mejor ningún tip que uno forzado.**

---

## 5. Cómo se pondera el gusto (matemática, no prompt)

`taste_tags` se derivan de los swipes con normalización amortiguada:

```
score(tag) = (likes − dislikes) / √(número de looks que llevan ese tag)
```

**Por qué la raíz:** con división plena (`n/DF`), un **único** ❤️ a un tag raro
(DF=1, rate 1.0) le ganaba a una preferencia consistente (+3 netos sobre 5 looks =
0.6). La raíz hace que la consistencia gane sin enterrar al tag distintivo.
El array llega al motor **ordenado por fuerza**.

---

## 6. Señales duras vs. suaves (una distinción deliberada)

| Dura (filtra o rechaza) | Suave (desempata y enriquece) |
|---|---|
| Vetos | Silueta / complexión |
| EVITA cerca de la cara | Arquetipo de estilo |
| Clima | Edad |
| Ocasión / formalidad | Estilo de referencia |
| Ancla (prenda fijada) | Contexto de vida |

**La silueta es deliberadamente suave**: orienta para desempatar entre looks
parejos y para enriquecer el "porqué", pero **nunca** filtra ni es motivo de
rechazo. Decisión de producto: no queríamos un motor que le dijera a alguien
"esto no es para tu cuerpo".

---

## 7. Historial de iteración: 25 versiones del prompt

El prompt está versionado con el porqué de cada cambio. Los aprendizajes más
interesantes para contrastar con prior art:

- **v5 → v6: una regla que resultó ser un mito.** Se agregó "marino + negro no
  combinan en formal" como regla dura. Se **revirtió** al investigar: sí combinan,
  incluso en formal (un traje marino con zapatos negros es clásico). Quedó solo
  como nota de ejecución. *Aprendizaje: el folclore de moda se cuela como regla.*
- **v7: regla nacida de UN solo 👎.** El único voto negativo del flywheel fue un
  blazer marino + chinos marino idéntico (#27425F) → nació la regla del "traje
  desparejado". *Una muestra de tamaño 1 generó una regla que sigue vigente.*
- **v8: el juez emite veredicto** (ok/reparado/rechazado) e instrumenta, pero
  deliberadamente **no regenera** todavía — primero medir si vale la pena.
- **v15: el tip inventaba prendas.** Decía "deja la camisa de lino abierta" cuando
  el look era polo + pantalón, sin ninguna camisa. Se prohibió mencionar prendas
  ausentes.
- **v21: razonar antes de comprometer** (campo `analisis` primero).
- **v23: sesgo por defecto.** Sin género definido, el juez usaba la rúbrica de
  hombre. Además, el generador no recibía el género (solo el juez) — el criterio de
  styling femenino solo entraba en la 2ª pasada.
- **v24: la señal de gusto se tiraba.** Los tags de visión del estilo de referencia
  se guardaban y nunca se usaban; los vetos y el feedback no llegaban a los motores
  de viaje y cápsula.
- **v25: looks-plantilla y combos inexistentes.** Al generar un deck de looks para
  el swipe, salieron combos que nadie usa (chaleco sobre suéter) y looks que eran
  la misma plantilla recoloreada. Se llevó al motor la lógica de capas de vida real
  y la "mano de stylist".

---

## 8. Qué medimos y qué dice el dato hoy

**Instrumentación:** cada revisión del juez emite un evento con veredicto, si
cambió prendas, ids antes/después y versión del prompt. Los votos, "me lo puse" y
"otro look" (con razón) se guardan y **entran de vuelta al contexto** del generador
y del juez.

**Datos reales acumulados (2026-07-23, ~18 usuarias):**

| Señal | Cantidad |
|---|---|
| Revisiones del juez | 123 outfits |
| → veredicto `ok` | 86 (70%) |
| → veredicto `reparado` | 31 (25%) |
| → veredicto `rechazado` | 5 (4%) |
| Looks donde el juez **cambió prendas** | 30 de 123 (24%) |
| "Me lo puse" (señal de oro) | 14 |
| 👍 | 9 |
| 👎 | 5 |

**Lectura honesta:** el juez interviene en ~1 de cada 4 looks, lo que sugiere que
la primera pasada deja problemas reales — pero no sabemos si sus reparaciones
mejoran la percepción de la usuaria, porque **el volumen de feedback es demasiado
bajo para concluir nada**. 14 votos totales sobre 123 outfits generados (~11% de
tasa de feedback) es la limitación principal de todo nuestro aprendizaje.

---

## 9. Lo que NO hacemos (fuera de alcance deliberado)

- No recomendamos compras ni tenemos catálogo de tiendas (los competidores
  monetizan ahí).
- No hacemos embeddings ni modelo de compatibilidad entrenado: **todo es prompting
  sobre un LLM generalista** con salida estructurada.
- No hay segmentación/recorte de prendas por CV clásico: la visión extrae
  **atributos**, y la imagen "limpia" de cada prenda se **regenera** con un modelo
  de imagen desde esos atributos.
- No modelamos "ocasión" más allá de un objetivo + formalidad.

---

## 10. Preguntas para la investigación

Lo que más nos serviría saber:

1. **Compatibilidad de prendas:** ¿qué dice la literatura (Polyvore dataset,
   type-aware embeddings, outfit compatibility learning) sobre qué predice que un
   outfit "funcione"? ¿Hay señales que nosotros ignoramos?
2. **Reglas vs. aprendizaje:** ¿el prior art sugiere que codificar reglas de
   styling en un prompt es un callejón, o es lo que hacen los productos que
   funcionan? ¿Dónde está la frontera?
3. **Mitos de moda codificados como reglas:** ¿hay un catálogo de "reglas" que la
   industria repite y que resultan falsas (como nuestro marino+negro)? ¿Cuáles
   deberíamos revisar de las nuestras?
4. **Colorimetría estacional:** ¿qué evidencia real hay detrás del sistema de 4
   estaciones? ¿Es folclore comercial o tiene base? Lo usamos como señal fuerte.
5. **Métricas:** ¿cómo mide la industria si una recomendación de outfit es buena?
   ¿Qué tasa de feedback es normal y cómo la suben?
6. **Errores comunes documentados** de apps de clóset digital, más allá de la
   fricción de catalogación que ya conocemos.
7. **El rol del juez/crítico:** ¿hay prior art sobre arquitecturas de dos pasadas
   (generador + crítico) en recomendación? ¿Mejora o solo añade latencia?
8. **Cuerpo y silueta:** ¿qué tan predictivo es realmente el tipo de cuerpo para la
   satisfacción con un outfit? Lo tratamos como señal suave a propósito.
9. **Frío de arranque:** generamos desde un clóset "aproximado" (básicos marcados
   de un checklist, no la ropa real). ¿Alguien ha estudiado el costo de precisión
   de esa aproximación?
