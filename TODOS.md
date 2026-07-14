# TODOS — stailist

Trabajo diferido con contexto. Cada ítem tiene su "por qué ahora no" y su trigger de reapertura.

## Diferido del planning (2026-06-10)

- [ ] **E2 — Detección multi-prenda en una foto** ("sube una foto tipo Instagram → saco tus prendas"): subir una foto con varias prendas (outfit puesto, ropa sobre la cama) → la IA propone N altas, cada una con confirmación editable. *Por qué ahora no*: el alfa de Replit ya alucinaba analizando UNA prenda; multi-prenda es estrictamente más difícil (errores que se acumulan envenenan el motor), y el experimento no la necesita — el checklist de 15 básicos ya mató la fricción de catalogar. *Trigger*: hay usuarios reales Y señal de que el flujo actual de una-prenda-por-foto (`/closet`) se siente lento o quieren meter más ropa. Candidata #1 para el primer feature post-validación (es el upgrade natural del paso 8 del USER-JOURNEY, "el clóset crece").

  **→ SPEC COMPLETO: `docs/designs/import-carrete-multiprenda.md` (2026-06-20).** Ahí vive el diseño vigente, con corte MVP, criterios de aceptación y esfuerzo (~20h). El bloque de abajo (2026-06-16) queda como histórico; **fue superado en un punto**: el spec del 2026-06-20 SÍ genera una imagen limpia por prenda con Gemini (desde atributos confirmados, no recortando la foto cruda), en vez del "atributos-only / solo swatch" de 2026-06-16. Además agrega: dos confirmaciones (texto→render), y los renders rechazados no se borran — van a un staging de admin que decide si entran a la biblioteca general.

  **Diseño acordado (2026-06-16) — histórico, ver spec para lo vigente:**
  - **Principio que lo salva:** el clóset necesita ATRIBUTOS precisos (color hex, formalidad, tipo), no fotos bonitas — el motor combina por atributos, la imagen es secundaria.
  - **Visual de cada prenda:** NO recortar por prenda (bounding boxes poco confiables + recortes de ropa puesta se ven feos). Usar **swatch de color** (como el fallback de arquetipos) o foto compartida. Esto resuelve la vieja "decisión pendiente" (recorte vs foto compartida): se elige NO recortar.
  - **Pipeline:** foto → Claude visión con structured output → **array** de prendas `{tipo, color, color_hex, formalidad, temporada, nombre}`. Reusa la infra de `/api/analizar-prenda`, solo cambia el schema de 1 a N.
  - **Confirmación editable en lote (no negociable):** N tarjetas; cada una se puede apagar/editar/borrar. Nunca auto-agregar — el humano es el filtro contra la alucinación. Reusa el modal de confirmación actual vuelto lista.
  - **Fallback:** 0 prendas o baja confianza → cae al flujo de una-prenda-a-la-vez. Nunca bloquea.
  - **Tope:** ~6 prendas por foto. **Métrica:** % de prendas que el usuario deja sin editar (proxy de precisión) + abandono.
  - **Nota sobre la variante "outfit puesto":** es la MÁS difícil de leer (oclusión, perspectiva) aunque la más fácil de dar. El flat-lay extrae más limpio. Si se construye con foto de persona, comprometerse a atributos-only (sin recorte).
  - **Dónde vive:** segundo modo en `/closet` junto a "+ Foto"; opcional en onboarding DESPUÉS del checklist de 15 básicos (no en lugar de — el checklist es el piso de cero fricción).

## Diferido del build (sesión 2, 2026-06-14)

