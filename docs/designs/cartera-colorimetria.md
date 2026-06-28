# Cartera de Colorimetría — design doc

> Origen: sugerencia de Tatiana (usuaria objetivo). Decisión de Roberto en
> office-hours (2026-06-27): construir el **módulo completo**, incluido el
> try-on desde foto. Este doc es la arquitectura; NO es código.

## Objeción registrada (Claude, mentor)

El cuello de botella de stailist es **0 usuarios reales**, no faltan features.
El experimento con Tatiana/Toño (~15 min de logística) sigue siendo la acción de
mayor ROI y **debe correr en paralelo** al build — no lo bloquea. Construir el
módulo completo antes de ese dato es procrastinación de producto disfrazada de
progreso. Roberto decidió construir igual; queda registrado. Mitigación: **fasar**
(abajo) para que lo barato/seguro salga primero y lo caro/riesgoso quede gateado.

## Qué YA existe en el código (no reinventar)

- `lib/colorimetria.ts`: quiz de 6 preguntas (ejes calidez `w` + profundidad `d`),
  `computeSeasonWithFlow()` → `{season, flow}`, `seasonPalette(season, flow)` →
  `{mejores, prestados, evita}`, `seasonDisplayLabel()` (nombres de sub-estación),
  `seasonMetal()`, `METAL_HEX`, y `mergeColorimetria()` (fusiona foto+quiz — sí,
  ya hay una ruta de análisis por foto/ensemble Claude+Gemini).
- `profiles`: `palette_season` (text), `palette_flow` (text), `palette_quiz`
  (jsonb), `style_vetoes` (jsonb).
- `components/colorimetria-section.tsx`, `season-reveal.tsx`, `lib/pasaporte.ts`
  ya renderizan la paleta resuelta.
- `app/api/tryon/route.ts`: try-on que toma avatar + imágenes de prenda → render
  con `gemini-3-pro-image`. **Reutilizable** para "probarse una foto subida".
- `items` (clóset): cada prenda guarda `attrs.color_hex` + foto/render. Sirve para
  "seleccionar prenda guardada".

## Decisión 1 — taxonomía: alinear a Light/Medium/Dark

Tatiana pidió **Light/Medium/Dark × {Spring, Summer, Autumn, Winter} = 12**. El
quiz YA mide profundidad (`deep`). Propuesta: derivar un **tier de profundidad**
del score `deep` del quiz y guardarlo como `palette_depth` ∈ {light, medium, dark}.

- Las 12 sub-estaciones = `(season, depth)`.
- Reemplaza/!complementa el "flow" actual (que mezcla calidez+profundidad y nombra
  "profundo/suave/claro/cálido"). Para esta feature manda `(season, depth)`; el
  `flow` se conserva internamente para el motor de outfits (no romper nada).
- Bucketing inicial (afinar con datos): `deep <= -2` → light, `-1..1` → medium,
  `>= 2` → dark. (El quiz suma hasta ±~4 en `deep`.)
- Migración: backfill `palette_depth` para perfiles existentes desde `palette_quiz`.

> Caveat honesto: el sistema profesional de 12 tonos NO es uniformemente
> Light/Medium/Dark (usa ejes secundarios distintos por estación). La versión de
> Tatiana es una simplificación legítima y más entendible. La adoptamos tal cual,
> con la nota de que no es "colorimetría de academia".

## Decisión 2 — paletas AMPLIAS (el trabajo de datos real)

Hoy: ~5 colores por estación. Meta: **~24-40 colores por sub-estación**,
organizados por familia (neutros, claros, medios, acento, joya, a-evitar).

- Nuevo archivo `lib/palette-data.ts`: `PALETTES: Record<SubSeason, PaletteFull>`
  donde `PaletteFull = { neutros, base, acentos, joya, evita: Color[] }` y
  `Color = { nombre, hex, familia }`.
- 12 sub-estaciones × ~30 colores = ~360 swatches curados. Se generan una vez
  (curaduría + nombres en voz amiga cool), se versionan en código (como `SEASONS`).
- `seasonPalette()` se extiende a `subSeasonPalette(season, depth)`.

## Pantallas y componentes

