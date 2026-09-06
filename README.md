# stailist

Stylist personal con IA: arma looks con la ropa que ya tienes, según tus
gustos, tus colores y el clima. En español, pensado para México.
**https://stailist.co**

## Cómo está hecho

- **Next.js** (App Router) en Vercel.
- **Supabase**: Postgres con RLS en todo, Storage privado con URLs firmadas,
  auth por código de un solo uso al correo.
- **IA**: los modelos viven sólo en `lib/models.ts`; toda llamada sale por la
  puerta común `lib/proveedores` y deja recibo en `ai_calls`. Cuotas diarias
  por persona en `lib/cuotas.ts`.
- **Correos**: Postmark. **Clima**: Open-Meteo.

## Correr en local

```bash
cp .env.example .env.local   # y rellena cada variable (el archivo dice de dónde sale cada una)
npm install
npm run dev
```

Tests: `npm run test` (vitest). Build: `npm run build`.

## Dónde leer más

- `CLAUDE.md` — la idea, el enemigo a vencer y las reglas de trabajo.
- `docs/USER-JOURNEY.md` — el flujo de valor paso a paso.
- `docs/improvement-loop-del-motor.md` — cómo se decide un cambio del motor.
- `docs/auditorias/` — la auditoría pre-release y su plan de ataque.
- `CHANGELOG.md` — cada versión con su porqué.