- [ ] **Captura unificada para colorimetría + avatar de try-on**: hoy son dos fotos distintas (selfie de cara para color, cuerpo completo para el avatar del try-on). Idea: pedir **una sola foto de cuerpo completo con la cara visible y buena luz** → recortar la cara para colorimetría + usar el cuadro completo como base del avatar. *Por qué ahora no*: el try-on ya está fuera del MVP (opcional, perezoso, no toca el camino crítico de los <2 min); meter captura de avatar en onboarding agrega fricción al flujo que estamos blindando. *Por qué NO derivar el avatar de la selfie de cara actual*: una foto de cara no se convierte en un cuerpo fiel — el modelo inventa proporciones que no son del usuario, y eso mata el "verme a mí". *Nota descartada*: complementar con estatura/peso/tipo de cuerpo NO mejora la imagen generada (los modelos de imagen no controlan geometría con números); esos datos sirven para lógica de fit/sizing, no para el avatar. *Trigger*: el try-on demuestra uso real y la doble subida de foto se vuelve fricción medible. *Tradeoff al reabrir*: cuerpo completo = cara más chica y luz menos controlada → la lectura de color baja; el quiz seguiría siendo la fuente de verdad del color.

## Diferido del build (2026-07-01)

- [x] **Backfill de atributos ricos (material / patrón / color secundario)** — HECHO 2026-07-01 (mismo día que v21): `scripts/backfill-atributos-ricos.mjs` re-infirió las 415 prendas activas con `claude-haiku-4-5` desde el nombre (validado vs Opus: patrón 12/12, material 11/12), escritura aditiva (jamás pisa datos existentes ni correcciones del usuario), todo marcado `atributos_v21: "backfill-texto-haiku"` en attrs. Resultado: 415 con patrón, 151 con material (solo donde el nombre daba señal — sin adivinar). La nota del red team también quedó: material/patrón/segundo color son editables en la hoja de la prenda (`updateItemAttrs` + closet-grid). *Pase de VISIÓN también hecho* (mismo día, con `SUPABASE_SERVICE_ROLE_KEY` local): 410/415 con material (validado vs Opus: patrón 8/8, material 7/8), 5 patrones corregidos por la foto. Restan 4 prendas sin imagen y 1 sin señal — irrelevantes.

## Fases futuras (del design doc — NO tocar hasta validar el MVP)

- [ ] Sugerencias de compra estratégica con ROI ("esta pieza desbloquea 8 outfits") — el modelo de negocio latente.
- [ ] Modo maleta / empacador de viajes (la feature por la que Roberto pagaría; validada emocionalmente por Toño).
- [ ] Análisis de colorimetría por selfie (hoy: quiz manual — el análisis automático es frágil: iluminación, balance de blancos).
- [ ] Catálogos de marcas vía programas de afiliados o catálogo semilla curado (NUNCA scraping — viola ToS).
- [ ] Compartir outfit como imagen/link (E3 — descartada en ceremonia CEO 2026-06-10; reconsiderar solo si la calidad de outfits valida y hay demanda orgánica de compartir).
- [ ] Interfaz híbrida conversacional (chat + botones, sugerencia de Toño) — candidata para v2 del flujo de generación.
- [ ] Monetización freemium / referidos e-commerce (hipótesis de Toño: referidos > suscripción). Validar willingness-to-pay primero.
- [ ] **Panel admin de métricas**: hoy las métricas (TTV, ratio de votos, tiempos de generación) se consultan en el dashboard de Supabase. Un panel propio tiene sentido con 20+ usuarios. *Trigger*: la beta crece más allá del círculo cercano.

## Diferido del research competitivo (2026-07-13, Aesty + gist de cutouts)

