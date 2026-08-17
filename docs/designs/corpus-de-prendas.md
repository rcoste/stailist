# Corpus de prendas — el activo que sobrevive a las cuentas

**Estado: spec aprobada en conversación (2026-08-17), sin construir.**
Definida con Roberto al borrar sus cuentas de prueba: las prendas renderizadas
son un activo del producto, no basura que muere con el usuario.

## El problema

Hoy una prenda renderizada vive SOLO en la cuenta de quien la subió. Si la
cuenta se borra o resetea, el render y sus atributos desaparecen (pasó con las
cuentas de prueba de Roberto: 40 renders únicos se salvaron a mano). El único
staging que existe es `library_candidates`, pero solo recibe renders
*rechazados* ("no es mi prenda") y también muere con el usuario.

Lo que se pierde: materia prima para la biblioteca, señal de "qué ropa tiene
la gente de verdad" (los básicos reales, no los imaginados), y la base para
futuras sugerencias de compra (hoy fuera del MVP — pero los datos que no se
guardan hoy no existen mañana).

## La lógica: dos niveles + un paso de aprobación

Ejemplo canónico de Roberto: *"mi playera de México se renderea; ese render
está en mi storage personal Y en un bucket compartido, previo a que se
autorice en la biblioteca común. Debería aprobarse para ver que no esté
duplicado y que sea apropiado."*

1. **Corpus (cola de candidatas)** — automático, sin curación:
   - Cada vez que un render de prenda NACE (render-prenda, render-item,
     auto-sanado del clóset), además de guardarse en la carpeta del usuario,
     se **copia** a un bucket compartido y se inserta una fila en
     `library_candidates` con `status: 'pendiente'`, `source_kind:
     'user_render'`, attrs (nombre/categoría/color/hex/formalidad/temporada) y
     `user_id` (mientras la cuenta viva).
   - **Nunca la foto original** — solo el render dibujado (flat-lay) y los
     atributos. La foto es dato personal; el flat-lay genérico no retrata a
     nadie.
2. **Aprobación (el paso de Roberto)** — pantalla en `/admin`:
   - Cola de pendientes con render + attrs + **señal de duplicado** calculada
     (nombre normalizado + categoría + familia de color contra `archetypes` y
     contra candidatas ya aprobadas).
   - Acciones: **aprobar** (nace el arquetipo en la biblioteca, nombre
     genérico SIN marca — regla Carla), **rechazar** (queda en el corpus como
     dato, no entra a biblioteca), **descartar** (inapropiada/rota: se borra).
   - Nada entra a la biblioteca sin este paso. La biblioteca sigue curada.
3. **Deslige al borrar/resetear cuenta**:
   - Las filas del corpus NO se borran con la cuenta: se les pone
     `user_id = null`. El activo queda, anónimo.
   - `reset-usuario.ts` y cualquier borrado de cuenta deben cambiar a esta
     regla (hoy borran `library_candidates`).

## Decisiones técnicas a resolver al construir

- **Dónde vive la imagen del arquetipo aprobado**: hoy las imágenes de
  biblioteca viven en el REPO (`public/archetypes/`), y aprobar desde el admin
  no puede commitear. Opciones: (a) que `archetypes.image_path` acepte también
  rutas del bucket público `catalog` (cambio chico en el consumo), o (b) la
  aprobación marca `status: 'aprobada'` y un script materializa el lote al
  repo como PR. Decidir en eng review.
- **Dedupe**: v1 por nombre+categoría+color normalizado basta como señal (el
  humano decide). Embeddings/visión después, si el volumen lo pide.
- **Privacidad**: una línea en los términos ("los dibujos genéricos de prendas
  pueden conservarse de forma anónima para mejorar el catálogo"). Sin foto
  original, sin user_id tras el borrado.

## Primera siembra

Los 40 renders archivados de las cuentas de prueba de Roberto
(`stailist-archivo-cuentas/`, fuera de git) entran como primer lote del
corpus; los ~27 únicos que Roberto apruebe de la lámina entran a la
biblioteca por la vía Carla (imágenes + migración idempotente).
