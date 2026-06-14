# TODOS — stailist

Trabajo diferido con contexto. Cada ítem tiene su "por qué ahora no" y su trigger de reapertura.

## Diferido del planning (2026-06-10)

- [ ] **E2 — Detección multi-prenda en una foto**: subir una foto con varias prendas (outfit puesto, ropa sobre la cama) → la IA segmenta y propone N altas, cada una con confirmación editable. *Por qué ahora no*: el alfa de Replit ya alucinaba analizando UNA prenda; multi-prenda es estrictamente más difícil, y el experimento no la necesita. *Trigger*: Tatiana sube ≥10 fotos en su primera semana sin abandonar. *Decisión pendiente al reabrir*: recorte por prenda (frágil) vs foto compartida entre prendas (clóset menos visual).

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
