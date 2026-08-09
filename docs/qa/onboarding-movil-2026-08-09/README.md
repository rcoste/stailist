# El onboarding completo, en móvil — 2026-08-09

Recorrido de punta a punta en un iPhone 14 (390×844, `deviceScaleFactor` 2, UA
de Safari iOS) contra el dev server, con la cuenta `claude.dev@stailist.app`
reseteada a cero. **64 capturas**, 20 de ellas de pantallas de espera: las
esperas son producto, y este camino tiene cuatro generaciones de IA.

Cómo se reproduce: `node recorrido.mjs ./capturas ./avatar-face.jpg` y luego
`node tryon.mjs ./capturas 52` (requieren `playwright`; van aquí como registro,
no como suite — no corren en CI). La cara de entrada es un retrato generado que
ya vivía en el storage de esa misma cuenta.

---

## Lo que de verdad son los pasos

El indicador dice **5 pasos**. Por dentro son **~16 pantallas**:

| lo que anuncia | lo que hay |
|---|---|
| *(sin numerar)* | género — elegir **y confirmar** |
| *(sin numerar)* | edad |
| paso 1 de 5 | **25** cartas de swipe → reveal del arquetipo → 2 pares de corte |
| paso 2 de 5 | portada del quiz → **6 preguntas** → resultado |
| paso 3 de 5 | **5 pantallas encadenadas**: Arriba → Abajo → Zapatos → Sacos → Abrigos |
| paso 4 de 5 | objetivo |
| paso 5 de 5 | **su propio wizard**, con su propio contador: "paso 1 de 2" → clima → generar |

Antes de ver un solo outfit hay **~45 decisiones** (25 swipes + 2 pares +
6 de color + los básicos de 5 pantallas + 3 del wizard final).

---

## Lo que mide

| espera | tiempo real |
|---|---|
| leer tu estilo, tras los swipes | ~5 s |
| calcular tu colorimetría | ~4 s |
| **el primer look** | ~12 s |
| **el retrato del avatar** | **18 s** |
| **el cuerpo del avatar** | **25 s** |
| **el try-on** | **54 s — y falló** |

El avatar cuesta **43 s de generación en dos tandas**. Los primeros 18 quedan
tapados desde hoy por las preguntas de complexión y estatura (v0.2.196.0); los
otros 25 siguen siendo espera pelada, y son el bloque muerto más grande que
queda antes del try-on.

---

## Hallazgos

### 1. El try-on falla en silencio (y el botón promete la tercera parte)

`POST /api/tryon` → **502 a los 54 s**. La pantalla se limita a volver al
estado inicial: sin error, sin explicación, sin reintento. Quien lo vive cree
que no pulsó bien.

Y el botón dice **"~20 s"**. Aun cuando funciona, la promesa es de otro orden
de magnitud que lo medido.

Capturas `55`–`64`. Además, los mensajes de carga **se repiten en bucle**:
*"ajusto caídas y largos…"* sale a los 20 s, a los 44 y a los 50. Ver el mismo
mensaje tres veces es la señal universal de "esto se colgó".

### 2. `Controller is already closed` — la causa de la doble generación

Encontrada corriendo esto, en los logs:

```
[generate] fallo: TypeError: Invalid state: Controller is already closed
    at send (app/api/generate/route.ts:75)
```

Cuando la persona se va a media generación —cambiar de app, bloquear la
pantalla, tocar atrás— el controlador del stream se cierra y el siguiente
`send` lanza. Eso abortaba la corrida: los outfits ya guardados se quedaban,
pero la cola (el juez, los tiempos, y **el cierre del paso 5**) nunca corría.

Es exactamente lo que le pasó a Roberto hoy a las 15:17, deducido entonces por
lo que *faltaba* y **confirmado a las 18:27** por el evento `generation_failed`
que se había añadido esa misma mañana, con `paso: 4`.

**Arreglado**: escribir al stream pasa a ser best-effort, y la generación se
termina aunque no quede nadie al otro lado.

### 3. En género, elegir no avanza

Marcas "hombre" y no pasa nada hasta que bajas a "empecemos". En las demás
pantallas de una sola respuesta, elegir sí avanza. Capturas `02`–`03`.

### 4. El avatar bloquea sin decir por qué

Si tecleas tu estatura y no eliges complexión, el botón queda deshabilitado sin
una palabra de por qué. Capturas `40`–`41`.

### 5. Dos explicaciones apiladas en los básicos

El párrafo que se añadió el 2026-08-09 dice casi lo mismo que la línea que ya
estaba debajo (*"Marca lo que tengas de cada tipo — al menos arriba, abajo y
zapatos"*). Es deuda propia, no heredada. Y el chip de "Zapatos" sale cortado
por el borde. Captura `24`.

### 6. 25 cartas de swipe

La spec dice ~15 looks. Son 25, en el paso que ya es el más largo. Captura `06`
("1 de 25").
