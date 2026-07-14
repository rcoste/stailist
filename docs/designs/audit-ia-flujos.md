# Audit de arquitectura de información y flujos — stailist

**Fecha:** 2026-07-14. **Método:** caminata completa de la app en viewport móvil
(cuenta dev con datos reales) + inventario de rutas en código. **Pregunta de
Roberto:** "tenemos muchas funcionalidades buenas, pero no sé si unas están
escondidas o no claras".

## El mapa real (lo que un usuario ve)

**Nav principal (siempre visible):** Hoy · Clóset · [✨ FAB Generar] · Historial · Viaje
**Arriba a la derecha:** Tu perfil (avatar)

| Feature | Camino | Taps | ¿Se descubre sola? |
|---|---|---|---|
| Look de hoy / generar | Hoy (CTA) o FAB ✨ | 0-1 | ✅ obvio |
| Clóset (prendas, buscar, filtros) | Clóset | 1 | ✅ |
| Agregar prenda (foto) | Clóset → agregar → "sube una prenda" | 2 | ✅ |
| Agregar varias (carrete) | Clóset → agregar → "sube varias" | 2 | ✅ |
| **Biblioteca (catálogo + stylists)** | Clóset → agregar → "explora" | 2 | ⚠️ enterrada bajo "agregar" |
| Cápsula (ideal + tus looks) | Clóset → tab "cápsula" | 2 | ⚠️ visible pero, ¿se entiende? |
| Wishlist | Clóset → tab "wishlist" | 2 | ✅ |
| Historial + "ponérmelo de nuevo" | Historial | 1 | ✅ |
| Modo viaje (maletas) | Viaje | 1 | ✅ |
| Pasaporte de estilo | Perfil → estilo | 2 | ✅ |
| **Cartera de colores (modo tienda)** | Perfil → estilo → "abrir mi cartera" | 3 | 🔴 escondida |
| Ajustar colorimetría / estilo ref / silueta | Perfil → estilo | 2-3 | ⚠️ 6 acciones en un tab |
| Vetos ("lo que nunca te pones") | Perfil → preferencias | 2 | ✅ |
| Try-on (pruébatelo) | dentro del look generado | — | ✅ contextual |

**Veredicto general:** la estructura de 5 tabs + FAB es correcta y estándar; la
profundidad máxima es 3 taps (sano). El problema NO es el esqueleto — son
**4 puntos calientes** concretos.

## Los 4 hallazgos (por severidad)

### 1. 🔴 La cartera de colores está enterrada — y es la feature "de calle"
Perfil → estilo → "abrir mi cartera de colores" (3 taps dentro de la zona de
configuración). Pero su caso de uso es **en la tienda, con una prenda en la
mano**: "¿este color me va?". Nadie va a Perfil en ese momento — la feature vive
en el lugar opuesto a donde ocurre su uso. Fue idea de Tatiana y tiene modo
chequeo con cámara; hoy es indescubrible.
**Propuesta:** entrada adicional contextual — p.ej. card en Hoy ("¿andas de
compras? tu cartera de colores") o acceso desde el clóset. La entrada del perfil
se queda (ahí se administra), se AGREGA una donde se usa.

### 2. 🔴 La biblioteca dice "agregar" pero también es catálogo para explorar
La biblioteca vive dentro del sheet "agregar" (semántica: "dar de alta algo que
ya tengo"). Pero desde julio también es **contenido para descubrir**: 47 prendas
del guardarropa de Carla Figliozzi (y vendrán más stylists), con "me gusta" →
wishlist. Un usuario que no quiere AGREGAR jamás la abrirá → los guardarropas
sembrados no los ve nadie.
**Propuesta:** darle entrada propia de exploración (card "descubre" en el clóset
o en la wishlist vacía: "explora la biblioteca y guarda lo que te guste"). La
entrada vía "agregar" se queda — son dos intenciones distintas hacia el mismo
lugar.

### 3. ⚠️ "Cápsula" es jerga de moda sin traducir
La regla de voz del producto: "cero jerga técnica ('los tonos tierra te
encienden la cara', no 'eres otoño profundo')". **"Cápsula" viola esa regla** —
es un término de la industria (capsule wardrobe) que Tatiana-persona puede no
mapear. El tab solo dice "cápsula"; adentro sí se explica bien ("POR QUÉ ES
TUYA"), pero el nombre del tab es la puerta y no invita.
**Propuesta:** validar con Tatiana/Toño qué entienden por "cápsula" antes de
renombrar (candidatos: "tu base", "básicos"). Si el término se queda (es corto y
la industria lo usa), añadir subtítulo la primera vez.

### 4. ⚠️ Dos banners de mantenimiento simultáneos en la cápsula
En /closet/capsula aparecen a la vez "Cambiaste tu estilo de referencia —
actualiza" Y "Tu clóset cambió — recalcular qué tienes". Dos verbos técnicos
distintos (actualizar vs recalcular) para el usuario son la misma cosa: "esto
está viejo". Doble banner = ruido y parálisis de elección.
**Propuesta:** unificar en UN nudge ("tu cápsula se quedó atrás de ti — ponla al
día") que dispare ambas actualizaciones en orden.

## Menores (anotados, no urgentes)
- **FAB ✨ redundante en /hoy:** en la pantalla Hoy conviven el CTA "armar mi
  look de hoy" y el FAB que hace lo mismo. Inofensivo (consistencia > purismo),
  no tocar por ahora.
- **Perfil → estilo con 6 acciones** (pasaporte, cartera, ajustar colorimetría,
  rehacer estilo, silueta, foto): denso pero funcional. Se alivia solo si la
  cartera gana entrada contextual (#1).
- **Doble captura de morfología** (body_type del avatar vs body_build de
  silueta): ya está en memoria (`morfologia-doble-captura`), arreglar de pasada
  al rediseñar perfil/avatar.

## Lo que está BIEN (no tocar)
- Nav de 5 + FAB: estándar, pulgar-friendly, sin sorpresas.
- El sheet "agregar" con 3 opciones tiene microcopy excelente ("una foto de algo
  suelto, tipo unos tenis" / "saco cada prenda").
- Sub-tabs del clóset (prendas · cápsula · wishlist) y del perfil (cuenta ·
  estilo · preferencias): patrón consistente entre secciones.
- Profundidad máxima 3 taps; sin callejones sin salida detectados.
- Try-on contextual dentro del look (donde debe estar).

## Estado (2026-07-14)
- ✅ **#1, #2, #4 HECHOS** (commit del mismo día, en `main`, suben con el próximo
  deploy). #4: nudge unificado en la cápsula. #2: card "Descubre" al pie del
  clóset + link en empty de wishlist. #1: entrada a cartera en la wishlist.
- ⬜ **#3** ("cápsula" jerga): pendiente de validar con Tatiana antes de tocar.

## Cómo decidir qué arreglar (recomendación)
Los 4 hallazgos son hipótesis mías leyendo la UI — el juez real es ver a
Tatiana/Toño usarla. Con el "ver como" del admin ya se puede observar qué
secciones NUNCA visitan (si nadie pisa /cartera ni /closet/biblioteca en 2
semanas, los hallazgos #1 y #2 quedan confirmados con datos). Orden sugerido:
**#4 (barato, puro texto/lógica de UI) → #2 (una card) → #1 (una card) → #3
(esperar validación con usuarias)**.
