# Spec: Importar clóset desde el carrete (multi-prenda + render)

**Estado:** specced, NO construido. Backlog (ítem E2 del `TODOS.md`).
**Fecha:** 2026-06-20.
**Trigger de construcción:** hay usuarias reales Y señal de que el flujo
actual de una-prenda-por-foto se siente lento / quieren meter más ropa.
Es el feature más caro de la lista (~20h) — no se arranca antes de validar.

> **Decisión registrada (supera diseño previo):** este spec **reemplaza** la
> decisión del 2026-06-16 (E2 "atributos-only, swatch, NO generar imagen").
> Roberto, con plena conciencia de esa decisión previa, eligió el 2026-06-20
> generar una **imagen limpia por prenda con Gemini**. La diferencia clave
> respecto a lo descartado entonces: NO recortamos la prenda de la foto cruda
> (eso sigue descartado, se ve feo) — **renderizamos limpio desde los atributos
> confirmados**, que es otra cosa.

---

## Contexto

La fricción de catalogar el clóset es el asesino documentado: mató al alfa de
Replit y mata a Whering/Stylebook. Hoy se mete **una foto = una prenda**
(`components/add-photo-flow.tsx`), lo cual es lento para cargar un clóset real.

La idea: subes fotos **tuyas con ropa puesta** desde el carrete del teléfono, y
la app extrae **cada** componente (chamarra, playera, jeans, tenis), lo confirma
contigo, y lo renderiza limpio. Complementa —no reemplaza— el checklist de 15
básicos, que sigue siendo el piso de cero fricción (las fotos sesgan a piezas
statement; el checklist tapa los básicos que nadie fotografía).

**Por qué el carrete y no fotografiar el clóset:** la entrada de menor fricción
es usar fotos que el usuario YA tiene, no pedirle fotos nuevas.
**Por qué NO Instagram/Facebook API:** muro de compliance (Meta cerró el
Instagram Basic Display API a finales de 2024; leer la galería hoy exige Graph
API + cuenta business + app review). El carrete del teléfono captura el 90% del
valor sin el muro.

---

## Estado actual (verificado 2026-06-20)

- `AddPhotoFlow` (`components/add-photo-flow.tsx`): 1 foto → comprime a 1280px →
  `POST /api/analizar-prenda` (Claude `claude-opus-4-8`, devuelve **1** objeto
  `PrendaAnalisis`) → modal confirma nombre/tipo/formalidad/temporada
  (**el color NO se confirma hoy**) → sube a bucket `prendas` → `addPhotoItem`.
- Datos: tabla `items` (`supabase/migrations/0001_initial.sql:83`) con
  `source ('archetype'|'photo')`, `attrs` jsonb `{tipo,color,color_hex,
  formalidad,temporada}`, `photo_path`, soft delete (`deleted_at`).
- Biblioteca compartida: tabla `archetypes` (`segment`, `category`, `attrs`,
  `image_path`, `onboarding_subset`, `sort_order`). Curada a mano.
- Gemini ya se usa para imágenes en `app/api/tryon`, `app/api/avatar/generate`,
  `lib/archetype-image.ts`.
- Límite Vercel Hobby: **60s por función** → el render NO puede ir en la misma
  llamada que la subida; cada render es su propio request.

---

## Principio rector

**La máquina propone un borrador; el humano dispone en bloque (~60s).** Cada uno
de los riesgos de leer ropa puesta se mitiga con curación humana rápida, no con
IA perfecta (que no existe).

### Los 4 mitigantes (incorporados al diseño, no parchados)

1. **Color falseado** (filtro/luz, y el color es lo que usa la colorimetría) →
   confirmar color con **swatch + 2-3 alternativas** ANTES de renderizar.
   Confiar en el nombre semántico del color ("azul marino"), no en el pixel.
2. **Oclusión** (te ves a medias, brazos cruzados) → **fusión de varias fotos**
   (la misma prenda en varios ángulos) + la IA **pregunta cuando duda**
   (`confianza: baja`), no adivina callada.
