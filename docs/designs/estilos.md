# Estilos / looks — spec v2 (Fase 1)

Fuente de verdad para regenerar las imágenes de los swipes de gustos. Cada
estilo tiene un outfit **distinto para hombre y mujer** (no copy-paste), con
**fit + un detalle firma** para que la imagen comunique el estilo y no se
confunda con otro. Los **tags** de cada estilo alimentan el taste vector
(`profiles.taste_tags`) cuando el usuario le da ❤️.

Las imágenes se generan con los **avatares fijos** de Roberto (Fase 2) vistiendo
cada outfit, full-body editorial, fondo papel hueso.

**Regla de cuellos (corrige el "buchón" tipo The Rock):** prohibido cuello mock /
embudo / tortuga grueso. Usar cuello redondo, V, camisa abierta o escote. Cuello
alto solo fino y pegado cuando el estilo lo pida, descrito "fine thin ribbed
turtleneck", nunca "funnel/mock".

**Data model (Fase 3):** `lib/looks.ts` debe reestructurarse a
`{ id, nombre, vibe, tags, outfitHombre, outfitMujer }` por estilo (hoy guarda
un solo outfit).

---

## Refinado / clásico

**1. Minimalista** — _menos es más, todo encaja_ · `minimalista, sobrio, pulido`
- H: camiseta blanca de cuello redondo **entallada**, pantalón negro recto de buena caída, tenis blancos minimalistas de piel. Paleta blanco/negro estricta, sin logos.
- M: top blanco entallado, pantalón sastre negro recto **de talle alto**, mules negros puntiagudos. Una sola línea limpia, accesorios mínimos.

**2. Casual sin esfuerzo** — _fresco y sin pensarlo_ · `casual, fresco, versatil`
- H: camiseta blanca holgada (no oversize), jeans azul medio rectos, tenis blancos, reloj sencillo.
- M: camiseta blanca **fajada al frente**, jeans mom azul claro de talle alto, bailarinas o tenis, bolso cruzado pequeño.

**3. Clásico / elegante** (parisino / old money) — _elegancia que no grita_ · `clasico, elegante, minimalista`
- H: camisa blanca impecable, pantalón de vestir gris de pinzas, blazer marino **entallado**, mocasines café, reloj de piel.
- M: blusa de seda marfil, pantalón sastre camel de talle alto, **gabardina beige sobre los hombros**, slingbacks nude, arracadas finas.

**4. Preppy** — _pulido con aire de campus_ · `preppy, clasico, pulido`
- H: polo, chinos beige, **suéter de punto anudado sobre los hombros**, mocasines o tenis blancos, cinturón de piel.
- M: cárdigan o suéter de punto, falda midi plisada (a cuadros), **camisa de cuello debajo**, bailarinas, bolso estructurado pequeño.

**5. Sastre / tailoring** — _el traje, con tu sello_ · `estructurado, elegante, pulido`
- H: traje marino completo bien entallado, camisa blanca **sin corbata, dos botones abiertos**, mocasines. Moderno, no acartonado.
- M: blazer estructurado + pantalón sastre a juego gris, top liso, tacón o mocasín pulido. **Hombros marcados**, silueta poderosa.

**6. Smart casual** — _de la junta al after_ · `pulido, versatil, moderno`
- H: suéter fino de cuello redondo o camisa, chinos, **blazer desestructurado**, tenis de piel blancos.
- M: blazer + jeans rectos azul oscuro + blusa fluida, botín de tacón o mule. Sastre mezclado con casual.

## Casual / deporte

**7. Streetwear urbano** — _cómodo, con actitud_ · `urbano, atrevido, deportivo`
- H: **hoodie oversize**, pantalón cargo holgado, tenis chunky, gorra. Volumen y capas.
- M: **sudadera oversize**, jeans wide-leg o biker shorts, tenis chunky, gorra + bolso cruzado.

**8. Athleisure** — _deportivo bien hecho_ · `deportivo, casual, fresco`
- H: track jacket o sudadera con cierre, jogger técnico **ajustado al tobillo**, tenis deportivos. Monocromo deportivo limpio.
- M: leggings de talle alto, top deportivo + sudadera abierta, tenis deportivos, **coleta alta**. Pulido, no fachoso.

