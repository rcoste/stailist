# El onboarding en móvil — pantalla por pantalla

Las **35 pantallas distintas** del recorrido completo, en orden, tal como se ven
en un iPhone 14 (390×844). Para trabajar el diseño encima.

Vienen del recorrido automatizado del 2026-08-09 con cuenta nueva y las cuatro
generaciones de IA corriendo de verdad. **El set completo** —64 capturas,
incluidos los 20 fotogramas de espera— vive en
[`docs/qa/onboarding-movil-2026-08-09/`](../../qa/onboarding-movil-2026-08-09/),
junto con el guion para repetirlo y el informe con los tiempos medidos.

Aquí está deduplicado: una imagen por pantalla, y **un solo estado de carga por
generación** (los archivos `CARGA-*`) en vez de nueve casi idénticos. Las
esperas se conservan a propósito: son 43 s de avatar y ~54 s de try-on, o sea
que son diseño, no un hueco entre pantallas.

## El orden

| # | archivo | qué es |
|---|---|---|
| 01 | `01-login` | entrada |
| 02–04 | `02-genero`, `03-genero-seleccionado`, `04-edad` | quién eres |
| 05–07 | `05-swipe-carta-1`, `06-swipe-a-mitad`, `07-swipe-ultima` | **25 cartas** de gustos |
| 08 | `08-CARGA-leyendo-tu-estilo` | ~5 s |
| 09 | `09-estilo-reveal` | tu arquetipo |
| 10–11 | `10-pares-corte-1`, `11-pares-corte-2` | cómo te queda |
| 12–14 | `12-color-portada`, `13-color-pregunta`, `14-color-pregunta-larga` | quiz de color (portada + **6** preguntas) |
| 15–16 | `15-CARGA-calculando-color`, `16-color-resultado` | ~4 s → tu estación |
| 17–21 | `17-basicos-arriba` … `21-basicos-abrigos` | **5 pantallas encadenadas** |
| 22 | `22-objetivo` | qué necesitas hoy |
| 23–24 | `23-wow-dia-o-noche`, `24-wow-clima` | el wow trae **su propio wizard** |
| 25 | `25-CARGA-primer-look` | ~12 s |
| 26–27 | `26-wow-selector-de-looks`, `27-look-detalle` | tus primeros looks |
| 28–33 | `28-avatar-fotos` … `33-avatar-resultado` | el avatar (**43 s** en dos tandas) |
| 34–35 | `34-CARGA-tryon`, `35-tryon-fallido` | try-on |

## Lo que ya sabemos que está mal

Antes de rediseñar, lo que el recorrido dejó documentado:

1. **El indicador miente sobre el tamaño.** Dice "5 pasos"; son ~16 pantallas.
   El paso 3 son cinco encadenadas, y el paso 5 trae su propio contador que
   **reinicia en 1** — acabas de ver "paso 4 de 5" y lo siguiente dice
   "paso 1 de 2" (`22-objetivo` → `23-wow-dia-o-noche`).
2. **El try-on falla en silencio** (502 a los 54 s) y vuelve al estado inicial
   sin decir nada; el botón promete "~20 s" (`35-tryon-fallido`).
3. **En género, elegir no avanza** — hay que bajar a confirmar, y en las demás
   pantallas de una sola respuesta elegir sí avanza (`02` vs `03`).
4. **El avatar bloquea sin explicar**: sin complexión el botón queda
   deshabilitado y nada lo dice (`30-avatar-cuerpo`).
5. **Dos explicaciones apiladas en básicos**: el párrafo de arriba dice casi lo
   mismo que la línea de abajo, y el chip de "Zapatos" sale cortado
   (`17-basicos-arriba`).
6. **Los mensajes de carga se repiten en bucle** — en el try-on, *"ajusto
   caídas y largos…"* sale a los 20 s, a los 44 y a los 50. Ver el mismo
   mensaje tres veces se lee como "esto se colgó".

## Ojo antes de compartir

Las capturas del avatar y el try-on (`29`, `31`, `33`, `34`, `35`) **muestran
una cara fotorrealista**. Es un retrato generado de la cuenta de pruebas, pero
se parece a una persona real y este repo es público.
