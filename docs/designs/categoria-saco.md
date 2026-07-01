# Spec — Taxonomía de categorías: separar "saco" de "abrigo"

**Estado:** borrador para revisión de Roberto · **No tocar código hasta aprobar.**
**Fecha:** 2026-07-01

---

## Contexto (por qué importa)

Hoy la ropa se clasifica en **6 categorías planas**. No existe "saco/blazer/traje",
así que un saco cae en **"abrigo"**, la misma bolsa donde viven los abrigos de
clima y los cárdigans. Son cosas opuestas en su uso: un abrigo es una **capa
opcional que te pones si hace frío**; un saco es una **pieza central obligatoria de
un look formal**. Meterlos en la misma categoría confunde tres partes del sistema
(generación de outfits, armado de la maleta del viaje, y el match de la cápsula) y
degrada justo los looks formales/de evento — que son de los que más importan.

Roberto lo notó en uso real: "para la parte de los trajes, están cayendo dentro de
abrigos".

**Matiz honesto:** el motor de outfits del día es un LLM que lee el *nombre* y la
*formalidad* de cada prenda, no solo la categoría, así que muchas veces coloca bien
un "Blazer azul marino formal" a pesar de la categoría mala. El daño duro está en
las partes **deterministas** (no-LLM): el binning de la maleta y el match de la
cápsula. Por eso esto no es "todo roto", es "sesgo sistemático contra lo formal".

---

## Estado actual (verificado en código, 2026-07-01)

**Categorías canónicas (fuente de verdad):** `lib/capsule.ts` (~línea 10)

```ts
export const CATEGORIES = ["top", "bottom", "calzado", "abrigo", "vestido", "accesorio"] as const;
export type Category = (typeof CATEGORIES)[number];
```

No hay "saco". Un saco se ve forzado a una de las 6 y termina en "abrigo".

**Dónde se usa la categoría, y qué le pasa a un saco:**

| Lugar | Archivo (aprox.) | Qué hace | Efecto en un saco (hoy "abrigo") |
|---|---|---|---|
| Ingesta / análisis de prenda | `app/api/analizar-prenda/route.ts` (~l.79), `analizar-prendas/route.ts` (~l.84) | El prompt NO le dice al modelo dónde va un saco; el enum fuerza una de las 6 | Cae en "abrigo" por default |
| Generación de cápsula | `lib/engine/capsule-target.ts` (~l.119) | Enum `CATEGORIES` | La cápsula ideal etiqueta sacos como "abrigo" |
| Motor de outfits (LLM) | `lib/engine/prompt.ts` (~l.100) | *"un top (o vestido), un bottom, calzado siempre; abrigo solo si el clima o la ocasión lo piden"* | Trata el saco como **capa opcional de clima**, no como pieza formal obligatoria |
| Maleta del viaje | `lib/engine/trip-outfits.ts` (~l.90-96) | `bySlot("abrigo")` bina en "capas" (capas de frío) | El saco queda en la bandeja de frío → combos formales subrepresentados |
| Match de la cápsula | `lib/engine/capsule-match.ts` (~l.101-106) | `zoneOf` fusiona top+abrigo en zona "torso" (parche con comentario que reconoce la ambigüedad blazer↔abrigo) | Un saco y un cárdigan (ambos "abrigo") pueden marcarse como que uno **cubre** al otro |
| Formalidad | `lib/capsule.ts` (~l.20): `casual / formal-casual / formal` | Se checa en el match | Mitiga parcialmente, pero no separa "saco formal" de "abrigo formal" (un abrigo largo también puede ser formal) |
| Filtros de UI | `app/admin/catalogo/page.tsx`, `components/closet-grid.tsx`, onboarding checklist | `CATEGORY_ORDER` hardcodeado | Sin "saco" |
| DB | `supabase/migrations/0001_initial.sql` (~l.73) | `items.category` es texto **sin CHECK** | La categoría vive solo en TS/prompts; nada impide un 7º valor |

**El modo de falla concreto (ejemplo):**
1. La cápsula ideal dice "Blazer marino formal" → categoría "abrigo".
2. Tienes un cárdigan marino formal-casual → también "abrigo".
3. El match los pone en la misma zona "torso" → puede marcar el blazer como
   "tienes/parecido" **usando el cárdigan** (no son la misma prenda).
4. Al generar un look de evento, el motor ve el saco como "abrigo opcional de
   clima": si hace calor, **lo omite** (look formal sin saco); si hace frío, mete
   saco *encima de* otro top (capa de más).
5. En la maleta, el saco se empaca como "capa para frío", no como base formal.

---

## Cambio propuesto

Dos caminos. **Recomiendo el A.**

### Opción A (recomendada) — Nueva categoría `saco`

Partir "abrigo" en dos categorías de primer nivel:
- **`abrigo`** = capas de clima: abrigos, gabardinas, parkas, cárdigans, suéteres
  gruesos de capa. Uso: **opcional, por clima.**