## Edgy / alternativo

**9. Edgy / rock** — _cuero, negro, cero miedo_ · `edgy, atrevido, urbano`
- H: **chaqueta de piel negra**, camiseta negra, jeans negros ajustados, botas negras. Todo negro sleek y pulido (no grunge).
- M: chaqueta de piel negra, jeans skinny negros o vestido negro corto, **botines de punta afilada con tacón**, choker.

**10. Grunge / alternativo** — _noventas, suelto, sin pose_ · `grunge, relajado, vintage`
- H: **camisa de franela a cuadros abierta** sobre camiseta gráfica, jeans rotos holgados, botas combat. Despeinado 90s.
- M: vestido floral **+ franela amarrada a la cintura** o cárdigan oversize, medias, botas combat. Capas desenfadadas.

**11. Hipster / indie** — _thrift con personalidad_ · `hipster, vintage, creativo`
- H: camisa estampada vintage, chino **enrollado al tobillo**, tenis retro o botas, **gorro beanie + lentes de pasta**.
- M: blusa vintage + jeans mom + cárdigan, botines, **lentes de pasta**, aretes statement.

**12. Utility / workwear** — _funcional, con carácter_ · `utility, urbano, relajado`
- H: **chore jacket o chaqueta militar**, camiseta, pantalón cargo, botas de trabajo. Verde/beige/caqui.
- M: chaqueta utility verde **cinturada**, camiseta blanca, pantalón cargo o jumpsuit, botas o tenis.

## Tratamiento de color

**13. Tonos tierra** — _calidez que te enciende la cara_ · `calido, natural, relajado`
- H: suéter camel de cuello redondo, pantalón café o de pana, botas de gamuza arena.
- M: suéter camel + falda midi café o pantalón beige amplio, botas de gamuza, **bolso café**.

**14. Monocromático** — _un solo tono, todo el impacto_ · `minimalista, sobrio, moderno`
- H: **total gris** — suéter, pantalón y tenis en distintos grises. Limpio y minimal (gris, no negro, para no chocar con edgy).
- M: **total beige/crema** — saco + pantalón o vestido + abrigo en un mismo tono. Columna de color elegante.

**15. Color protagonista** — _que el color hable_ · `colorido, atrevido, creativo`
- H: suéter o camisa en **color fuerte (verde botella o cobalto)** + pantalón neutro, tenis blancos.
- M: vestido o conjunto en **color vibrante (rojo o cobalto)**, o color-block de dos colores, tacón a tono.

## Temáticos

**16. Vintage / retro** — _con historia, sin disfraz_ · `vintage, retro, relajado`
- H: **chamarra de mezclilla retro** o camisa de época, pantalón de pinzas, tenis retro.
- M: vestido midi retro estampado, cárdigan, mocasines o botas, **lentes cat-eye**.

**17. Náutico** — _rayas, azul y brisa_ · `nautico, clasico, fresco`
- H: **camiseta de rayas breton**, pantalón blanco o marino, blazer marino, mocasines.
- M: top de rayas breton, pantalón blanco de talle alto o falda, **blazer marino con botones dorados**, bailarinas o alpargatas.

## Femenino / suave

**18. Romántico** — _delicado y ligero_ · `romantico, suave, fresco`
- M: **vestido floral midi vaporoso**, cárdigan suave, bailarinas, tonos pastel.
- H (suave): camisa de lino clara **abierta en el cuello**, pantalón beige, tonos suaves, sin estructura dura.

**19. Boho** — _suelto, con textura y alma_ · `boho, relajado, romantico`
- M: **vestido largo fluido** o blusa + falda con textura, kimono/chaleco con flecos, botas, **accesorios apilados**.
- H: camisa de lino abierta, pantalón holgado, **collar + capas relajadas**, botas o sandalias de piel.

## Arreglado

**20. Glam / noche** — _para cuando hay que brillar_ · `glam, elegante, atrevido`
- M: **vestido de noche** (slip satinado o cocktail negro), tacón, clutch. Brillo, escote o espalda descubierta.
- H: **esmoquin / black-tie** (traje negro, camisa fina sin corbata), mocasines pulidos. (subido a black-tie para distinguir de Sastre.)
