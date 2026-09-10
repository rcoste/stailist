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
- **Anuncios**: Google Ads, GA4 y el píxel de TikTok (`lib/publicidad.ts`) no
  cargan nada mientras su `NEXT_PUBLIC_*` esté vacío. El anuncio del que llegó
  cada cuenta queda en `profiles.origen` y se lee en `/admin/adquisicion`.

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
- `docs/designs/adwords-readiness.md` — qué quedó listo para los anuncios y qué
  falta configurar en cada plataforma.
- `CHANGELOG.md` — cada versión con su porqué.
