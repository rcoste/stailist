# Design System — stailist

> **v3 "Gen-Z monocromo" (rebrand 2026-06-26)** — esta versión **supersede** la
> dirección v2 "Atelier" (serif Bodoni + acento burdeos). Disparada por el primer
> feedback de una usuaria real del target (Mariana/Yensi): "muy millennial, nada Gen Z".
> Dirección nueva: blanco y negro, sans grande y limpia estilo Mango, serif solo de
> acento mínimo. El try-on es el único momento oscuro de la app. Migración por capas
> (ver Decisions Log); Capa 1 (fundamentos/tokens) aplicada.

## Product Context
- **What this is:** Stylist personal con IA — arma outfits con tu ropa y te recibe cada día con un look pensado para ti.
- **Who it's for:** Tatiana y perfiles como ella; unisex por diseño (Roberto y Toño también son usuarios). Debe sentirse igual de natural para un hombre que para una mujer.
- **Space/industry:** Moda / clóset digital. Competidores: Indyx (editorial verde bosque), Whering (ácido Gen-Z), Mango (monocromo grande, referencia de la dirección v3).
- **Project type:** Web app PWA móvil-first (~430px), columna única centrada en desktop.

## Aesthetic Direction
- **Direction:** Gen-Z monocromo — blanco y negro, sans grande y limpia (estilo Mango), mucho aire. Elegancia por tipografía, escala y espacio; nunca por ornamento ni por color.
- **Decoration level:** Mínima-intencional. Hairlines en vez de sombras; fondo papel neutro, no blanco puro. El B&N es para el chrome/editorial; **las fotos de prendas y el try-on van a todo color** (la usuaria necesita reconocer su ropa real).
- **Mood:** Limpio y editorial en el look, "tu amiga cool que se viste increíble" en la voz. El contraste look-monocromo/copy-cálido ES la personalidad.
- **App clara, try-on oscuro:** toda la navegación es en claro; el único momento oscuro es el try-on ("verte con el look puesto") — fondo casi-negro `#0a0a0a`, el "ta-da" inmersivo.
- **Prohibiciones de mood:** cero gradientes de marca, cero sellos/corazones/destellos de relleno, cero íconos en círculos de colores. **Cero ámbar/terracota/naranja** (default de IA — vetado explícitamente por Roberto). Cero color de marca que no sea tinta/negro.
- **Reference:** handoff `claude-design-handoffs-stailist/design_handoff_hoy_rebrand_v3/` (gitignored; `Fundamentos v3.html` = spec de tokens, `Hoy Flujo Completo.html` = flujo Hoy).

## Typography (v3 "Gen-Z monocromo" — rebrand 2026-06-26)
- **INVERSIÓN DE JERARQUÍA (el cambio clave vs. v2):** los titulares (h1–h3) ahora son **sans**, no serif. Regla base: `font-family: var(--font-arimo); font-weight: 700; letter-spacing: -0.025em`.
- **Display/Hero/titulares (h1–h3) + todo el UI/labels/botones/datos:** Arimo (grotesca limpia, fuente variable → todo el rango de peso 400–700). Una sola sans para todo, con titulares en 700 a gran tamaño (estilo Mango).
- **Editorial accent (`.editorial` / `.display`):** Instrument Serif **solo de acento mínimo** — una palabra en itálica, la justificación de un outfit, el wordmark. **Nunca párrafos, labels, UI, ni texto <18px.** Solo pesa 400; usar a tamaño grande e itálica.
- **Data:** Arimo con `font-variant-numeric: tabular-nums` (clase `.tabular`).
- **Loading:** `next/font/google` (self-hosted, sin FOUT). Variables CSS: `--font-arimo` (sans), `--font-instrument` (serif acento). Tokens: `--font-sans`, `--font-display`, `--font-editorial`.
- **Scale:** display 32/40 · h1 28/36 · h2 22/30 · h3 18/26 · body 16/24 · sm 14/20 · caption 12/16 (px/line-height). Body nunca <16px. (Titulares editoriales del flujo Hoy escalan hasta ~52px.)
- **Tracking:** titulares −0.025em; labels uppercase +0.04em.