3. **Dedup ambiguo** (¿la misma playera u otra?) → agrupar por `tipo+color`;
   **default NO juntar** (separar de más es el error barato: un merge mal borra
   una prenda del clóset; un split mal solo deja una tarjeta repetida). El humano
   junta/separa con un tap.
4. **Sesgo a piezas statement** (fotografías tus mejores looks, no tus básicos) →
   **detección de huecos** que empuja al checklist de básicos existente.

---

## Flujo (dos confirmaciones ligeras)

1. **Selección.** Eliges hasta **~12 fotos** del carrete.
2. **Extracción.** Por cada foto, una llamada a visión devuelve un **array** de
   prendas `{nombre, tipo, color, color_hex, formalidad, temporada, confianza}`
   (máx ~6 por foto). El cliente recorre las 12 fotos: **1 llamada por foto**,
   cada una < 60s.
3. **Dedup.** Se agrupan por `tipo+color`; default NO juntar. El humano junta /
   separa con un tap.
4. **Confirmación de componentes (texto) — aquí se mata el error de raíz.**
   N tarjetas; por cada prenda: encender/apagar, editar atributos, y
   **confirmar color con swatch + alternativas**. Las de baja confianza salen
   marcadas "revisa esto". Nada se agrega ni se renderiza solo.
5. **Generar renders.** Solo de lo confirmado: Gemini genera una imagen limpia
   tipo catálogo (estilo flat-lay, fondo hueso `#F5F3F0`, igual que la
   biblioteca) **desde los atributos confirmados**, no de la foto cruda.
6. **Confirmación de renders (visual) — rápida.** Ves la cuadrícula de imágenes
   generadas y marcas cuáles coinciden con tu prenda real:
   - **Coincide** → entra a tu clóset (`items`, source `photo`).
   - **No coincide pero buena imagen** (ej. tu Polo era de otra manga) → NO se
     borra: va a **staging de biblioteca** (`library_candidate`) para que el
     admin la revise.
   - **Imagen basura** (Gemini alucinó, deforme) → se descarta.
7. **Detección de huecos.** Comparar lo que tienes contra el set de básicos; si
   faltan workhorses ("ningún pantalón neutro, ninguna playera lisa"), empujar
   al checklist existente.

Entre los pasos 4 y 5: mientras renderiza, el clóset ya muestra la prenda con
**swatch de color como placeholder**; el render lo reemplaza al llegar.

---

## Detalles de implementación

### `POST /api/analizar-prenda` (extendido)
- Schema pasa de 1 objeto a `{ prendas: PrendaAnalisis[] }` (array, máx ~6).
- Prompt: "lista CADA prenda visible que lleva puesta la persona; si una está
  muy tapada o dudosa, márcala `confianza: baja` en vez de inventar".
- Compat: el flujo de 1 prenda puede seguir usando la misma ruta (array de 1).

### `POST /api/render-prenda` (nuevo)
- Entrada: `{attrs confirmados}`. Llama Gemini (estilo catálogo). Sube a bucket
  `prendas`. Devuelve el path. `maxDuration = 60`. **Un render por request.**
- Reusa el estilo de prompt de `lib/archetype-image.ts` / `scripts/gen-*`.

### Migración (mínima)
- A `items.attrs` (o columnas): `render_status: 'none'|'pending'|'done'|'failed'`
  y `render_path`. El clóset muestra `render_path` si `done`, si no el swatch
  (`color_hex`).
- Tabla nueva `library_candidates` (staging): `{id, user_id, attrs, image_path,
  source_kind:'rejected_render', status:'pending'|'approved'|'discarded',
  created_at}`. RLS: solo admin lee/escribe el flujo de aprobación.

### Reusos
- El modal de confirmación actual → **lista** de tarjetas (paso 4).
- Compresión de imagen + subida al bucket: ya existen en `AddPhotoFlow`.
- Detección de huecos: el mismo patrón "te falta" que ya usan cápsula/viaje.

---

## Corte MVP (lo más chico que entrega valor)

**v1** = pasos 1-6 (extracción → dedup → confirmar texto → render → confirmar
render → guardar). Los renders rechazados se **guardan** en `library_candidates`
(barato: solo "no los borres").