- **`saco`** = sacos, blazers, sacos de traje, smoking. Uso: **por ocasión
  (formal/evento), independiente del clima.**

Un traje completo se modela como **`saco` + `bottom`** (el pantalón de vestir ya es
"bottom"). Un traje de mujer = `saco` + (`bottom` o falda). Vestidos siguen en
`vestido`.

**Por qué A:** arregla las tres partes deterministas de raíz. El motor puede tratar
`saco` como top-formal por ocasión; la maleta le da su propia bandeja; el match deja
de confundir sacos con cárdigans. El término "saco" es el correcto en México
(usuaria objetivo: Tatiana).

**Costo honesto:** toca ~8 lugares + un backfill de datos ya guardados. Es un cambio
mediano. Detalle abajo.

### Opción B (más barata) — Solo afinar prompts, sin tocar taxonomía

Dejar 6 categorías; en el prompt de análisis, mandar sacos a **`top`** de forma
consistente (un saco es un top estructurado), y en el prompt del motor enseñarle el
layering formal. Aprovecha el parche `zoneOf` (top+abrigo ya conviven).

**Por qué B podría bastar:** el motor LLM ya lee nombre+formalidad. Si el saco cae
en "top" consistente, deja de competir por el slot "abrigo" de clima.

**Por qué B se queda corto:** las partes deterministas siguen burdas — la maleta
(`bySlot`) y el match no distinguen un saco de una camisa si ambos son "top";
podrías empacar dos "tops" sin saco, o marcar un saco como cubierto por una blusa.
Y "top" para un saco rompe la regla "un outfit lleva un top" (un saco va *sobre* un
top).

> **Decisión #1 para Roberto:** ¿Vamos con A (categoría `saco`, correcto y de raíz)
> o B (solo prompts, barato pero deja deuda)? Recomiendo A porque casi no hay datos
> reales todavía — el momento barato para hacer el cambio correcto es ahora.

---

## Diseño detallado (Opción A)

### 1. Data model / tipos

`lib/capsule.ts`:
```ts
export const CATEGORIES = ["top", "saco", "bottom", "calzado", "abrigo", "vestido", "accesorio"] as const;
```
- `items.category` es texto sin constraint → no hay migración de schema obligatoria.
  **Opcional pero recomendado:** agregar un CHECK/enum para blindar (migración
  aditiva). *Decisión #4 abajo.*

### 2. Ingesta (análisis de prenda)

`app/api/analizar-prenda/route.ts` y `analizar-prendas/route.ts`:
- Agregar `"saco"` al enum del schema.
- Agregar al prompt una regla explícita, algo como:
  > "**saco**: sacos, blazers, sacos de traje, smoking (prenda estructurada de
  > torso que se usa por formalidad, no por frío). **abrigo**: solo capas por clima
  > (abrigo, gabardina, parka, cárdigan, suéter grueso). Un traje = saco (categoría
  > saco) + su pantalón (categoría bottom), por separado."

### 3. Generación de cápsula

`lib/engine/capsule-target.ts`: el enum sale de `CATEGORIES` → hereda `saco` solo.
Revisar el prompt de la cápsula para que sugiera "saco" cuando el perfil pide
formal/evento (hoy diría "abrigo").

### 4. Motor de outfits

`lib/engine/prompt.ts` (~l.100): cambiar la regla de slots a algo como:
> "un top (o vestido), un bottom (salvo con vestido), calzado siempre; **saco cuando
> la ocasión es formal/evento** (va sobre el top); abrigo solo si el clima lo pide."

Así el saco es obligatorio-por-ocasión y el abrigo opcional-por-clima. Un look formal
puede ser top + bottom + calzado + saco (sin abrigo).

### 5. Maleta del viaje

`lib/engine/trip-outfits.ts` (~l.90-96): agregar `const sacos = bySlot("saco");` y
usarlo en el enumerado de combos formales (que un look de ocasión formal incluya un
saco disponible), separado de `capas` (clima).

### 6. Match de la cápsula

`lib/engine/capsule-match.ts` (~l.101-106): actualizar `zoneOf` para que `saco` sea
su **propia zona** (no fusionado con abrigo ni con top). Así un saco solo lo cubre
otro saco; un cárdigan no cubre un saco. Revisar el comentario/parche existente (ya
no necesitamos fusionar top+abrigo si el modelo etiqueta bien con la nueva regla —
*validar en implementación*).

### 7. UI (filtros)

Agregar "saco" a los `CATEGORY_ORDER` y etiquetas en: `app/admin/catalogo/page.tsx`,
`components/closet-grid.tsx`, y el checklist de onboarding. Orden sugerido:
top → saco → bottom → vestido → abrigo → calzado → accesorio. Sin colores/estilos
nuevos (usa los tokens existentes; DESIGN.md manda).

