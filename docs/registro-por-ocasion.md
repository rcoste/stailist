# Cómo se viste la gente de verdad, por ocasión

> Investigación pedida por Roberto (2026-08-25): "no sé si deberías hacer una
> calibración research sobre cómo vestirse para diferentes ocasiones…
> está muy cabrón y nada más no le pegas: estás bastante overdressed".
>
> **El precedente que valida el método es el funeral**: era un evento que
> fallaba hasta que su línea dejó de ser genérica y se volvió una descripción
> investigada de la práctica real ("el uniforme del luto, en este orden…").
> Salió 5/5 con Roberto. Este doc hace lo mismo para los eventos sociales.
>
> Alimenta: v71 (el fix mecánico, medido aparte) y las líneas candidatas de
> v72 (§3, sin escribir al catálogo hasta que Roberto las vea y su ronda mida).

## 1. Lo que dice la práctica (fuentes abajo)

**La regla número uno de todas las guías de citas/eventos sociales: el error
principal no es el nivel, es el CONTEXTO.** "A three-piece suit at a taco spot
makes you look out of touch, not impressive" — la pregunta correcta es
*"¿me mezclaría o destacaría en ese lugar?"*, no "¿qué tan arreglado?".

- **Coctel / semiformal (evento social)**: blazer o sport coat + pantalón de
  vestir + camisa con cuello + zapato de piel. "Sharper than smart casual…
  a clear step below black tie — the point where business ends and the party
  begins". El traje completo CABE en el código (la guía mexicana de VAMANA lo
  lista: "traje completo o saco coordinado + camisa, corbata opcional") pero
  es su lectura MÁS formal, no la default.
- **Cena/drinks con amigos en restaurante casual**: smart casual — "si es
  para drinks en un buen restaurante, smart casual cocktail attire basta".
  Camisa o polo de calidad + chino o mezclilla oscura buena + loafer/Chelsea.
  Blazer opcional, no requisito.
- **Cita de cena (mantel)**: "a blazer or sport coat is your best friend —
  navy/charcoal blazer + camisa blanca SIN corbata + pantalón oscuro +
  loafers o Chelsea. The open collar keeps things approachable". El punto
  dulce es "elevated casual": se nota el esfuerzo, se siente relajado.
- **Cita de drinks (noche)**: aquí SÍ cabe el traje oscuro — "charcoal or
  midnight navy con camisa oscura, sin corbata, botón superior abierto".
  Es la única ocasión social donde las guías ofrecen el traje como opción
  natural, y siempre sin corbata.
- **Fiesta en casa de un amigo**: el escalón MÁS bajo de todos los
  anteriores. Mezclilla oscura o chino + camisa/polo/punto + tenis limpios o
  Chelsea; el blazer es lo máximo, el traje se lee como venir de otra cosa.
- **La corbata**: en ninguna guía social aparece como default. Pertenece a
  formal (invitación que la pide) y a trabajo formal. "Semiformal hombre =
  saco, sin corbata" es también la definición que la propia app publica.
- **"Ante la duda, sube un nivel"** (VAMANA): existe y es real — PERO su
  contexto son eventos CON código (boda, gala, corporativo). Aplicarla a una
  cena con amigos es exactamente el error que las guías de citas llaman
  "dressing for the wrong context". El motor la aplicaba a todo (fix: v71).

**Cruce con los votos de Roberto (92 looks en cita/cena/fiesta):** traje
completo 46% de aprobación, corbata 25%, blazer suelto 42% (casi siempre
caído por OTRA cosa: capas/calor, mezclilla+saco, polo), sin sastre 85%.
Control: traje en boda/funeral 82%. La práctica y sus votos dicen lo mismo.

## 2. Dónde vive cada pieza del fix

| pieza | dónde | estado |
|---|---|---|
| la escalada "sube medio nivel" respeta el dial | `lib/engine/prompt.ts` (empuje) | **v71, en ronda** |
| semiformal: corbata no-default, traje = techo | `lib/formalidad.ts` (paraElMotor) | **v71, en ronda** |
| carnita por ocasión (esta investigación) | `lib/eventos.ts` (paraElMotor) | v72, borrador abajo |
| dial fiesta de Roberto | su perfil (Perfil→estilo) | lo fija él, tras la ronda |

## 3. Borrador de líneas v72 (`paraElMotor`) — NO escritas al catálogo

La lección de v56 gobierna cada línea: **nunca prohibir sin decir qué SÍ**, y
siempre con la escotilla del código explícito (la excepción que Roberto ha
repetido: "a menos que explícitamente ese fuera el código").

- **fiesta** (hoy: "se está de pie y se baila… permiso para arriesgar"):
  añadir → *"Si es en una casa o un lugar casual, el registro real es
  mezclilla oscura o chino + camisa, polo o punto con carácter; el blazer es
  el techo y el traje completo se lee como venir de otro evento — SALVO que
  el plan diga un código explícito (coctel formal, gala), y entonces el
  código manda."*
- **cena-amigos** (hoy: genérica): añadir → *"Restaurante casual con amigos:
  un escalón arriba del diario, no un evento. Camisa o punto bueno + pantalón
  con intención + calzado de piel; el blazer suma si el lugar lo pide, el
  traje completo no va — nadie se viste de traje para cenar con amigos salvo
  que la cena SEA un evento formal."* (sus palabras del 2026-08-25, casi
  literales).
- **cita** (hoy: "arreglado sin verse disfrazado"): añadir → *"El punto
  dulce es casual elevado: blazer con pantalón de otro juego y cuello
  abierto para cena de mantel; para drinks de noche cabe el traje oscuro SIN
  corbata; para comida o plan de día, camisa o polo de calidad sin saco. La
  corbata en una cita se lee como entrevista."*
- **comida-trabajo** (hoy: "trabajo subido un escalón"): ya apunta bien;
  sólo aterrizar → *"saco con pantalón de otro juego + camisa es el centro;
  el traje completo sólo si el cliente/la mesa lo pide."* (Su brief está a
  44% — el segundo peor — así que medirlo en la ronda de v72.)

**Instrumento de v72**: son líneas de EVENTOS → el vistazo de 6 sólo trae la
cita; fiesta/cena/comida-trabajo se miden en el EVAL (21 briefs). Pre-registro
sugerido: eval absoluto v72 vs el último de v71, con la mirada en los cuatro
briefs tocados.

## Fuentes

- [VAMANA — Guía de dress codes para hombres (México)](https://vamana.mx/blog/dress-codes-hombres-guia)
- [FashionBeans — Men's Cocktail Attire Dress Code](https://www.fashionbeans.com/article/mens-cocktail-attire-dress-code/)
- [Man of Many — Guide to Men's Cocktail Attire](https://manofmany.com/style/guide-mens-cocktail-attire-dress-code)
- [Generation Tux — Casual Cocktail Attire](https://generationtux.com/blog/event-guides/mens-casual-cocktail-attire)
- [He Spoke Style — What To Wear On a First Date](https://hespokestyle.com/first-date-what-to-wear-men/)
- [The Modest Man — First Date Outfits](https://www.themodestman.com/what-to-wear-on-first-date/)
- [Taelor — Common Outfit Mistakes on a First Date](https://taelor.style/blogs/mens-style/common-outfit-mistakes-men-make-on-first-date)
- [Esquire Colombia — Smart Casual guía](https://esquirecolombia.com/look-smart-casual-hombres-guia/)