**Fase 2** (aparte, no bloquea v1):
- Paso 7 (detección de huecos → checklist).
- Pantalla de **admin** para aprobar `library_candidates` hacia `archetypes`
  (la cosecha-a-biblioteca). Sin esto, v1 solo acumula candidatos sin publicarlos.

---

## Criterios de aceptación

1. Subo 1 foto mía con 4 prendas (chamarra, playera, jeans, tenis) → la app
   propone 4 tarjetas, una por prenda.
2. Subo 12 fotos → todas se procesan sin exceder 60s por llamada (1 por foto).
3. Dos fotos con la misma chamarra → se ofrecen como duplicado para juntar
   (no se juntan solas).
4. Cada prenda deja confirmar color con swatch ANTES de generar el render.
5. Prenda de baja confianza sale marcada "revisa".
6. El render se genera desde los atributos confirmados, no de la foto cruda.
7. En la confirmación visual: marco un render como "no es mi prenda" → NO entra
   a mi clóset y queda en `library_candidates` (no se borra).
8. Marco un render como basura → se descarta del todo.
9. Al guardar, cada prenda aparece con swatch y se reemplaza por su render
   (o queda swatch + "reintentar" si el render falla).
10. 0 prendas detectadas → cae al flujo de una-prenda; nunca bloquea.
11. Las prendas importadas entran al motor de outfits igual que las de arquetipo.

---

## Archivos

| Archivo | Cambio |
|---|---|
| `app/api/analizar-prenda/route.ts` | Schema 1 → N prendas + prompt multi-prenda |
| `app/api/render-prenda/route.ts` | **Nuevo** — render Gemini desde atributos |
| `components/import-carrete-flow.tsx` | **Nuevo** — selección múltiple + curación en lote (2 confirmaciones) |
| `components/closet-grid.tsx` | Mostrar `render_path` o swatch según `render_status` |
| `app/closet/actions.ts` | `addPhotoItems` (lote) + disparo de render + rechazo→staging |
| `supabase/migrations/00XX_*.sql` | `render_status` + `render_path` en `items`; tabla `library_candidates` |
| `app/admin/*` (fase 2) | Pantalla de aprobación de `library_candidates` |

---

## Fuera de alcance

- ~~Foto plana (flat-lay) de prendas sueltas — esto es solo on-body del carrete.~~
  **INCORPORADO (2026-07-23):** el endpoint acepta ambos tipos de foto — persona
  vestida O prendas extendidas (cama/piso/ganchos/apiladas, el caso "vacía tu
  clóset sobre la cama"). Tope por foto subió de 6 a 8. Motivado por el análisis
  competitivo (aesty + repo `tandpfun/wardrobe` prueban que el bulk import
  flat-lay es EL matador de fricción de setup); el copy del sheet ya lo
  prometía ("fotos de tu ropa") sin que el prompt lo soportara.
- Integración con Instagram/Facebook API (muro de compliance).
- Recortar la prenda de la foto original (descartado: se ve feo; se genera
  limpia en su lugar).

---

## Privacidad

El render es una prenda genérica generada por IA, sin la cara ni el cuerpo del
usuario. Subir un `library_candidate` aprobado a la biblioteca compartida no
expone datos personales. La foto original del carrete se usa solo para extraer
atributos y (opcional) se retiene para re-análisis; no se publica.

---

## Rollback

Feature aislada en un modo nuevo. Si falla, se oculta el botón "Importar del
carrete"; el "+Foto" de siempre sigue intacto. Las prendas ya importadas quedan
(con swatch si el render no corrió).

---

## Esfuerzo (estimado)

| Parte | Horas |
|---|---|
| Schema + API extracción (1→N) | ~3h |
| API render + Gemini | ~3h |
| UI de curación en lote (2 confirmaciones) | ~5h |
| Dedup | ~2h |
| Staging de renders rechazados | ~2h |
| Detección de huecos (fase 2) | ~2h |
| Admin de aprobación a biblioteca (fase 2) | ~3h |
| Pruebas | ~2h |
| **Total** | **~20h** (v1 ~15h; fase 2 ~5h) |

El feature más caro de la lista de mejoras. Por eso vive aquí specced y no
construido hasta que haya señal de usuarias reales.
