# Desktop full — diseño de la app stailist en pantallas grandes

**Fecha:** 2026-07-14. **Decisión de Roberto:** compatibilidad completa desktop
(no solo el "escaparate"). **Objeción registrada (Claude):** cero usuarios
validados; es pulido pre-validación — aceptada por Roberto como apuesta.
**Contexto que lo justifica:** el correo semanal y el futuro paid traen
sesiones desktop (webmail, búsqueda); la landing ya es desktop-correcta.

## Filosofía

**Misma marca, más aire.** El desktop de stailist NO es "otra app": es la misma
editorial Gen-Z monocroma (Arimo + Instrument itálica, papel #f4f3f1, tinta)
con el lujo del espacio. Referencia mental: una revista de moda abierta, no un
dashboard SaaS. Nada de sidebars grises ni densidad de herramienta.

**Regla de oro de la migración:** mobile (<1024px) NO SE TOCA — es el producto
validándose. Todo lo desktop es aditivo detrás del breakpoint `lg:`.

## Decisiones estructurales

### 1. Breakpoint único: `lg` (1024px)
- `< 1024`: exactamente lo de hoy (columna 430, tab bar, sheets desde abajo).
- `≥ 1024`: modo desktop. **Sin layout intermedio de tablet** — una tablet
  vertical ve el móvil centrado (correcto) y una horizontal ve desktop. Dos
  layouts que mantener, no tres.

### 2. Navegación: header superior (no sidebar)
En `lg:` la tab bar inferior se oculta y aparece un header editorial fijo
arriba, coherente con el de la landing:

```
[stailist]        Hoy   Clóset   Historial   Viaje        [✨ Generar] [👤]
```

- Logo a la izquierda (link a /hoy).
- Tabs de texto al centro-izquierda (mismo orden que la tab bar; estado activo
  = subrayado fino, como "Armar mi look" en la landing).
- Botón ✨ "Generar" (accent, pill) + avatar/perfil a la derecha.
- Por qué header y no sidebar: la marca es editorial (una revista tiene
  cabecera, no rail); reflow barato; la landing ya educó ese patrón.

### 3. Contenido: opt-in por página (la clave de la migración)
`AppShell` gana una prop `desktop`:
- `desktop="column"` (default): la columna 430 centrada, enmarcada con
  hairline `border-line` y fondo lateral `bg-surface` — el "escaparate".
  **Toda página no migrada se ve intencional desde el día 1.**
- `desktop="wide"`: contenedor `lg:max-w-5xl` y la página controla su layout
  interno con utilidades `lg:`.

Así cada pantalla "se gradúa" a wide cuando se rediseña, sin big-bang y sin
romper jamás lo no migrado.

### 4. Sheets → diálogos centrados
Patrón transversal: todo bottom-sheet (`fixed inset-0 items-end` + `sheet-up`)
gana en `lg:` la variante `lg:items-center` + `lg:max-w-md lg:rounded-[18px]`
(diálogo centrado). Aplica a: hoja "agregar", confirmación de prenda, opt-in
de correo, prompt PWA, filtros, razones de voto, combo builder.
Animación: `sheet-up` sirve para ambos (sube 16px + fade — en el centro se lee
como "pop in" correcto).

### 5. Tokens y DESIGN.md
Cero colores/espaciados nuevos. Las únicas adiciones al sistema (documentar en
DESIGN.md en el mismo commit de la Fase 1):
- Breakpoint de app: `lg` = modo desktop.
- Patrón "header de app desktop" y patrón "diálogo centrado".
- Escalas de grid por superficie (abajo).

## Diseño por pantalla (modo wide)

| Pantalla | Layout desktop |
|---|---|
| **Hoy (con look)** | 2 columnas: izquierda imagen del look/try-on (sticky, ~40%), derecha título + explicación + tip + acciones (voto, pruébatelo, fit check — el botón "me lo puse" dejó de existir en el rediseño del home del 2026-08-11; no lo construyas en desktop). El look deja de ser "scroll de teléfono" y se vuelve página de revista. |
| **Hoy (vacío + wizard)** | Columna editorial centrada como hoy (un flujo enfocado no gana nada con ancho). |
| **Clóset · prendas** | Grid `lg:grid-cols-5` (hoy 3), búsqueda y filtros en una fila arriba. Card "Descubre" al pie a lo ancho. |
| **Clóset · cápsula** | 2 columnas: izquierda sticky "por qué es tuya" + progreso + nudges; derecha la lista de prendas. |
| **Clóset · looks de cápsula** | Grid de cards 3 por fila. |
| **Wishlist** | Grid `lg:grid-cols-4` (hoy 2); cartera link arriba; combo builder como diálogo. |
| **Biblioteca** | Grid `lg:grid-cols-6` + barra de acción como fila normal (no fija). |
| **Historial** | Grid de looks `lg:grid-cols-3` con la card actual. |
| **Viaje · lista** | Cards de maletas en grid de 2-3. |
| **Viaje · detalle** | 2 columnas: izquierda resumen del viaje/clima; derecha outfits por día. |
| **Perfil** | Columna centrada un poco más ancha (`lg:max-w-2xl`), tabs iguales. |
| **Onboarding completo** | Columna centrada enmarcada (`desktop="column"`). El flujo enfocado ES el diseño; solo se ve intencional. |
| **Cartera / chequear** | Columna centrada (uso real es en tienda = teléfono; en desktop basta que sea digno). |
| **Admin** | Ya usa `max-w-5xl` propio — fuera de alcance. |

## Fases (cada una shippeable y verificada en 375px y 1366px)

1. **F1 — Shell** (~1 sesión): header desktop + ocultar tab bar en `lg` +
   escaparate default en AppShell + patrón sheet→diálogo aplicado a los sheets
   compartidos + DESIGN.md actualizado. *Resultado: TODA la app se ve
   intencional en desktop; ninguna pantalla wide aún.*
2. **F2 — Grids** (~1 sesión): clóset, wishlist, biblioteca, historial a wide.
   (Las de mayor ganancia por esfuerzo: son grids que solo necesitan columnas.)
3. **F3 — Héroes** (~1-2 sesiones): Hoy 2-col, cápsula 2-col, viaje lista+detalle.
4. **F4 — Barrido** (~0.5-1 sesión): perfil, estados vacíos, /design-review de
   ambos breakpoints, fix de lo que salga.

## Riesgos conocidos
- **Componentes con `max-w-[430px]` hardcodeado** (tab-bar, sheets, overlays):
  auditarlos en F1; los sheets migran al patrón diálogo, la tab bar se oculta.
- **El try-on y renders son 3:4 vertical** — en Hoy 2-col la imagen alta manda
  la columna izquierda; el sticky lo resuelve.
- **QA doble**: cada fase se verifica en móvil (que NADA cambió) y desktop.