## Color
- **Approach:** Monocromo — tinta/negro + neutros de-warmed. El color de marca es nulo a propósito; la ropa de la usuaria pone el único color real.
- **Accent — tinta `#0A0A0A` (casi negro):** CTAs, el "ai" del logo, énfasis. Botones = negro sólido sobre papel. Hover/pressed: `#000000` (negro puro). Tinte suave para fondos de chips/estados: `#F1F0EE` (gris neutro). **Nota:** donde un link en tinta se confunda con texto normal, distinguirlo por **peso/subrayado, no por color**.
- **On-accent:** `#FFFFFF`.
- **Neutrals (de-warmed):** bg `#F4F3F1` (papel neutro) · surface `#FFFFFF` (cards) · ink `#141414` (texto) · muted `#6F6F6F` (secundario) · line `#E4E3E0` (hairlines).
- **Semantic (sin cambio — son funcionales, no de marca):** success `#4C7A5E` (salvia discreta) · error `#B3261E` (rojo de alarma) · warning `#8A6D1F` (uso excepcional).
- **Superficie oscura (try-on, aplicada inline en el flujo Hoy):** fondo `#0A0A0A` · vidrio `rgb(255 255 255 / .12)` · borde claro `rgb(255 255 255 / .2)`. No son tokens globales (solo viven en el modal de try-on).
- **Metal (reveal de colorimetría, sin cambio):** oro `#E7C977→#B8932F` (paletas cálidas) · plata `#E2E5E8→#AEB3B8` (paletas frías). Gradiente radial. Tokens `--metal-oro` / `--metal-plata`. Único uso: el chip de metal en el reveal.
- **Dark mode:** DIFERIDO post-MVP (decisión registrada). El try-on es la única superficie oscura intencional.

## Spacing
- **Base unit:** 4px · **Density:** cómoda (aire generoso = premium)
- **Scale:** xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32) 3xl(48) 4xl(64)

## Layout
- **Approach:** grid-disciplinado, columna única móvil-first
- **Max content width:** 430px centrada en desktop
- **Border radius (crispado, NO pill — sin cambio vs. v2):** sm 3px (inputs, chips, botones, badges) · md 4px (tiles de prenda) · lg 6px (cards de outfit) · full 9999px **reservado solo** para puntos/indicadores circulares. Los CTAs son rectángulos crispados, NO pastillas.
- **Sombras:** casi nulas — `0 1px 2px rgb(26 23 24 / 0.05)` máximo; las hairlines hacen la separación.
- **Navegación:** tabs fijos abajo + FAB central de "armar look". Nada en hamburguesa.

## Motion
- **Approach:** intencional
- **Easing:** enter `ease-out` · exit `ease-in` · move `ease-in-out`
- **Duration:** micro 100ms · short 200ms · medium 300ms
- **Firmas:** entradas fade + rise 8px (`step-in`); progreso de generación de outfits = frase de estilista que se escribe sola (typewriter) + barra de progreso, nunca spinner genérico. Ícono destello girando lento (`spin 6s`).
- **Shimmer de texto** (`.shimmer-txt` en globals.css): barrido muted→ink→muted (1.6s) para etiquetas de carga cortas dentro de una fila (try-on "Creando tu look…"). Respeta `prefers-reduced-motion`.
- **Excepción try-on:** el estado "generando" del try-on dentro de la `OutfitCard` sí usa spinner + shimmer en la fila al pie (no frases). Es carga local de ~20s con la card visible, no la generación full-screen del look. Decisión del handoff `design_handoff_tryon_protagonista`.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | Sistema inicial creado | /design-consultation con research (Indyx/Whering) anclado al logo wordmark |
| 2026-06-10 | Mood unisex estructural (variant D) | Roberto: el mood editorial-itálico se sentía femenino/intimidante; elegancia sin género = estructura, no adornos |
| 2026-06-10 | Veto a ámbar/terracota; acento → burdeos #722F37 (variant G) | Roberto detectó el default "Claude branding" en las propuestas; burdeos = elegante, unisex, ownable |
| 2026-06-10 | Logo: wordmark st-ai-list con "ai" en acento, sin sufijo "ai" | Decisión explícita de Roberto |
| 2026-06-10 | Dark mode diferido | MVP es light editorial; revisar post-validación |
| 2026-06-16 | Rebrand v2 "Atelier": Outfit+Fraunces → Bodoni Moda + Hanken Grotesk; radios pill → crispados 3/4/6; emoji → íconos de línea | Handoff de diseño v2. Paleta sin cambios (burdeos) |
| 2026-06-17 | Try-on protagonista en `OutfitCard` (Hoy): 3 estados, nuevo `.shimmer-txt` + ícono `expandir` | Handoff `design_handoff_tryon_protagonista`. Solo en Hoy |
| **2026-06-26** | **Rebrand v3 "Gen-Z monocromo" — SUPERSEDE v2.** Acento burdeos #722F37 → tinta #0A0A0A; neutros cálidos → de-warmed; Bodoni Moda + Hanken Grotesk → **Instrument Serif (acento mínimo) + Arimo (todo)**; **inversión de jerarquía**: h1–h3 serif → sans Arimo 700; icon/manifest/theme-color a v3. El try-on es la única superficie oscura. | Primer feedback de usuaria real del target (Mariana/Yensi): "muy millennial, nada Gen Z". Ataca la piel (estética), no el motor — barato y de bajo riesgo. Handoff `design_handoff_hoy_rebrand_v3`. Migración por capas: **Capa 1 fundamentos/tokens (aplicada)** → Capa 3 flujo Hoy → resto de pantallas, cada una su PR |