### P1 · Cartera (la mega-paleta) — `app/cartera/page.tsx`
- Hero: nombre de la sub-estación (sans+serif v3) + una línea "por qué te enciende
  la cara".
- Grid de swatches por familia (acordeón o secciones). Cada swatch: color, nombre,
  y al tocar → "por qué" + dónde usarlo (top cerca de cara vs pantalón).
- Botón grande **"modo tienda"** (P2).
- Reusa tokens v3 (`bg-bg`, `text-ink`, hairlines). Componente
  `components/cartera/swatch-grid.tsx`.

### P2 · Modo tienda (quick mode) — overlay full-screen
- Pantalla a sangre con los swatches GRANDES, brillo al máximo, scroll mínimo,
  abrible en 1 toque desde la nav. Pensado para sacar el teléfono junto a la prenda.
- ⚠️ Disclaimer breve: "es una guía; la pantalla y la luz de tienda no son exactas".
- Componente `components/cartera/store-mode.tsx`.

### P3 · Chequea un color (compras online) — `app/cartera/chequear/page.tsx`
- Subir foto de prenda (o pegar URL / elegir del clóset).
- Extrae color dominante → compara con la paleta → veredicto:
  - ✅ "Sí va con tu paleta" · ⚠️ "No es ideal para tu colorimetría" ·
    🔁 "Color parecido recomendado".
- Explicación de 1 línea + 2-3 alternativas (swatches de su paleta cercanos al
  color de la prenda).
- Componentes: `color-uploader.tsx`, `color-verdict.tsx`.

### P4 · Pruébatela (try-on desde foto) — integra avatar
- Desde P3 o desde una prenda guardada: "verme con esto" → llama `/api/tryon` con
  el avatar del usuario + la foto de la prenda.
- Sin avatar → CTA "crea tu avatar" (mismo patrón que `use-tryon.tsx` hoy).
- Reusa `components/tryon-immersive.tsx` + `lib/use-tryon.tsx`.

## Lógica nueva

### Extracción de color dominante (`lib/color/extract.ts`)
- Client-side primero (barato, privado): canvas → downscale → k-means (k=3-4) sobre
  píxeles, descartar fondo (bordes) → color dominante de prenda. Sin red.
- Fallback/complemento: si la prenda es ambigua (estampado), usar visión
  (`gemini` / claude) para "color principal de la prenda". Decisión por costo.

### Match contra paleta (`lib/color/match.ts`)
- Convertir hex → CIELAB; `deltaE` (CIEDE2000) contra cada color de
  `{mejores, prestados}` (va) y `{evita}` (no va).
- Veredicto: deltaE al mejor "va" vs al peor "evita". Umbrales:
  - deltaE_va < ~12 → "sí va".
  - cae cerca de un `evita` → "no es ideal" + explicación.
  - intermedio → "parecido recomendado" + los 2-3 swatches "va" más cercanos.
- Sin dependencias pesadas: `culori` (chico) o implementar deltaE a mano.

## API / datos

- **`POST /api/color-check`** (opcional, si la extracción no es 100% client):
  body `{ imageUrl | imageBase64 }` → `{ dominantHex, verdict, deltaE, alternativas[] }`.
  Server usa `lib/color/*`. Rate-limit + auth (RLS).
- **`/api/tryon`**: sin cambios de contrato; se le pasa la foto subida como
  "garment image". Subir la foto a Storage privado (`prendas/{userId}/uploads/…`)
  con URL firmada, igual que las fotos del clóset.
- `profiles.palette_depth` (nuevo, text) + backfill.
- Sin tablas nuevas obligatorias. Opcional: `color_checks` (log de chequeos) como
  señal de uso para el experimento.

## Fases (de-riesgado)

- **Fase 1 — Cartera + modo tienda (P1, P2).** Barato, on-thesis, cero IA nueva.
  Requiere: `palette_depth`, `lib/palette-data.ts` (paletas amplias), 2 pantallas.
- **Fase 2 — Chequea un color (P3).** Extracción + match. El verdadero wedge.
- **Fase 3 — Pruébatela (P4).** Try-on desde foto. GATEADA: solo si Fase 1-2
  muestran uso real. Es la pieza de mayor riesgo de calidad.

## Riesgos / preguntas abiertas

