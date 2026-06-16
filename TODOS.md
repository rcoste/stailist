# TODOS — stailist

Trabajo diferido con contexto. Cada ítem tiene su "por qué ahora no" y su trigger de reapertura.

## Diferido del planning (2026-06-10)

- [ ] **E2 — Detección multi-prenda en una foto** ("sube una foto tipo Instagram → saco tus prendas"): subir una foto con varias prendas (outfit puesto, ropa sobre la cama) → la IA propone N altas, cada una con confirmación editable. *Por qué ahora no*: el alfa de Replit ya alucinaba analizando UNA prenda; multi-prenda es estrictamente más difícil (errores que se acumulan envenenan el motor), y el experimento no la necesita — el checklist de 15 básicos ya mató la fricción de catalogar. *Trigger*: hay usuarios reales Y señal de que el flujo actual de una-prenda-por-foto (`/closet`) se siente lento o quieren meter más ropa. Candidata #1 para el primer feature post-validación (es el upgrade natural del paso 8 del USER-JOURNEY, "el clóset crece").

  **Diseño acordado (2026-06-16):**
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

## Fases futuras (del design doc — NO tocar hasta validar el MVP)

- [ ] Sugerencias de compra estratégica con ROI ("esta pieza desbloquea 8 outfits") — el modelo de negocio latente.
- [ ] Modo maleta / empacador de viajes (la feature por la que Roberto pagaría; validada emocionalmente por Toño).
- [ ] Análisis de colorimetría por selfie (hoy: quiz manual — el análisis automático es frágil: iluminación, balance de blancos).
- [ ] Catálogos de marcas vía programas de afiliados o catálogo semilla curado (NUNCA scraping — viola ToS).
- [ ] Compartir outfit como imagen/link (E3 — descartada en ceremonia CEO 2026-06-10; reconsiderar solo si la calidad de outfits valida y hay demanda orgánica de compartir).
- [ ] Interfaz híbrida conversacional (chat + botones, sugerencia de Toño) — candidata para v2 del flujo de generación.
- [ ] Monetización freemium / referidos e-commerce (hipótesis de Toño: referidos > suscripción). Validar willingness-to-pay primero.
- [ ] **Panel admin de métricas**: hoy las métricas (TTV, ratio de votos, tiempos de generación) se consultan en el dashboard de Supabase. Un panel propio tiene sentido con 20+ usuarios. *Trigger*: la beta crece más allá del círculo cercano.