- [ ] **Screenshot-to-outfit** (inspirado en la feature estrella de Aesty): screenshotear un look de IG/TikTok → la IA identifica las prendas → "¿tienes algo así en tu clóset?" / wishlist. Encaja natural con el import-carrete (E2) y con la técnica del gist de tandpfun (reconstruir prenda por imagegen, no segmentar). *Por qué ahora no*: feature grande, cero usuarios validando el core. *Trigger*: E2 construido y usuarios pidiendo inspiración externa. *Dato*: es lo que Aesty monetiza con links de compra.
- [ ] **Endurecer análisis por visión con `unknowns` + `confidence`** (del gist `extract-clothing-cutouts`): la regla "prefer omission over invention" — el modelo marca explícitamente lo que NO ve (bolsillos, herrajes, texto) en vez de inventarlo, + score de confianza por prenda que la UI usa para resaltar qué revisar en la confirmación editable. Barato (solo cambia el schema del structured output). *Trigger*: siguiente vez que se toque `/api/analizar-prenda` o al construir E2.
- [ ] **Paid marketing (AdWords) + decisiones de monetización**: Roberto quiere probar una campaña chica de adquisición pagada; de la mano viene decidir qué es gratis y qué no. *Contexto del research*: Aesty cobra $49.99–$79.99/año (tier Max $249.99/año, probablemente por try-on) y hay usuarias pagando contentas → hay willingness-to-pay en la categoría. *Objeción registrada (Claude)*: pagar tráfico antes de que UN usuario cercano complete el funnel es quemar dinero para descubrir bugs que Tatiana descubre gratis; orden sugerido: experimento con 2-3 cercanos → arreglar lo que truene → campaña chica con presupuesto tope. *Trigger*: experimento corrido o decisión explícita de Roberto de saltárselo.

## Diferido del build (2026-07-04) — "Estílame como [referencia]"

- [ ] **Feature "estílame como [stylist/referencia]"**: dado el estilo de una referencia (Carla Figliozzi, María Zimmer, o en el futuro fotos que suba el usuario), generar looks NUEVOS en ese estilo y renderizarlos en el avatar del usuario. **CONCEPTO YA PROBADO** en R&D (script `scripts/gen-style-v2.mjs`, renders `docs_para_claude/outfit-inspo/CFZ/v2-look-*.png`). *Por qué ahora no*: es un feature nuevo grande con cero usuarios reales validando el flujo core; el aprendizaje ya se extrajo. *Trigger*: hay usuarios reales usando el motor de outfits Y piden inspiración más allá de su clóset.

  **Arquitectura validada (mapea a motores que la app ya tiene):**
  1. **Extraer estilo POR VISIÓN** (el 80% del resultado): el modelo VE las fotos reales de la referencia y extrae su *gramática de styling* (movimientos de firma + anti-reglas + clóset atrevido), NO un brief de texto sanitizado. Un brief escrito a mano ("neutros + un protagonista") es una mentira segura que produce looks genéricos. Reusa el patrón de `/api/analizar-prenda` pero multi-imagen.
  2. **Definir el CLÓSET** = motor de cápsula (`generateCapsuleTarget`).
  3. **Armar LOOKS** = motor de outfits, con restricciones Camino A (implementadas en el script): cada look usa ≥2 movimientos de firma, reparte los movimientos (ninguno se repite entre looks), varía el calzado, y mete novedad (aplica el movimiento sin copiar un outfit real de la referencia).
  4. Render en el avatar del usuario con el vibe v3 (grey-wall Gen-Z).

  **→ Camino B (el paso que falta para producción-calidad): JUEZ DE VISIÓN + NOVEDAD.** Un paso 4 que mira cada render y regenera si: (a) copió una foto real casi literal, (b) repitió el mismo movimiento/zapato entre looks, (c) el render tiró un elemento que el look pedía. Patrón de "crítico de completitud" (correr en `JUDGE_MODEL` = sonnet, no opus, para abaratar). *Por qué se difirió*: cuesta 2-3× llamadas por look y es pulido de calidad, no cambia la conclusión del experimento. Camino A (restricciones en el prompt de looks, sin llamadas extra) ya sube la calidad notablemente y fue lo que se implementó. Detalle operacional: las 17 fotos crudas dan 413 (request too large) — reducir con `sips -Z 900 -s format jpeg -s formatOptions 60` antes de mandarlas a visión.