### 8. Backfill de datos ya guardados

Como hoy casi no hay usuarios reales (solo pruebas de Roberto/Toño), el backfill es
chico. Un script `scripts/backfill-saco.mjs` (patrón de `scripts/db.mjs`) que:
1. **`items`**: donde `category = 'abrigo'` y el nombre/atributos sugieran saco
   (regex `saco|blazer|traje|smoking|sport coat|americana`), cambiar a `category = 'saco'`.
2. **Cápsulas guardadas**: `profiles.capsule_target` (JSON) y `trips.capsule_target`
   (JSON) — recorrer los `items[]` con el mismo heurístico y reetiquetar.
   - Ojo: cambiar `capsule_target` invalida el `capsule_match` guardado (la firma
     cambia) → el usuario recalcula match la próxima vez. Aceptable con ~0 usuarios.

**Heurístico por nombre** (determinista, sin costo de IA) es suficiente dado el
volumen. Si prefieres precisión, alternativa: re-correr el análisis de IA sobre las
fotos — más caro, innecesario ahora.

> **Decisión #2:** ¿backfill por nombre (rápido, determinista) o re-análisis con IA
> (más preciso, más caro)? Recomiendo por nombre.

> **Decisión #3:** ¿el traje completo se modela como saco + bottom separados
> (recomendado, encaja con el sistema) o quieres una noción de "conjunto"? Un
> "conjunto" sería un rediseño mayor — lo dejaría fuera.

> **Decisión #4:** ¿agregamos un CHECK/enum en DB para blindar la categoría
> (migración aditiva) o lo dejamos solo en TS? Recomiendo agregarlo, es barato.

---

## Criterios de aceptación

1. Subir foto de un saco/blazer/traje → se clasifica como `category = "saco"` (no
   "abrigo") en ≥90% de casos de prueba (set de ~10 fotos: saco formal, blazer sport,
   saco de traje, smoking, + confusores: cárdigan, abrigo largo, gabardina → estos
   siguen en "abrigo").
2. En el match, un saco ideal **no** se marca "tienes/parecido" usando un cárdigan o
   abrigo (distinta clase). Verificado con un caso: cápsula pide "saco marino" +
   clóset con solo "cárdigan marino" → resultado "falta".
3. En un outfit de ocasión formal/evento con saco disponible, el motor **incluye el
   saco** aunque haga calor. Verificado con 3 generaciones.
4. En la maleta de un viaje con ocasión formal, el saco aparece en los combos
   formales, no solo como capa de frío.
5. Backfill: 0 prendas de prueba de saco quedan como "abrigo" tras correr el script.
   Ningún cárdigan/abrigo real se reetiqueta por error.
6. UI: "saco" aparece como filtro en clóset/admin/onboarding; nada se rompe visualmente.
7. Sin degradación: prendas que ya estaban bien (camisas=top, jeans=bottom, tenis=calzado)
   no cambian.

## Plan de pruebas

| Capa | Qué | Nota |
|---|---|---|
| Unit | El heurístico de backfill (nombre → ¿saco?) con casos + confusores | +~6 casos |
| Integración | Análisis de prenda sobre fotos de saco vs cárdigan/abrigo | set de ~10 fotos |
| E2E (manual) | Generar look formal con saco disponible; armar maleta con ocasión formal; recalcular cápsula | Roberto en prod |

## Esfuerzo (con Claude Code)

- Tipos + enum + prompts (análisis, cápsula, motor): ~pequeño
- Match `zoneOf` + trip `bySlot`: ~pequeño
- UI filtros: ~pequeño
- Script de backfill + correrlo: ~pequeño-mediano
- Verificación e2e: ~mediano (depende de fotos de prueba)

Total: cambio mediano, en una sesión.

## Rollback

- Código: revertir el PR.
- Datos: el backfill es reversible con el inverso (saco→abrigo) por el mismo
  heurístico, o desde un dump previo. Con ~0 usuarios el riesgo es mínimo.

## Fuera de scope

- Noción de "conjunto/traje como unidad" (sería rediseño mayor).
- Otras posibles subdivisiones de categorías (p. ej. separar "accesorio" en
  reloj/cinturón/bolsa) — el match ya distingue clase fina de accesorios por prompt;
  no es el problema reportado.
- Re-análisis con IA de todo el catálogo de arquetipos (no hace falta; los
  arquetipos se etiquetan bien al generarlos con la nueva regla).

## Decisiones pendientes de Roberto (resumen)

1. **Enfoque:** A (categoría `saco`, de raíz) vs B (solo prompts). → Recomiendo **A**.
2. **Backfill:** por nombre (rápido) vs re-análisis IA. → Recomiendo **por nombre**.
3. **Traje completo:** saco + bottom separados vs "conjunto". → Recomiendo **separados**.
4. **CHECK en DB:** sí (blindar) vs no. → Recomiendo **sí**.
