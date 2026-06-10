# TODOS — stailist

Trabajo diferido con contexto. Cada ítem tiene su "por qué ahora no" y su trigger de reapertura.

## Diferido del planning (2026-06-10)

- [ ] **E2 — Detección multi-prenda en una foto**: subir una foto con varias prendas (outfit puesto, ropa sobre la cama) → la IA segmenta y propone N altas, cada una con confirmación editable. *Por qué ahora no*: el alfa de Replit ya alucinaba analizando UNA prenda; multi-prenda es estrictamente más difícil, y el experimento no la necesita. *Trigger*: Tatiana sube ≥10 fotos en su primera semana sin abandonar. *Decisión pendiente al reabrir*: recorte por prenda (frágil) vs foto compartida entre prendas (clóset menos visual).

## Fases futuras (del design doc — NO tocar hasta validar el MVP)

- [ ] Sugerencias de compra estratégica con ROI ("esta pieza desbloquea 8 outfits") — el modelo de negocio latente.
- [ ] Modo maleta / empacador de viajes (la feature por la que Roberto pagaría; validada emocionalmente por Toño).
- [ ] Análisis de colorimetría por selfie (hoy: quiz manual — el análisis automático es frágil: iluminación, balance de blancos).
- [ ] Catálogos de marcas vía programas de afiliados o catálogo semilla curado (NUNCA scraping — viola ToS).
- [ ] Compartir outfit como imagen/link (E3 — descartada en ceremonia CEO 2026-06-10; reconsiderar solo si la calidad de outfits valida y hay demanda orgánica de compartir).
- [ ] Interfaz híbrida conversacional (chat + botones, sugerencia de Toño) — candidata para v2 del flujo de generación.
- [ ] Monetización freemium / referidos e-commerce (hipótesis de Toño: referidos > suscripción). Validar willingness-to-pay primero.
- [ ] **Panel admin de métricas**: hoy las métricas (TTV, ratio de votos, tiempos de generación) se consultan en el dashboard de Supabase. Un panel propio tiene sentido con 20+ usuarios. *Trigger*: la beta crece más allá del círculo cercano.
