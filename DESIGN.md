# Design System — stailist

## Product Context
- **What this is:** Stylist personal con IA — arma outfits con tu ropa y te recibe cada día con un look pensado para ti.
- **Who it's for:** Tatiana y perfiles como ella; unisex por diseño (Roberto y Toño también son usuarios). Debe sentirse igual de natural para un hombre que para una mujer.
- **Space/industry:** Moda / clóset digital. Competidores: Indyx (editorial verde bosque), Whering (ácido Gen-Z).
- **Project type:** Web app PWA móvil-first (~430px), columna única centrada en desktop.

## Aesthetic Direction
- **Direction:** Editorial estructural — "sastrería moderna / casa de moda". Elegancia por tipografía, espacio y jerarquía; nunca por ornamento.
- **Decoration level:** Mínima-intencional. Hairlines en vez de sombras; fondo papel, no blanco puro.
- **Mood:** Elegante y serio en el look, "tu amiga cool que se viste increíble" en la voz. El contraste look-serio/copy-cálido ES la personalidad.
- **Prohibiciones de mood:** cero itálicas decorativas grandes, cero sellos/corazones/destellos, cero gradientes, cero íconos en círculos de colores. **Cero ámbar/terracota/naranja** (default de IA — vetado explícitamente por Roberto).
- **Reference:** mockup aprobado en `~/.gstack/projects/stailist/designs/design-system-20260610/` (estructura: variant-D · paleta: variant-G).

## Typography (v2 "Atelier" — rebrand 2026-06-16)
- **Display/Hero/titulares (h1–h3):** Bodoni Moda (serif display de alto contraste, eje opsz 6–96), pesos 500/600. Masthead de casa de moda. **NUNCA en UI ni texto <18px** (se vuelve frágil).
- **Body/UI/labels/botones/datos:** Hanken Grotesk (grotesca limpia), pesos 400/500/600/700. Una sola grotesca para todo el UI.
- **Editorial accent (`.editorial`):** Bodoni Moda 500 **REDONDA (no itálica)** — SOLO la justificación del outfit y micro-titulares serif. El contraste look-serio/voz-cálida vive aquí.
- **Data:** Hanken con `font-variant-numeric: tabular-nums` (clase `.tabular`).
- **Loading:** `next/font/google` (self-hosted, sin FOUT). Variables CSS: `--font-hanken` (sans), `--font-bodoni` (display). Tokens: `--font-sans`, `--font-display`, `--font-editorial`.
- **Scale:** display 32/40 · h1 28/36 · h2 22/30 · h3 18/26 · body 16/24 · sm 14/20 · caption 12/16 (px/line-height). Body nunca <16px.
- **Tracking:** titulares −0.01em; labels uppercase +0.04em.

## Color
- **Approach:** Restrained — 1 acento + neutros cálidos. El color es raro y significativo; la ropa de la usuaria pone el color real.
- **Accent — burdeos oxblood `#722F37`:** CTAs, el "ai" del logo, énfasis. El color del calzado clásico y las casas de moda europeas: unisex, elegante, nadie en el mercado lo tiene. Hover/pressed: `#5C252C`. Tinte suave para fondos de chips/estados: `#F2E8E8`.
- **On-accent:** `#FFFFFF`.
- **Neutrals (cálidos):** bg `#F5F3F0` (papel hueso) · surface `#FFFFFF` (cards) · ink `#1A1718` (texto) · muted `#79716B` (secundario) · line `#E5E1DD` (hairlines).
- **Semantic:** success `#4C7A5E` (salvia discreta) · error `#B3261E` (rojo claro de alarma — deliberadamente distinto del burdeos para que el acento nunca parezca error) · warning `#8A6D1F` (uso excepcional).
- **Dark mode:** DIFERIDO post-MVP (decisión registrada — la elegancia editorial de stailist es de papel; revisar cuando haya demanda real).

## Spacing
- **Base unit:** 4px · **Density:** cómoda (aire generoso = premium)
- **Scale:** xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32) 3xl(48) 4xl(64)

## Layout
- **Approach:** grid-disciplinado, columna única móvil-first
- **Max content width:** 430px centrada en desktop
- **Border radius (v2 — crispado, NO pill):** sm 3px (inputs, chips, botones, badges) · md 4px (tiles de prenda) · lg 6px (cards de outfit) · full 9999px **reservado solo** para puntos/indicadores circulares. Los CTAs son rectángulos crispados, NO pastillas — la seriedad de casa de moda viene de cantos casi rectos.
- **Sombras:** casi nulas — `0 1px 2px rgb(26 23 24 / 0.05)` máximo; las hairlines hacen la separación.
- **Navegación:** 3 tabs fijos abajo (Hoy / Clóset / Historial). Nada en hamburguesa.

## Motion
- **Approach:** intencional
- **Easing:** enter `ease-out` · exit `ease-in` · move `ease-in-out`
- **Duration:** micro 100ms · short 200ms · medium 300ms
- **Firmas:** entradas fade + rise 8px; progreso de generación = frases que se funden lentamente (crossfade ~400ms), nunca spinner genérico.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | Sistema inicial creado | /design-consultation con research (Indyx/Whering) anclado al logo wordmark |
| 2026-06-10 | Mood unisex estructural (variant D) | Roberto: el mood editorial-itálico se sentía femenino/intimidante; elegancia sin género = estructura, no adornos |
| 2026-06-10 | Veto a ámbar/terracota; acento → burdeos #722F37 (variant G) | Roberto detectó el default "Claude branding" en las propuestas; burdeos = elegante, unisex, ownable (navy = fintech, monocromo = sin color de marca) |
| 2026-06-10 | Logo: wordmark st-ai-list con "ai" en burdeos, sin sufijo "ai" | Decisión explícita de Roberto |
| 2026-06-10 | Dark mode diferido | MVP es light editorial; revisar post-validación |
| 2026-06-16 | Rebrand v2 "Atelier": Outfit+Fraunces → **Bodoni Moda + Hanken Grotesk**; radios pill → crispados 3/4/6; emoji → íconos de línea; logo a Bodoni con isotipo "gancho" | Handoff de diseño v2 (`claude-design-handoffs-stailist/design_handoff_stailist_v2`). Paleta sin cambios (burdeos). Migración por etapas: fundamentos → primitivas → pantallas |