1. **Profundidad sin selfie:** mapear a Light/Medium/Dark desde el quiz baja
   precisión. ¿Aceptamos, o sumamos 1-2 preguntas al quiz para afinar el tier?
2. **Curaduría de ~360 swatches:** ¿generados con IA + revisión tuya, o curados a
   mano? (calidad vs tiempo).
3. **Color en pantalla ≠ tela real:** el "teléfono junto a la ropa" es guía, no
   veredicto. Hay que comunicarlo sin matar la magia.
4. **Estampados/multicolor:** ¿veredicto sobre el color dominante, o sobre los 2-3
   principales? (empezar por dominante).
5. **Try-on de foto arbitraria:** calidad variable (fondo, ángulo, iluminación de
   la foto de catálogo). Gateada a Fase 3 por esto.

## La tarea (en paralelo, no negociable)

Correr el experimento con Tatiana y Toño esta semana: que generen un outfit, midan
si vuelven solos, y si alguien se pone uno en la vida real. Es la señal que define
qué de este módulo vale la pena pulir. ~15 min de logística.

---

# Fase 3 — replanteada: Wishlist + try-on combinado (2026-06-27, idea de Roberto)

La Fase 3 deja de ser "pruébate una foto suelta" y pasa a ser una **herramienta de
decisión de compra** con casa propia: el **Wishlist**.

## Concepto
Estás en tienda (o viendo algo online), te late algo pero quieres ver cómo te queda.
Le tomas/subes foto → entra al **Wishlist** (cosas que consideras comprar). Al
Wishlist también llegan las **sugerencias de "te falta"** de clóset/cápsula. Desde
ahí eliges items y te los pruebas en tu **avatar** (requisito), solos o **combinados
con prendas de tu clóset** ("estas 2 del wishlist + esta de mi clóset, ¿combinan?")
→ mejor decisión de compra.

## Riesgo central (define el diseño)
Combinar varias fotos de prendas ARBITRARIAS (ángulos/fondos/luz distintos) + prendas
del clóset en un try-on es lo más frágil del módulo en calidad. `/api/tryon` ya acepta
avatar + varias prendas, pero la calidad con fotos "de la calle" es apuesta.
**Decisión de diseño:** el ancla de decisión es el **chequeo de color** (Fase 2, alta
confianza); el try-on es **bonus visual**, no el cerebro. Así el Wishlist ayuda a
decidir aunque el render salga mediocre.

## Modelo de datos
Tabla nueva `wishlist_items` (separada de `items`=clóset propio): `user_id`,
`image_path` (Storage privado, URL firmada), `color_hex`, `verdict` (va/no-ideal/
parecido, calculado con `checkColor` al agregar), `source` (`upload`|`capsule`|`gap`),
`name?`, `created_at`. Al comprar → opción de moverlo a `items` (clóset).

## Entradas al Wishlist
- Desde `/cartera/chequear`: "guardar en wishlist" tras el veredicto.
- Subir foto directo en el Wishlist.
- Desde sugerencias de "te falta" (cápsula/viaje): "agregar al wishlist".

## Pantallas
- **`/wishlist`**: grid de candidatos, cada uno con foto + badge de veredicto de
  color. Tap → detalle (veredicto + alternativas + "pruébatela").
- **Try-on combinado** (gated en avatar): seleccionar 1+ items del wishlist (+ opc.
  prendas del clóset) → `/api/tryon` → `tryon-immersive`. Sin avatar → CTA crear avatar.

## Fases (dentro de Fase 3, de-riesgado)
- **3a — el tablero:** Wishlist + agregar + veredicto de color por item. SIN try-on.
  Útil desde el día 1; barato. (Reusa Fase 2.)
- **3b — try-on de 1 item** del wishlist sobre el avatar (reusa `/api/tryon` + `use-tryon`).
- **3c — combinar** wishlist + clóset en un try-on (lo más caro/riesgoso, al final).

## Preguntas abiertas
1. ¿v1 necesita el combinar-con-clóset (3c), o basta 3a+3b primero?
2. ¿Las sugerencias de "te falta" entran al wishlist auto o solo manual?
3. Ciclo de vida: al comprar, ¿el item pasa del Wishlist al Clóset?
4. ¿El wishlist es solo pre-compra, o también "guardados" en general? (scope)
