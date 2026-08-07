# ¿Qué va debajo de un suéter? — research, 2026-08-07

**La pregunta, de Roberto:** *"Al menos para hombre, si hay un suéter, debe de
haber una playera abajo, que puede ser camisa, playera, polo, camiseta… También
sería bueno que hicieras tu research de cuáles son las opciones. Creo que podría
ser una heurística no fácil de identificar cuando se rompe."*

Nació calibrando el eval: marcó 👎 un look de suéter marino sobre piel y escribió
*"esto es recurrente"*. Y lo era — en el veredicto anterior lo había dicho SIETE
veces sobre los dos motores.

## Lo que dice el consenso de menswear

**La base bajo el punto es convención masculina, no capricho.** Tres razones que
se repiten en las fuentes: comodidad (la lana y el cachemir pican a piel),
absorber el sudor y el desodorante, y que el suéter se lave menos —lavar punto lo
desgasta—.

**Qué vale como base:**

| capa | nota de las fuentes |
|---|---|
| camiseta / undershirt | La respuesta por default. **Cuello redondo alto**, para que no asome. Fina y entallada, no una playera gruesa que se marque bajo el punto |
| camisa de cuello | La más versátil; **cuello spread** es el mejor porque cae plano y enmarca la cara al asomar |
| polo | Vale, **pero no el de cuello tenis** bajo un suéter de cuello redondo: ese cuello no imita al de una camisa |
| cuello tortuga | Vale **bajo un suéter de pico**. Es el clásico de invierno |

**Dónde NO aplica la regla:**

- **El cuello tortuga como prenda única.** Es cerrado y se lleva a piel por
  diseño: las fuentes coinciden en que es "suficientemente sustancial" para ir
  con una camiseta fina *o con nada*.

## Y la excepción que Roberto intuyó: las mujeres

Su frase fue *"no sé si para mujer, porque las mujeres son otro boleto"*. **Tenía
razón, y las fuentes son explícitas: para mujer no es una regla.** Llevar el
punto a piel es una elección normal —depende del suéter y la ocasión— y el
camisol es **opcional**: sirve para proteger el cachemir del sudor y para sumar
abrigo, no porque el look esté mal sin él.

Cuando sí se usa, el criterio es que **desaparezca**: entallado, sin encaje ni
canalé, mate, y en un tono cercano a la piel antes que blanco brillante.

## Qué se hizo con esto

`lib/engine/reglas-ejecucion.ts`, regla `sueter-sin-base`:

1. **Solo dispara con `gender === "hombre"`.** Antes no distinguía, así que
   marcaba como error algo correcto en la mitad de los clósets. Es el mismo
   sesgo que ya costó dos correcciones en `alcance.ts` — aquí al revés: la
   convención masculina aplicada a todas.
2. **Sin género declarado tampoco dispara.** En la duda, no inventar el error.
3. **El cuello tortuga entró como base válida** bajo un suéter de pico. Antes
   solo estaba excluido *como suéter*; ahora también cuenta *como base*.

## Fuentes

- [Gentleman's Gazette — Men's Undershirts: Pros & Cons And How To Wear Them](https://www.gentlemansgazette.com/undershirt-guide-to-wear-or-not-to-wear-one/)
- [Robb Report — What to Wear Under a Turtleneck, According to Menswear Experts](https://robbreport.com/style/menswear/what-to-wear-under-a-turtleneck-1234806777/)
- [Wessi — Wearing a Collared Shirt Under a Crew Neck: The Layering Guide](https://www.wessi.com/blogs/male-fashion-advices/wearing-a-collared-shirt-under-a-crew-neck-the-layering-guide)
- [GINGTTO — Do You Wear a Shirt Under a Sweater?](https://www.gingtto.com/blogs/news/do-you-wear-a-shirt-under-a-sweater)
- [Leonisa — What To Wear Under a Sweater](https://www.leonisa.com/blogs/articles/what-to-wear-under-a-sweater)
- [XSUIT — What to Wear Underneath Your Cashmere Sweater and Why](https://xsuit.com/blogs/news/what-to-wear-underneath-your-cashmere-sweater-and-why)
- [YouLookFab — Sweater, next to the skin?](https://youlookfab.com/welookfab/topic/sweater-next-to-the-skin)
