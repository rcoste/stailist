import { hayLluvia, type Weather } from "@/lib/weather";
import { SEASONS, seasonPalette, normSeason, type Season } from "@/lib/colorimetria";
import {
  recetasParaTags,
  bandaDeClima,
  type Receta,
} from "@/lib/engine/recetario";
import {
  coberturaDeReceta,
  bloqueCobertura,
  familiasPorPrenda,
} from "@/lib/engine/cobertura";
import {
  blueprintDelContexto,
  bloqueBlueprint,
  type BlueprintEmparejado,
} from "@/lib/engine/blueprint";
import { calcularRotacion, bloqueRotacion } from "@/lib/engine/rotacion";
import { lineaApetitoAcentos, coberturaDeAcentos, bloqueCoberturaAcentos } from "@/lib/looks";
import { categoriaDeItem } from "@/lib/item-image";
import { OBJECTIVES, type Objective } from "@/app/onboarding/objetivo/objectives";
import { lineaDressCode } from "@/lib/dress-code";
import { lineaFormalidad } from "@/lib/formalidad";
import { lineaTipoEvento } from "@/lib/eventos";
import { registroDe } from "@/lib/registro-plan";
import { reconocerOcasion } from "@/lib/ocasiones";
import { alcanceDeFormalidad, lineaAlcance } from "./alcance";
import {
  type TasteSignal,
  type RememberedOutfit,
  hasTasteSignal,
} from "@/lib/engine/taste-signal";

// Cada outfit guarda la versión del prompt que lo generó (medir si los
// cambios mejoran el ratio de 👍). Súbela cuando cambies el prompt.
// v2 (2026-06-13): reglas de colorimetría (near-face) y de gustos.
// v3 (2026-06-14): paleta no binaria (base + prestados) + lista EVITA dura.
// v4 (2026-06-16): hex de cada prenda + sección de armonía de color/proporción
// en la 1ª pasada, y crítico de styling gender-aware como 2ª pasada.
// v5 (2026-06-16): regla dura marino+negro en formal; ocasión por generación.
// v6 (2026-06-16): se revierte la regla marino+negro (era mito; ver research) —
// marino y negro SÍ combinan, incluso formal. Solo queda como nota de ejecución.
// v7 (2026-06-16): regla anti "traje desparejado" (saco + pantalón del mismo tono
// que no son un traje real) en generador y juez. Justificada por el único 👎 del
// flywheel ("Blanco que ilumina": blazer marino + chinos marino idéntico #27425F).
// v8 (2026-06-16): el juez emite veredicto (ok/reparado/rechazado + razón). En
// rechazo (irreparable con el clóset) el wow descarta el look si quedan ≥2; el
// evento critic_review loggea verdict/razon/rejected — instrumentación para
// decidir si #4b (regenerar) vale. NO regenera todavía (regenerated:0).
// v9 (2026-06-16): el compositor de Hoy pasa un "plan" de texto libre opcional
// ("¿algo en mente?") que entra al contexto para afinar el look a ese plan.
// v10 (2026-06-17): contexto de vida (assessment de cápsula) — el motor sabe en
// qué trabaja, qué hace y cómo le gusta vestir, para aterrizar el look a su vida.
// v11 (2026-06-18): vetos de estilo (issue #2) — la persona declara hard NOs
// (prendas/colores/detalles que jamás quiere). Entran como REGLA DURA; las
// prendas/colores ya vienen pre-filtradas del clóset (applyVetoes), esto cubre
// los detalles y el texto libre. El juez también los rechaza.
// v12 (2026-06-18): momento del día (día/noche) — señal del compositor para
// afinar el look (de noche, más oscuro y arreglado). Se cortó el selector de
// fecha: el clima manual ya abstrae lugar/día, no hace falta calendario.
// v13 (2026-06-22): silueta (complexión + dónde carga volumen). Señal SUAVE:
// orientación para desempatar entre looks parejos y enriquecer el porqué, NO
// filtro ni motivo de rechazo. null si la persona no la definió.
// v14 (2026-06-22): "el toque" — el juez suma un tip de styling OPCIONAL por
// outfit (cómo llevarlo: medio-fajado, arremangar, capa abierta…). Restricción
// como principio: movimientos seguros por default, condicional o null si duda.
// v15 (2026-06-23): el tip SOLO puede hablar de prendas que están en el look;
// prohibido inventar/sugerir prendas ausentes (causaba tips tipo "deja la camisa
// de lino abierta" cuando no había camisa). Aplica a Hoy (critic) y Viaje.
// v16 (2026-06-23): "la app aprende" (paso 9) — el feedback real entra al
// contexto: lo que se PUSO (worn), votó 👍/👎 (con su razón) y de qué pidió otro.
// El motor se inclina hacia lo que le gustó y se aleja de lo que rechazó,
// generalizando el patrón (no copia looks). Lo ve el generador y el juez.
// v17 (2026-06-28): ancla opcional en Hoy — la usuaria fija UNA prenda que quiere
// usar hoy (seedItemId). Entra como REGLA DURA: el look DEBE incluirla, el motor
// arma alrededor y el juez nunca la quita (con red de seguridad en código).
// v40 (2026-08-12): el ancla acepta VARIAS prendas (seedItemIds). La frase del
// caso de UNA quedó intacta a propósito — ver el comentario largo en el bloque
// del ancla: así el camino de hoy no cambia y no hay nada que medir.
// v18 (2026-06-29): formalidad explícita para "evento" (el wizard la pregunta) +
// default mexicano formal en eventos (las bodas mexicanas son más formales que
// el default del modelo; antes sugería looks subvestidos).
// v20: el motor principal (generate) ahora también alimenta el estilo de
// referencia al prompt (antes solo look-of-day lo hacía).
// v21 (2026-07-01): (a) datos ricos por prenda — material, patrón y color
// secundario (del análisis de visión) entran a describeItem + regla de máximo
// un estampado protagonista; (b) campo "analisis" primero en el schema: el
// modelo razona en borrador (paleta, neutros, clima, qué descarta) ANTES de
// comprometer los outfits — mejora combinatoria sin extended thinking.
// v22 (2026-07-01): el estilo de referencia ahora incluye la evaluación honesta
// de fit ("es muy cálido para ti — llévalo a tus tonos") cuando el veredicto es
// ajustes/ojo (styleReferenceForEngine). Antes esa advertencia se mostraba una
// vez en el modal y el motor nunca la veía.
// v23 (2026-07-21): el GENERADOR ahora recibe el género (antes solo el juez lo
// veía): concordancia gramatical en la explicación/tip + criterio de styling
// del género correcto desde la 1ª pasada. Además: reglas de armonía para
// vestido/falda (largo vs calzado, cintura) — el bloque solo tenía reglas de
// sastrería masculina — y rúbrica NEUTRA en el juez cuando no hay género
// (antes caía a la de hombre, la menos exigente).
// v24 (2026-07-21): coherencia de señal de estilo. (a) taste_tags recalibrados
// (√DF en vez de /DF: un ❤️ suelto ya no le gana a la preferencia consistente)
// y anunciados "en orden de fuerza"; (b) el estilo de referencia incluye sus
// tags de visión (se guardaban y se tiraban); (c) vetos + referencia + feedback
// (tasteSignal) cableados a los motores de viaje y cápsula que no los recibían;
// (d) "tu estilo en tus palabras" (profiles.style_words) entra a todos los
// motores como señal directa de la persona.
// v25 (2026-07-22): learnings de la crítica de stylist del deck del swipe,
// llevados al motor: (a) capas con lógica de VIDA REAL — orden natural y
// prohibición de combos que nadie usa (chaleco sastre sobre suéter, saco bajo
// sudadera…), en generador, juez (razón de rechazo "capas") y la capa "extra"
// de viaje; (b) "mano de stylist": una decisión visible por look (capa con
// intención / contraste de textura / color sobre neutros) sin forzar piezas —
// lo simple bien hecho también cuenta. Origen: el deck generado tenía combos
// inexistentes y looks-plantilla que Roberto cachó a ojo; misma falla posible
// en generación.
// v26 (2026-07-24): calibración por el deep research de prior art. (a) EVITA
// near-face degradado de VETO DURO a PREFERENCIA FUERTE (generador + 3 rúbricas
// del juez): el principio cálido/frío tiene base perceptual real (Perrett &
// Sprengelmeyer 2021) pero la etiqueta de "estación" es folclore comercial de
// fiabilidad inter-analista pobre — un color de EVITA cerca de la cara ahora se
// desprefiere, no se prohíbe (los VETOS del usuario siguen absolutos). (b) "camisa
// sobre suéter" acotada: era demasiado amplia y producía falsos negativos — una
// sobrecamisa/overshirt gruesa abierta SÍ es capa exterior válida; solo la camisa
// de vestir fina va debajo del punto.
// v27 (2026-07-26): ropa de baño y de entrenar fuera de los looks de calle. El
// catálogo las tiene sin ninguna marca de contexto y con formalidad "casual", así
// que nada impedía que entraran: peor aún, bikini y traje de baño están como
// categoría "vestido" (el motor los podía tomar como look COMPLETO) y el short de
// baño como "bottom". Se suma regla dura en el generador + caza en el juez. El top
// deportivo tipo bra no se prohíbe: pide una capa encima (así el athleisure en
// color sigue sirviendo). El motor de VIAJE no se toca — tiene su propio prompt y
// ahí la playa sí es una ocasión legítima.
// v28 (2026-08-01): recetario de estilos. Los gustos entraban al prompt como
// tres palabras sueltas ("pulido, clasico, elegante") y NADA decía qué
// significan, así que el modelo improvisaba — el mismo defecto que hacía aguados
// los outfits del primer deck de swipes. Ahora, para los estilos destilados, el
// prompt lleva fórmulas concretas a nivel prenda, los detalles que separan "bien
// puesto" de "aguado", y qué arruina el estilo. Sale de fotos de calle filtradas
// por visión y curadas a mano (ver lib/engine/recetario.ts). Tope de 2 recetas:
// más se contradicen entre sí. Solo hombre por ahora.
// v29 (2026-08-03): recetario v2 — las 10 familias de la taxonomía nueva (616
// fotos curadas), con CLIMA. Las 3 recetas de v28 eran de la taxonomía vieja
// (smart-casual y clásico-elegante ya ni existen: se fusionaron) y no sabían de
// clima, así que la receta empujaba cuello de tortuga igual a 8 que a 28°C.
// Ahora el prompt solo lleva las fórmulas de la banda del día (frío/templado/
// calor), en frío añade cómo abriga el estilo, y lleva la paleta de la familia
// con la colorimetría personal por encima. Ver lib/engine/recetario.ts.
// v30 (2026-08-04): escalera de prioridades. Cada señal decía a quién le ganaba
// ELLA —"su colorimetría manda sobre la paleta del estilo", "sus palabras
// mandan sobre los tags"— pero nadie declaraba el orden completo: eran pares
// sueltos. Donde dos señales chocaban sin par escrito (la receta contra la
// ocasión, la receta contra el feedback) el modelo decidía solo y decidía
// distinto cada vez. Ahora el orden va entero y PRIMERO, en el prompt del
// generador y en el del juez — si solo lo tuviera uno, el juez "repararía"
// decisiones correctas del otro.
// v31 (2026-08-04): piso de formalidad por ocasión. El prompt pedía subir el
// registro con comparativos sin ancla ("un punto más arreglado", "ante la duda
// arréglalo más") — más arreglado ¿que qué? Ahora cada ocasión trae su piso
// concreto: qué tiene que llevar el look como mínimo y qué no puede llevar,
// condicionado al clóset (si no hay saco, pide lo más arreglado que haya y que
// lo diga, en vez de exigir algo que no existe). Honestidad sobre su efecto: el
// barrido NO demostró que mejore — la línea base real era 11%, no el 32% que
// midió una versión rota del arnés, y el cambio movió 2 casos a 1 de 18. Se
// queda por ser correcto de forma, no por evidencia.
// v32 (2026-08-04): el clóset marcado por familia + aviso de cobertura. Origen:
// reconstruyendo los 50 clósets del barrido resultó que en 48 de 50 el motor SÍ
// tenía prendas de la familia a mano — en los casos preppy tenía polo, chino y
// mocasín y armó "camiseta marino + pantalón negro + tenis skate". No le
// faltaban ingredientes: recibía 45 prendas en lista plana y la receta en prosa,
// y tenía que emparejarlas de memoria mientras cuadraba clima, colorimetría y
// ocasión. Ahora el emparejamiento va hecho (es aritmética de vocabulario, no
// criterio) y va también al juez, para que no "repare" quitando justo la prenda
// del estilo. Y para los 2 de 50 que de verdad no tenían con qué, el prompt lo
// dice y pide honestidad en la explicación en vez de bautizar el look con el
// nombre de un estilo que no es (ver lib/engine/cobertura.ts).
// v33 (2026-08-04): el motor ya sabe QUÉ es cada prenda. La categoría (top,
// bottom, saco, calzado…) nunca llegaba al prompt: describeItem mandaba nombre,
// color, formalidad y material, pero no la categoría, así que el modelo la
// deducía del nombre. Y encima 648 de las 967 prendas de la base la tienen
// vacía en sus attrs — las del catálogo la heredan del arquetipo y nadie la
// copiaba. Resultado: a un ítem llamado "Traje marino de lana" (categoría
// `saco`) lo leyó como traje completo y armó el look SIN pantalón, rompiendo su
// propia regla de "un bottom siempre". Lo cazó Roberto viendo el render, donde
// el generador de imágenes había inventado un pantalón gris. Ahora la categoría
// se resuelve al leer (conCategoria) y va pegada al nombre entre corchetes.
// v34 (2026-08-04): fuera las fórmulas en prosa del recetario — el revert
// pre-registrado. El A/B ciego (12 pares, Roberto de juez, lado sorteado) dio
// 5-4-2 a favor de julio: indistinguible del azar, y la regla escrita ANTES de
// correr decía "si no gana, se revierte". Se van las fórmulas, la paleta de
// familia y los vetos en prosa (recetasParaPrompt). Se QUEDAN la marca de
// familia en el clóset y el aviso de cobertura: la marca ganó su propio A/B
// (79%→69% marcados, p≈0.09) y son señales de datos, no prosa — el A/B del
// recetario los apagaba junto con las fórmulas, así que su derrota no los
// condena a ellos. Lectura conjunta de los dos A/B: la prosa estorba, la marca
// ayuda, y juntas se cancelan. Las recetas siguen existiendo como DATOS
// (vocabulario de prendas por familia) para la marca y la cobertura.
// v35 (2026-08-05): estructura de referencia (blueprint). UN look real de calle
// diseccionado —núcleo contra guarnición, la relación de color SIN nombrar
// colores, el detalle que lo hace funcionar y qué lo rompe— con su núcleo YA
// cruzado contra el clóset, así que el modelo elige CUÁL prenda y no de qué
// tipo. Es el trabajo que hasta ahora se le tiraba en vuelo, el mismo fallo que
// se arregló para el recetario en v32 y a las fotos nunca. Solo entra en las
// celdas de (ocasión × clima) con material; sin blueprint armable el motor
// trabaja como siempre. Sembrado por día y clóset para que el juez revise
// contra la MISMA estructura que usó el generador.
// v36 (2026-08-05): rotación del clóset. El mismo historial de 14 días que ya
// se cargaba para no repetir combinaciones, leído POR PRENDA en vez de por
// look: qué descansó y qué se vio mucho. Antes nada le decía al motor que una
// prenda llevaba tres semanas sin salir — solo que no repitiera un conjunto
// entero. Medido sobre el clóset real de Roberto (240 looks): los chinos
// carbón salían en el 30% y 61 de 127 prendas no salían nunca. Entra como
// DESEMPATE, no como cuota: forzar una prenda donde no cabe sale peor que
// repetir. Dos corridas de 12 días: 24→27 y 25→27 prendas distintas, y la más
// repetida baja de 6× a 4-5×.
// v37 (2026-08-05): los neutros no compiten con la paleta. Las paletas de
// estación solo listan colores CON carácter —ninguna incluye un gris medio— y
// el modelo leía esa ausencia como rechazo: en el clóset real de Roberto, sus
// grises, azules suaves y denim claro salieron 0-1 veces en 31 looks (el 20%
// del clóset se llevó el 2% del uso) mientras el vino, con el 4% de las
// prendas, se llevó el 12%. Él lo diagnosticó antes que la medición. Ahora el
// prompt (y las tres rúbricas del juez, que decían lo contrario y lo habrían
// deshecho) dicen que gris, azul suave, denim, blanco hueso, crudo y negro son
// el FONDO: ni favorecen ni apagan. Tres corridas de 12 días: las prendas
// olvidadas pasan de 1.0 a 2.3 de 21; la variedad total no se mueve.
// v38 (2026-08-05): SUBTIPO de prenda — el tipo fino que decide con qué se
// combina: derby contra oxford, saco cruzado contra sencillo, pantalón con o
// sin pinzas. Salió de Roberto calificando el comparador de modelos: "el
// correcto era Derby, pero sólo venía en el nombre, no como una categoría para
// yo decir si está bien o mal". El dato SÍ se leía —los modelos lo escribían en
// el nombre y en la descripción— pero la descripción sólo alimenta al generador
// de imágenes y nunca llegaba hasta acá. O sea que el motor llevaba meses sin
// poder distinguir un oxford negro (que pide traje) de un derby café (que va
// con jeans), aunque los dos se llamen "zapatos de vestir cafés". Va como campo
// propio y no dentro del nombre porque así se puede verificar, corregir y medir.
// Las 953 prendas anteriores no lo tienen: es opcional y su ausencia no cambia
// nada de lo que ya funcionaba.
// v39: el clima, traducido. Hasta v38 el prompt decía la temperatura y nunca
// qué significa vestirse a esa temperatura, y la lluvia viajaba como una
// palabra suelta. Los dos huecos salieron del veredicto de Gemini: 4 de los 6
// defectos de clima cayeron en el brief de lluvia —con los DOS motores
// fallando— y dos looks apilaron lana sobre lana a 18°. Va en el prompt (la
// banda) y en código (lo que se puede comprobar: reglas-ejecucion #6 y #7).
// v40-v43: dress code del trabajo (los cuatro registros de "oficina", con el
// "depende del día" que pregunta si hoy ve cliente), paraguas, y la formalidad
// dicha en ropa en vez de en jerga.
// v49 (2026-08-07): LA CERTEZA DE CADA PRENDA. Roberto: "el motor trata igual
// 'subí la foto de mis jeans' y 'marqué que tengo jeans'". Al medirlo salió algo
// peor que un dato faltante: uno INVENTADO que parece real — al marcar el
// checklist, el alta copia los atributos del arquetipo, así que unos jeans que
// la persona sólo marcó llegaban con "corte: recto" y el motor no podía
// distinguirlo de un dato leído en su foto. Ahora van marcados como
// APROXIMADOS y el prompt dice qué hacer: usar la pieza con confianza, no
// construir el look sobre sus detalles.
// v48 (2026-08-07): dos reglas de clima que faltaban, las dos de la calibración
// de v47 por Roberto. (a) UN BLAZER NO ES UN ABRIGO: la regla del frío se
// conformaba con cualquier pieza de zona "capa" y el blazer lo es, así que un
// saco de lana a 8°C pasaba como si abrigara. (b) LANA EN CALOR: el prompt lo
// pedía desde v4 y aun así salió un pantalón de lana a 29°C soleado — lo que el
// prompt pide y no se cumple, se comprueba.
// v47 (2026-08-07): PRIMERO EL CÓDIGO, DESPUÉS EL JUEZ. La idea es de Roberto:
// "muchas de las cosas que fallaban era nada más ay, te faltó esto. Es como
// decir te faltó ponerte calzones — no es que tengas que cambiarte toda la ropa".
// El reintento de v46 le devolvía el look ENTERO al juez con libertad sobre las
// cinco prendas para arreglar que faltara una camiseta. Ahora lo reparable
// tocando UNA prenda se arregla en código (lib/engine/reparar.ts) y solo lo que
// pide criterio va al juez. Medido sobre las 135 violaciones reales del eval:
// el código solo resuelve 47%, y deja LIMPIOS sin ninguna llamada al 37% de los
// looks que traían algo roto. Las dos violaciones más frecuentes —mocasín en
// frío (31) y suéter sin base (29)— las arregla al 100%.
// v46 (2026-08-07): SE COMPRUEBA LA REPARACIÓN DEL JUEZ. No cambia el texto
// del prompt — cambia que ahora alguien mira el resultado del reparador. Sobre
// las cuatro corridas del eval el juez reparaba el 96% de las violaciones (87
// de 91), así que la premisa de "las ignora" era falsa; lo que nadie veía es
// que INTRODUCE 5 nuevas al arreglar otra cosa. Si tras reparar sigue algo
// roto, se le devuelve la lista exacta y se le da UN intento más, y el segundo
// resultado solo se acepta si de verdad dejó menos roto que el primero.
// v45 (2026-08-07): la mano de stylist deja de ser opcional. La línea decía
// "cuando el clóset lo permita" y remataba con "si el clóset solo da para lo
// simple, lo simple BIEN HECHO es la decisión" — dos puertas de salida en la
// misma frase, así que no decidir nada siempre era defendible. Y el motor las
// usaba: el wow salió 2.98 en el eval, la nota más baja de las seis, con el
// juez escribiendo cosas como "la camiseta blanca, bomber negra y jeans negros
// son el básico más genérico posible; se siente más piloto automático que
// styling".
//
// Ahora cada look debe llevar una decisión NOMBRABLE (el análisis la escribe
// antes de comprometer el outfit) y pasar la prueba del piloto automático:
// ¿alguien que no sabe de moda habría armado esto sin pensar? La guarda de
// siempre se queda y se refuerza — jamás forzar una pieza con tal de tener algo
// que nombrar: una decisión mala es peor que una decisión sobria.
//
// Va aquí y NO en el critic: el paso anterior (v44 + repertorio de gestos)
// atacó el wow desde el juez —la variedad de gestos subió 37%— y el wow no se
// movió. O sea que el cuello de botella no era el gesto sino la elección de
// prendas, que es de este prompt.
//
// v44 (2026-08-07): QUÉ evento es, del catálogo (lib/eventos.ts). "Evento" +
// nivel de formalidad no alcanza: una boda y una graduación son las dos
// "formal" y no se resuelven igual — en la boda hay fotos y protagonistas a
// quienes no hacerles sombra, la graduación es de día y respira más, el funeral
// exige no destacar por encima de cualquier preferencia de estilo. Eso es lo
// que la formalidad NO captura y hasta hoy sólo podía llegar si la persona lo
// escribía a mano en el campo libre. Roberto: "podríamos tener ya opciones —
// una comida, cena, cita, boda— y sobre eso vamos afinando más".
// v50: el motor ve el lazo del conjunto. NO-OP sobre los datos de hoy —cero
// prendas tienen `conjunto`, así que el prompt sale byte a byte igual que v49—
// pero la versión sube igual: es la etiqueta de "con qué prompt se armó este
// look", y sin subirla el primer look CON un traje atado quedaría registrado
// como v49 siendo otro prompt. Esa deriva es justo lo que la versión evita.
// v51: entra "de playa" como código de vestimenta de la boda de destino, y con
// él la primera EXCEPCIÓN a la escalada de formalidad. Para los cuatro niveles
// de la escalera el texto sale byte a byte igual que v50 — la versión sube
// porque el prompt ya no es el mismo para todos los casos.
// v53: la primera regla de ARMONÍA DE COLOR del motor (colores-que-no-se-leen,
// lib/engine/coherencia-cromatica). Hasta hoy este prompt sabía contar
// SATURACIÓN —"máximo 1-2 colores protagonistas; el resto neutros"— pero no
// medir CONTRASTE, y además declara que gris, negro y marino "funcionan
// siempre". Con esa aritmética un look de cinco neutros oscuros sacaba nota
// perfecta: cero colores compitiendo. Salió de un look real ("Carbón bajo
// cero": traje carbón + camisa negra + suéter marino + botín café) y de la
// queja de Roberto, "al usar tantos colores es cuando ya se rompe".
// La versión sube porque el bloque de reglas verificadas que lee el juez ya no
// es el mismo. Como toda regla nueva aquí, va con su variante de ablación en
// el comparador (sin-coherencia-cromatica): si apagarla gana, se revierte.
// v54: "EXACTAMENTE 3 outfits", no "2 o 3". Decisión de Roberto (2026-08-19):
// "si dejamos las cosas tan abiertas, inducimos a que el modelo tirite" — y
// medido en la ronda 283d8d44 tenía razón: el reparto fue 3,3,3,2,3,3,2,3,3,
// 2,2,3. El modelo titubeaba. El piso de 2 del pipeline se queda como red
// (el modelo puede desobedecer), pero pedirlo ambiguo era invitarlo a entregar
// menos. Los 3 se muestran (o se mostrarán: hoy el flujo diario genera 1 — la
// prioridad G del plan es llevarle los 3).
// v56: el registro de la cita (lib/eventos.ts, "cita"). El motor entregó tres
// trajes completos para "una cita en un restaurante" y Roberto marcó el mismo
// desajuste tres veces: la cita pide coctel relajado (saco con pantalón de
// otro juego), no traje entero — salvo que el estilo de la persona sea de
// sastre o el plan lo pida. La versión sube porque lineaTipoEvento viaja
// dentro de este prompt.
// v55: dos reglas nuevas, las dos nacidas del cruce voto-contra-juez del
// 2026-08-19 y confirmadas por Roberto calificando hallazgos: el reloj
// deportivo no va con sastre ("100% rompe con el look"; con SU excepción — en
// diario el smart watch pasa) y la corbata de punto no va a ceremonia ("Sí, no
// va la corbata de punto"). Nacen CON reparación en código — las anteriores se
// escribieron sin ella y el motor entregaba roto lo que sabía roto.
// v57 (2026-08-19, REVERSIÓN): el texto que ve el generador vuelve al de v53.
// Roberto votó las tres rondas del día con el mismo clóset y los mismos 6
// briefs: v53 91% de looks aprobados → v55 72% → v56 52%. Nueve versiones en
// 48 horas, cada una medida por su termómetro local (reparto de 3, disparos de
// regla, trajes en cita) y NINGUNA contra la aprobación de la anterior. Se
// retiran los dos cambios de prompt: v54 ("EXACTAMENTE 3" — forzar el tercero
// mete relleno) y v56 (la línea de cita: decirle "no traje" sin decirle qué SÍ
// va con un blazer produjo mezclilla+blazer, "culerísimo"). Las reglas de
// código de v55 se quedan: no tocan el prompt, sólo reparan lo detectado, y se
// validaron sin falsos. Desde aquí, ningún cambio del motor sale sin ronda
// "nuevo vs anterior" con aprobación igual o mayor.
// v58 (2026-08-22): el texto del generador NO cambia (sigue siendo el de v53).
// Sube porque el bloque de reglas verificadas que lee el juez ya no es el
// mismo: entran `negro-con-beige` (3 👎 / 0 👍 en la ablación contra los votos)
// y `mezclilla-con-saco` (2 👎 / 0 👍), y el reparador aprende
// `blazer-no-es-abrigo`. Primera versión que sale por el proceso completo:
// ablación → ronda "prompt-anterior" (v57 congelado) → voto de Roberto.
// v59 (2026-08-22): se RETIRA `colores-que-no-se-leen` (la regla de armonía de
// color de v53) del bloque de reglas verificadas. Cinco rondas con su ablación
// y nunca se ganó el lugar; en la quinta, el lado sin ella aprobó más (79% vs
// 64%). Pre-registrado en v53: "si apagarla gana, se revierte". El texto del
// generador sigue siendo el de v53; sube la versión porque lo que lee el juez
// cambió.
// v60 (2026-08-24): entra EL DIAL DE REGISTRO POR PLAN (lib/registro-plan.ts) — la
// capa 2 de las tres capas. Si la persona movió el dial de un plan, la línea
// del evento lleva su registro ("va un paso más relajado/arreglado que la
// norma… manda sobre la norma"), y la MISMA línea la leen las rúbricas y los
// jueces (lineaTipoEvento es el punto de palanca). Sin dial movido, el texto
// es IDÉNTICO a v59. A diferencia de v56, la línea dice hacia dónde Y qué sí
// (blazer/separates o traje bienvenido), no sólo qué no.
// v61 (2026-08-24): cuatro reglas nuevas, TODAS nacidas de comentarios de
// Roberto con ≥3 menciones (dos con ≥5) en las rondas 075a3f12 y 08f46d3e, y
// todas con reparador: boda-de-noche-camisa-blanca, camisa-de-vestir-bajo-
// overshirt, calzado-cafe-con-traje-negro, charol-solo-etiqueta. El texto del
// generador no cambia; sube porque el bloque que lee el juez cambió. Medidas
// con ablación contra los looks votados antes de salir, y con ronda
// prompt-anterior (v60 congelado) antes de main.
// v62 (2026-08-24): dos reglas ya medidas que estaban MUDAS a medias, arregladas.
// full-lino-en-oficina no reconocía "pantalón de lino" (el fallback por nombre
// lo clasificaba "liso" antes de buscar el lino), y saco-de-traje-suelto /
// traje-desparejado detectaban sin reparar — ahora, si el saco trae su lazo
// `conjunto`, recupera SU pantalón (determinista, no criterio). Texto del
// generador sin cambios; v61 congelado.
// v63 (2026-08-24): boda-de-noche-sin-corbata, por DECRETO de Roberto tras
// tres menciones ("las bodas de noche deben de ser de corbata… eso debe de
// ser") — con sus excepciones: coctel explícito la relaja; etiqueta rigurosa
// pide moño. Entra sin ronda propia por orden suya, con ablación limpia
// (2 👎 / 0 👍); el siguiente vistazo la vigila. v62 congelado antes.
// v64 (2026-08-24): lluvia-sin-impermeable ESTRECHADA. Marcaba 5 👎 / 6 👍 y
// en los cinco 👎 la queja era otra cosa. Ahora dispara sólo cuando la capa
// exterior EMPAPA (lana/punto/ante); la chamarra casual con cierre pasa, y
// salir sin capa con llovizna templada es elección, no error.
// v65 (2026-08-24): oxford-en-registro-formal — la camisa de cuello abotonado
// es casual; con cliente, en comida de trabajo o en formal va camisa de vestir
// lisa. Dos menciones de Roberto en el eval 919c2f53, cero contradicciones en
// su historial, y el consenso de sastrería. Con reparador. El próximo vistazo
// la vigila. v64 congelado antes.
// v66 (2026-08-24): "LA PIEZA primero" — ataque a ESTILO (3.13 en el eval
// 919c2f53). El diagnóstico en números: 14 de 45 looks salieron sin NINGUNA
// prenda con carácter (estilo 3.29) contra 3.81 con exactamente una y 3.45
// con dos; calzado negro en 62% de los looks; 59 de 130 prendas jamás usadas.
// La instrucción de "decisión visible" (v45) ya existía y no bastó — la
// lección escrita arriba: el cuello de botella es la ELECCIÓN de prendas, no
// el gesto. Ahora el análisis elige LA PIEZA de cada look ANTES que los
// neutros (qué SÍ, la lección de v56), exactamente una (el dato de dos
// compitiendo), con la sobriedad del funeral como excepción nombrada.
// Pre-registrado: entra solo si la aprobación de Roberto ≥ control en ronda
// prompt-anterior (v65 congelado). v65 congelado antes de subir.
// GANÓ la ronda 8130c381 (93% vs 71%, pares 2-1-3) — en main. Ojo: el
// mecanismo (más piezas con carácter) NO quedó probado en esa ronda; lo mide
// el próximo eval absoluto.
// v67 (2026-08-24): dos reglas de código con 2 menciones de Roberto cada una,
// en rondas distintas (su guardrail de ≥2): chelsea-en-calor (7abd9c9c +
// 8130c381 — "la Chelsea no va tan bien para algo tan caluroso"; con
// reparador, calla con lluvia donde la bota es lo correcto) y el tip del saco
// cruzado (075a3f12 "investiga cómo se usa" + 8130c381 "lo que luce es que
// esté cruzado, no que se vea abierto" — el cruzado va abotonado también de
// pie; el tip lo escribe el juez, así que el arreglo vive en critic.ts). El
// texto del generador no cambia; sube porque REGLAS_DE_LA_CASA (el bloque que
// leen los jueces) cambió. Ablación sin-reglas-v67; v66 congelado antes.
// v68 (2026-08-24): el POLO y el FUNERAL, las dos de sus votos y con la
// ablación corrigiendo su propio dictado en el segundo caso.
// (a) `polo-con-traje-completo` (6 👎 / 0 👍 sobre 382 looks votados): siete
// comentarios suyos en cinco rondas, perdidos seis veces porque cada uno se
// archivó por su contexto y ninguno por su prenda. Acotada al TRAJE completo:
// con blazer y pantalón de otro juego el polo da 3/1 y él lo confirmó —"si
// acaso con blazer podría funcionar; con traje no hay manera".
// (b) `funeral-camisa-blanca` (2 👎 / 0 👍 en lo solemne; 11 👍 fuera de ahí,
// así que va acotada) + el uniforme del luto en el catálogo de eventos, CON
// permiso explícito de repetirlo: "que alguien lleve el mismo outfit a dos
// funerales no pasa nada" — el motor entregaba un alterno que rompía el
// código sólo por dar variedad. Lo que NO entró, y es el punto: pidió que el
// traje fuera obligatoriamente negro, pero sus votos aprobaron 2 de 2 con
// gris carbón. El ideal vive en el catálogo como preferencia; la regla dura
// es sólo lo que sus votos condenan.
// Ablación sin-reglas-v68. El texto del funeral es local a ese evento (ningún
// brief del vistazo lo toca): su vigilancia es el próximo eval.
// v69 (2026-08-25): EL APETITO DE ACENTOS llega al motor y a los jueces —
// cuánto color quiere llevar la persona (docs/designs/acentos-y-colorimetria-
// por-zona.md), la dimensión que faltaba junto a la colorimetría (QUÉ colores)
// y el arquetipo (qué vibe). Nació de Roberto viendo un suéter cobalto:
// "probablemente no me lo hubiera puesto; hubiera usado marino".
//
// SÓLO VIAJA SI LA PERSONA LO ELIGIÓ en la card de Perfil→estilo
// (acento_apetito_fuente = 'elegido'). La semilla derivada de los swipes NO
// entra — él mismo la degradó ("estás asumiendo algo muy importante a partir
// de las imágenes") — así que hoy, con 24 perfiles en semilla y ninguno
// elegido, el prompt sale byte a byte idéntico a v68 y no hay regresión
// posible. Verificado contra su perfil real, no sólo con tests.
// Misma estructura que el dial de registro (v60): sin dato, texto igual; con
// dato, la línea dice hacia dónde Y qué SÍ hacer — incluido el caso de
// carencia (sin pieza chica de color, un look tonal es la respuesta correcta,
// no un suéter de color forzado). La MISMA línea la leen el generador y las
// rúbricas: si el juez calificara sin ella, castigaría por soso un look que
// la persona pidió discreto.
// v70 (2026-08-25): DISCRETO deja de significar "sin color". Medido en el
// experimento de acentos (cruce-acentos.ts, control 2ec16c63 vs tratamiento
// cead58b5): la línea funcionó —acento en pieza grande 36%→16%— pero los
// looks tonales subieron 14 puntos, y NO por falta de vehículo: en los mismos
// 51 looks el mocasín burdeos salió 10 veces, la corbata 3 y la bufanda 2.
// El modelo tomaba el permiso de ir tonal aunque tuviera con qué. La foto que
// la persona elige en la pantalla LLEVA su guiño, así que el tonal pasa a ser
// el fallback explícito y no el default.
// v71 (2026-08-25): LA FORMALIDAD DEJA DE PELEAR CON EL DIAL, y semiformal
// deja de contradecir su propia pantalla. Dos ediciones, un solo cambio: (1)
// el empuje "sube medio nivel, NUNCA lo bajes" —escrito para bodas— se
// invierte cuando el dial del plan va relajado (la formalidad pasa de meta a
// techo); (2) semiformal (lib/formalidad.ts) ya no dice "corbata opcional"
// mientras la pantalla promete "saco, sin corbata" — corbata sólo si el plan
// la pide, y el traje completo es el techo del código, no su punto medio.
// La evidencia: 92 looks votados en cita/cena/fiesta — traje completo 46%,
// corbata 25%, sin sastre 85%; control traje en boda/funeral 82%. Roberto,
// 6+ menciones en rondas distintas: "overdressed… jamás me pondría algo así
// a menos que explícitamente ese fuera el código". Y dos de sus 👎 de la
// báscula fría citaban la contradicción pantalla/motor, no el outfit.
// v72 (2026-08-25): LA CARNITA POR OCASIÓN — el catálogo de eventos deja de
// ser genérico en los cuatro planes sociales (lib/eventos.ts: fiesta,
// cena-amigos, cita, comida-trabajo). El precedente del método es el funeral:
// la única línea investigada del catálogo era la única 5/5. Las nuevas salen
// de docs/registro-por-ocasion.md (práctica real + 92 votos de Roberto) y
// respetan la lección de v56: cada una dice qué SÍ, con la escotilla del
// código explícito. El texto viaja por lineaTipoEvento a generador y jueces.
export const PROMPT_VERSION = "v72";

export type EngineItem = {
  id: string;
  /**
   * Cuánto sabemos de VERDAD sobre esta prenda (ver migración 0124).
   *
   * "asumida" es el caso que importa y el que estaba escondido: al marcar el
   * checklist de básicos, el alta COPIA los atributos del arquetipo del
   * catálogo. Unos "Jeans negros" que la persona sólo marcó llegan aquí con
   * `corte: recto` — un dato que nadie confirmó y que el motor no podía
   * distinguir de uno leído en su foto.
   */
  certeza?: "exacta" | "generica" | "asumida" | null;
  attrs: {
    nombre?: string;
    /**
     * top | bottom | calzado | abrigo | saco | vestido | accesorio.
     *
     * La resuelve categoriaDeItem (lib/item-image.ts): las prendas del catálogo
     * la heredan del arquetipo y no la traen en sus propios attrs. Va al prompt
     * — sin ella el modelo la deducía del NOMBRE, y con un ítem llamado "Traje
     * marino de lana" que en realidad es un saco, armaba el look sin pantalón.
     */
    categoria?: string;
    color?: string;
    color_hex?: string;
    image_path?: string | null;
    formalidad?: string;
    temporada?: string;
    tipo?: string;
    /** Qué atributos confirmó la persona a mano (ver migración 0125). */
    confirmados?: string[];
    /**
     * Las dos piezas de un TRAJE, atadas: mismo id en el saco y en el pantalón.
     *
     * Un traje se guarda como dos prendas —decisión vieja y correcta: guardarlo
     * como una sola hacía que el motor armara looks SIN pantalón—, pero nada
     * decía que ESAS dos van juntas. Y la regla `traje-desparejado` castiga
     * justo eso: saco y pantalón de vestir del mismo color. O sea que subir un
     * traje de verdad creaba, sin querer, el par que el motor tiene prohibido
     * juntar. Con el conjunto puesto, la regla los deja pasar.
     *
     * LO PONE LA PERSONA, NO EL CÓDIGO. Un blazer con un pantalón del mismo
     * tono que NO son traje es exactamente el error que la regla existe para
     * cazar: atarlos solos apagaría la regla en el único caso que importa.
     */
    conjunto?: string;
    largo?: string; // crop/regular/largo — habilita tips de fajar
    corte?: string; // entallado/recto/holgado — habilita tips de proporción
    manga?: string; // sin/corta/larga — habilita tips de arremangar
    /**
     * El tipo FINO: derby/oxford/mocasín, cruzado/sencillo, con pinzas.
     *
     * Distingue prendas que se llaman igual y NO se combinan igual: un oxford
     * negro pide traje, un derby café va con jeans, y los dos son "zapatos de
     * vestir cafés". El dato ya se leía —dentro del nombre y de la descripción—
     * pero la descripción sólo alimenta al generador de imágenes y nunca llegaba
     * al motor. Opcional: las 953 prendas guardadas antes de esto no lo tienen.
     */
    subtipo?: string;
    /**
     * ¿La caña llega al tobillo? (bota, botín, Chelsea = sí).
     *
     * Lo lee la visión (scripts/leer-suela.ts) y hoy sólo lo usa la regla de
     * lluvia. Es el mecanismo físico que describió Roberto — el agua entra por
     * ARRIBA, no por el material — y por eso reemplaza a la lista fija de tres
     * formas que había a mano. Opcional: sin el dato la regla no dispara, que
     * es el default correcto.
     */
    cubre_tobillo?: boolean;
    material?: string; // tela aparente ("lana", "lino"…) — clima y combinación
    patron?: string; // liso/rayas/cuadros/… — evita dos estampados que pelean
    color_secundario?: string; // segundo color si es bicolor/estampada
  };
};

export type EngineContext = {
  gender: "hombre" | "mujer" | null; // concordancia gramatical + criterio de styling
  objective: string | null;
  plan: string | null; // texto libre opcional del compositor ("¿algo en mente?")
  /**
   * QUÉ evento es, del catálogo (lib/eventos.ts). Distinto de la formalidad:
   * ésta dice cuánto te arreglas, y el tipo dice lo que la formalidad NO
   * captura — dónde te sientas, cuánto caminas, si hay fotos, qué se ve mal
   * ahí. Una boda y una graduación son las dos "formal" y no se resuelven
   * igual.
   */
  tipoEvento?: string | null;
  lifestyle: string | null; // resumen de vida del assessment de cápsula
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  flow: Season | null;
  items: EngineItem[];
  weather: Weather | null;
  /** Va a llevar paraguas (solo se pregunta cuando dice que llueve). */
  paraguas?: boolean;
  /** Su código de vestimenta del trabajo. null = todavía no se le pregunta. */
  workDressCode?: string | null;
  /** Solo si su código es "variable": si HOY ve cliente. Es dato del día. */
  veCliente?: boolean | null;
  recentCombos: string[][]; // item_ids de outfits de los últimos 14 días
  vetoes: string[]; // hard NOs (issue #2): jamás incluir ni sugerir
  timeOfDay: "dia" | "noche" | null; // momento del look (afina día/noche)
  silueta: string | null; // orientación de cuerpo (complexión + dónde carga); señal suave
  /**
   * Cómo le gusta que le quede la ropa, medida con los pares de fotos del
   * onboarding. Distinto de `silueta`, que describe su CUERPO.
   * 'mixta' = contestó y no tiene preferencia fuerte. null = no se le preguntó.
   */
  fitPref?: "recta" | "holgada" | "mixta" | null;
  ageStyling?: string | null; // orientación por edad (life-stage); señal suave, solo extremos
  tasteSignal: TasteSignal; // "la app aprende" (paso 9): feedback real (worn/votos/skip)
  seedItemIds?: string[]; // anclas (Hoy): prendas que la usuaria fijó — DEBEN ir en el look
  formality?: string | null; // solo en "evento". Los valores viven en Formalidad (lib/formalidad.ts) —
  // NO se re-enumeran aquí: esta lista ya se quedó corta cuando entró "playa".
  styleReference?: string | null; // resumen del "estilo de referencia" (vibe/silueta, NO color)
  styleWords?: string | null; // su estilo EN SUS PALABRAS (texto libre del perfil)
  /** El dial de registro por plan (lib/registro-plan.ts): default consenso; la
   *  persona mueve un paso. Viaja dentro de lineaTipoEvento. */
  registroPorPlan?: import("@/lib/registro-plan").RegistroPorPlan | null;
  /** Cuánto color quiere llevar (lib/looks.ts). SÓLO llega si la persona lo
   *  ELIGIÓ en la card de acentos: la semilla derivada de los swipes no viaja
   *  —mide afinidad estética, no volumen de color— y con ella el prompt sale
   *  byte a byte igual que antes. */
  acentoApetito?: import("@/lib/looks").ApetitoAcentos | null;
};

// PRENDAS QUE DE VERDAD EXISTEN — regla compartida por los DOS motores que
// inventan prendas ideales libres del catálogo: la cápsula del clóset
// (capsule-target) y la maleta del viaje (trip-capsule). Vive aquí, en una sola
// constante, porque escrita a mano en cada prompt se desincroniza.
//
// El motor le propuso a Roberto una "Playera de lino esmeralda" (tipo
// "playera-lino"): el lino es fibra rígida y sin elasticidad, no se teje en
// punto, así que esa prenda no existe como producto. Un clóset cápsula es una
// lista de compras — pedir algo que no se vende la vuelve inservible.
export const REGLA_PRENDAS_REALES = `PRENDAS QUE DE VERDAD EXISTEN (regla dura): cada pieza tiene que ser un PRODUCTO que la persona pueda ir a comprar tal cual. Antes de escribir un nombre, pregúntate si esa prenda existe en una tienda normal; si dudas, usa la versión canónica de esa tela o de esa prenda. NO inventes combinaciones tela+prenda que no se hacen: el lino no se teje en punto (hay camisa, pantalón, short y saco de lino — NO playeras, camisetas ni suéteres de lino), y una prenda cuyo nombre YA implica su tela no admite otra (unos jeans son de mezclilla; un traje de baño no es de lana). Prefiere siempre el nombre con el que esa prenda se vende de verdad.`;

/**
 * El orden en que mandan las señales cuando chocan.
 *
 * POR QUÉ HACE FALTA
 * Cada señal del prompt decía a quién le gana ELLA —"su colorimetría manda
 * sobre la paleta del estilo", "sus palabras mandan sobre los tags"— pero
 * nadie declaraba el orden completo. Eran pares sueltos, no una escalera: donde
 * dos señales chocaban y su par no estaba escrito (la receta contra la ocasión,
 * la receta contra el feedback aprendido), el modelo decidía solo y decidía
 * distinto cada vez.
 *
 * Se vio en un look real: receta preppy + ocasión de coctel + colorimetría de
 * invierno produjeron un marino formal que no era ni preppy ni un traje de
 * verdad. Cada señal jaló para su lado y el resultado no fue de nadie.
 *
 * Va PRIMERO en el prompt, antes que cualquier regla concreta, porque es el
 * marco con el que se leen todas las demás.
 */
export const ESCALERA_DE_PRIORIDADES = `ORDEN DE MANDO (cuando dos señales se contradigan, gana la de arriba):
1. REGLAS DURAS — vetos, género, edad y la prenda ancla del día. No se rompen nunca, por ningún motivo.
2. CLIMA Y OCASIÓN — la física del día. Un look correcto para el que se muere de frío o va mal vestido al evento ya falló.
3. COLORIMETRÍA — qué color va cerca de su cara. Manda sobre la paleta del estilo y sobre cualquier referencia.
4. SUS PALABRAS — lo que ella misma escribió de su estilo. Es la señal más directa de quién es.
5. RECETA DEL ESTILO — cómo se lleva su familia: silueta, combinaciones, lo que la arruina. Manda sobre el resto salvo lo de arriba.
6. CÓMO LE GUSTA QUE LE QUEDE — recto u holgado, cuando la receta admita las dos.
7. LO QUE HA VOTADO — inclínate hacia lo que le gustó, pero es tendencia, no regla.
8. SU CUERPO — solo para desempatar entre looks parejos. Jamás motivo para descartar uno.

Cómo usarlo: NO es permiso para ignorar lo de abajo. Casi siempre todo cabe junto. La escalera solo decide cuando de verdad se contradicen, y en ese caso cedes lo de abajo, no lo de arriba. Si cediste algo del 4 al 8, compénsalo con el resto del look en vez de dejarlo a medias.`;

export const SYSTEM_PROMPT = `Eres la stylist personal de stailist: la amiga cool que se viste increíble y le arma looks a su gente con CARIÑO y ojo de experta.

${ESCALERA_DE_PRIORIDADES}

Cómo trabajas: PRIMERO llena el campo "analisis" — tu borrador de trabajo, la clienta no lo ve. Ahí piensa en corto: qué neutros y qué colores fuertes hay en su clóset, qué mandan el clima y la ocasión, y qué queda descartado (colorimetría, vetos, estampados que pelean). Luego, para CADA outfit que planees, elige PRIMERO su pieza con carácter — un color de su paleta que no sea neutro cerca de la cara, una textura que se nota (gamuza, punto, piel), un estampado, o el accesorio que remata — dentro de lo que el clima y la ocasión permiten, y nómbrala en el análisis. Los neutros se eligen DESPUÉS, alrededor de esa pieza. Exactamente UNA pieza con carácter por look: dos compiten entre sí y el look pierde el filo. Si la ocasión pide sobriedad total (un funeral, un luto), la pieza es el corte y el tono exactos — y también se nombra. DESPUÉS arma los outfits a partir de ese análisis, no antes.

Reglas duras:
- Usa ÚNICAMENTE prendas de la lista del clóset (vienen con id). Jamás menciones prendas que no estén ahí.
- Cada outfit lleva 3 a 5 prendas y debe tener lógica: un top (o vestido), un bottom (salvo con vestido), calzado siempre; un saco/blazer va SOBRE el top cuando la ocasión es formal o de evento (no depende del clima); un abrigo solo si el clima lo pide.
- Devuelve 2 o 3 outfits DISTINTOS entre sí.
- Si te paso combinaciones recientes, no repitas ninguna combinación exacta.
- Ropa de baño y de entrenar NO es ropa de calle, y aquí no hay ocasión de playa ni de gym: un traje de baño o bikini jamás es un look (aunque el catálogo los liste como "vestido") y un short de baño no sustituye un short normal — déjalos fuera. Un top deportivo tipo bra (crop de entrenar, sin manga) no va como ÚNICO top: úsalo solo con una capa encima que lo vuelva look de calle (sudadera, camisa o chamarra abierta).

Colorimetría (regla near-face — IMPORTANTE):
- Lo que toca la cara manda: idealmente el top y el abrigo están en su paleta (sus mejores o sus prestados) o son un neutro que la favorezca. Ahí es donde el color le ilumina o le apaga la cara. El principio cálido/frío es real; la etiqueta de "estación" es orientación, no ley.
- PREFERENCIA FUERTE (no veto): evita cerca de la cara (top o abrigo) los colores de su lista de EVITA — tienden a apagarla. Pero si su clóset no da una mejor opción near-face, úsalo igual antes que romper el look o dejarlo incompleto: es una preferencia probabilística, no una prohibición. (Los VETOS del contexto, en cambio, SÍ son absolutos.) En bottom o calzado los EVITA no importan nunca.
- El bottom y el calzado tienen más libertad: no necesitan estar en su paleta.
- Si su clóset no tiene un top en su paleta, elige el neutro más favorecedor y compénsalo: arma el resto del look alrededor de sus colores.

Armonía del outfit (cómo combinan las prendas entre sí):
- Ancla en neutros: máximo 1-2 colores protagonistas por look; el resto neutros (negro, blanco, gris, beige, marino, camel). Tres saturados juntos casi nunca funcionan.
- Usa los hex para juzgar el color real: si hay un color fuerte, acompáñalo de neutros; evita dos saturados que compitan o tonos que se enloden juntos.
- Estampados: máximo UN estampado protagonista por look (rayas, cuadros, floral, gráfico…); el resto liso. Dos estampados juntos casi nunca — solo si uno es muy sutil y no compiten.
- DETALLES APROXIMADOS: una prenda marcada "detalles APROXIMADOS" es un básico que la persona dijo tener pero nunca describió — el corte, el largo y la manga vienen del catálogo, no de SU prenda. Úsala con confianza como PIEZA (sí tiene unos jeans), pero NO construyas el look sobre esos detalles: no bases un juego de proporción en que sean rectos, ni un tip en un largo que quizá no es. Si el look depende de ese detalle para funcionar, prefiere una prenda que sí esté confirmada.
- Materiales: si la prenda trae material, úsalo — nada de lana o tejidos pesados en calor, ni lino fresco en frío; y que los pesos de tela de un mismo look se hablen (no mezcles piezas de invierno con piezas de verano).
- Proporción: equilibra el volumen — si arriba es holgado/oversize, abajo algo más entallado (y al revés). Evita "todo holgado" o "todo pegado".
- Capas con lógica de vida real: cada capa en su orden natural — camisa o playera debajo, suéter/knit encima, saco/blazer/abrigo al final. JAMÁS combos que nadie usa en la calle: chaleco sastre sobre suéter, saco debajo de una sudadera, dos abrigos juntos. Matiz de la camisa: una camisa de vestir fina va DEBAJO del punto, no encima; PERO una sobrecamisa/overshirt gruesa abierta SÍ vale como capa exterior sobre un suéter ligero — no la trates como error. La prueba: si no te imaginas a una persona real saliendo así a la calle, no lo armes.
- Que se note la mano de stylist. CADA look lleva UNA decisión visible — normalmente la pieza con carácter que elegiste primero en el análisis — y tienes que poder nombrarla: un contraste de textura (punto + piel, lana + mezclilla, tejido + satén), un color que remata sobre base neutra, una capa que cambia la silueta, o una proporción deliberada (volumen arriba contra línea limpia abajo).
- LA PRUEBA DEL PILOTO AUTOMÁTICO, aplícala a cada look antes de entregarlo: ¿alguien que NO sabe de moda habría armado exactamente esto abriendo su clóset sin pensar? Si la respuesta es sí, no hay decisión — todavía no es un look de stylist, es ropa que no choca. Camiseta blanca + chamarra negra + jeans negros es el ejemplo exacto de lo que NO pasa esta prueba. Cámbiale una pieza por otra del clóset que sí meta una decisión, o cambia la combinación entera.
- Y la guarda, que sigue mandando: JAMÁS fuerces una pieza solo para "vestir" el look, ni metas un color o una textura que pelee con el clima, la ocasión o su colorimetría con tal de tener algo que nombrar. Si de verdad este clóset solo da para lo simple en este día, entrega lo simple — pero entonces la decisión es el fit y el color exacto, y también hay que nombrarla. Una decisión mala es peor que una decisión sobria.
- Vestido o falda en el look: cuida el largo contra el calzado (un midi pide calzado que estilice — algo de altura o silueta limpia; largo + calzado muy plano acortan la figura) y define la cintura cuando ayude (cinturón, top entallado o fajado).
- Coherencia: no mezcles formalidades opuestas (sastre formal con deportivo) salvo que su vibe lo pida a propósito.
- Marino + negro SÍ combinan (dos fríos que contrastan sin chocar), incluso en formal — un traje marino con zapatos o cinturón negros es clásico. Solo cuida que se vea intencional (mismo peso de tela, calzado oscuro), no como traje desparejado.
- Cuidado con el "traje desparejado": un saco/blazer junto a un pantalón del MISMO color y tono (marino con marino, gris con gris, negro con negro) parece un traje que no combina entre sí — el ojo espera que sean un conjunto y nota que no lo son. Solo úsalos juntos si DE VERDAD son un traje (misma tela). Si no, rompe el match: pon el bottom en otro neutro (gris, beige, caqui, denim) para que el saco se lea como pieza intencional, no como mitad de un traje suelto.

Gustos (su vibe, de los swipes):
- Cuando haya varias combinaciones válidas, ELIGE la que más empate con su vibe (ej. si es minimalista, evita mezclar demasiados elementos; si es clásico, prioriza siluetas atemporales).
- El vibe define el balance y la actitud del look, no qué prenda es válida.

La explicación (una línea por outfit):
- Voz cálida, directa, de tuteo. Cero jerga técnica de moda.
- Di POR QUÉ le favorece, idealmente conectando con sus colores ("el azul te ilumina la cara") o su plan del día.
- Ejemplos del tono: "los tonos tierra te encienden la cara", "cómodo pero con intención — nadie sabrá que te tomó 2 minutos".
- PROHIBIDO: "estación otoño profundo", "paleta cromática", "silueta versátil" y cualquier frase de revista técnica.`;

/**
 * El PISO de formalidad de la ocasión: qué tiene que traer el look como mínimo
 * y qué no puede traer.
 *
 * POR QUÉ HACE FALTA
 * El prompt pedía subir el registro con comparativos sin ancla: "un punto más
 * arreglado", "ante la duda arréglalo más, no menos". Más arreglado ¿que qué?
 * El modelo sabía que la ocasión importaba y no sabía qué exigir.
 *
 * Se midió en un barrido de 129 looks: para "evento de noche" fallaba el 32% —
 * uno de cada tres— y con el clóset COMPLETO (con blazer, saco, pantalón de
 * vestir y mocasines a la mano) todavía el 22%. Salían suéter con chinos y
 * botines, o polo con tenis, para una cena. En "diario" el fallo era 0%: el
 * problema no era el motor en general, era la ocasión sin traducir.
 *
 * CONDICIONADO AL CLÓSET A PROPÓSITO
 * No exige una prenda que la persona no tiene: pide la MÁS arreglada que haya y
 * que lo diga. Un piso absoluto contra un clóset pobre produce lo peor de los
 * dos mundos — el motor no puede cumplirlo, y al intentarlo saca un look peor
 * que el que habría armado con lo disponible.
 */
/**
 * Qué se pone alguien a esa temperatura, en las MISMAS bandas que la app le
 * enseña a la usuaria al pedirle el clima (components/weather-picker.tsx). Que
 * el motor y la pantalla usen la misma escala no es cosmético: si la pantalla
 * dice "Templado · manga larga ligera" y el motor entiende otra cosa, la
 * persona pidió una cosa y recibió otra.
 */
export function queSePoneA(tempC: number): string {
  if (tempC <= 8)
    return "Eso es HELADO: pide abrigo grueso y capas de verdad (térmica o punto grueso debajo).";
  if (tempC <= 15)
    return "Eso es FRÍO: pide suéter o chamarra. Una capa de abrigo, no dos apiladas.";
  if (tempC <= 21)
    return "Eso es TEMPLADO: manga larga ligera y ya. NO es clima de abrigo ni de apilar lana sobre lana — una sola capa ligera basta, y muchas veces ni eso.";
  if (tempC <= 27)
    return "Eso es CÁLIDO: playera o manga corta, a gusto. Nada de capas de abrigo.";
  return "Eso es CALUROSO: lo más fresco que tenga, tejidos ligeros y respirables. Cero capas.";
}

export function pisoDeFormalidad(ctx: EngineContext): string {
  const esNoche = ctx.timeOfDay === "noche";
  const esEvento = ctx.objective === "evento";

  // El wizard ya preguntó la formalidad: manda ella, con su propio bloque.
  if (esEvento && ctx.formality) return "";

  if (esEvento || esNoche) {
    return (
      "PISO DE FORMALIDAD (evento / noche) — el look DEBE subir de registro:\n" +
      "- Al menos UNA pieza que lo eleve: saco o blazer, camisa de vestir, punto fino sobre camisa, o calzado de piel. Si el clóset tiene saco o blazer, ése es el camino por default.\n" +
      "- FUERA: tenis deportivos o voluminosos, sudadera, hoodie, jogger, bermuda, short, gorra y ropa de entrenar. Un tenis de piel liso y limpio sí pasa, pero solo si no hay calzado de piel.\n" +
      "- Si el clóset NO da para eso, arma con lo MÁS arreglado que haya y dilo en la explicación, sin fingir que es de gala. Jamás inventes prendas que no están.\n" +
      "- Ante la duda, sube medio nivel. Quedarse corto en un evento se siente mal; pasarse un poco, no."
    );
  }

  if (ctx.objective === "oficina") {
    // El piso mínimo, que vale para cualquier trabajo.
    const base =
      "PISO DE FORMALIDAD (trabajo):\n" +
      "- FUERA: bermuda, short, ropa deportiva (jogger, sudadera, tenis de correr) y gorra.\n" +
      "- Pantalón largo siempre; el calzado, limpio y cerrado.";
    // Y ARRIBA DE ESE PISO, SU TRABAJO. "Oficina" no es un registro: es cuatro
    // registros distintos, y sin saber cuál el motor tenía que adivinar. Le
    // pasó a Roberto calificando: "depende del tipo de oficina… el look está
    // padre pero depende". Si no se le ha preguntado, se queda el piso solo.
    const suyo = lineaDressCode(ctx.workDressCode, ctx.veCliente);
    return suyo ? `${base}\n- ${suyo}` : base;
  }

  // Diario, aeropuerto y refrescar no tienen piso: ahí lo cómodo ES lo correcto,
  // y el barrido lo confirmó (0% de fallo de ocasión en diario).
  return "";
}

// Una prenda como línea: incluye el hex para que el modelo juzgue el color real.
export function describeItem(item: EngineItem): string {
  const a = item.attrs;
  let color =
    a.color && a.color_hex
      ? `${a.color} ${a.color_hex}`
      : a.color_hex ?? a.color;
  if (color && a.color_secundario) color += ` con ${a.color_secundario}`;
  // Atributos de styling (si los hay): habilitan tips de "cómo llevarlo".
  const extras = [
    a.material ?? null,
    // "estampado" a secas ya es el patrón genérico — sin duplicar el prefijo.
    a.patron && a.patron !== "liso" && a.patron !== "estampado"
      ? `estampado ${a.patron}`
      : a.patron,
    a.corte ? `corte ${a.corte}` : null,
    a.largo ? `largo ${a.largo}` : null,
    a.manga ? `manga ${a.manga}` : null,
    // LA MARCA DE CERTEZA. Sin ella, el corte que el catálogo le puso a un
    // básico marcado en el checklist se lee igual que el que la visión leyó en
    // su foto — y con eso se arman reglas de proporción y tips de styling. Que
    // el modelo sepa cuál es cuál es la diferencia entre afirmar y suponer.
    // La marca depende de si ESTE atributo está confirmado, no de un nivel
    // global: quien confirmó el corte de sus jeans no debe seguir leyendo que
    // todo en ellos es aproximado.
    item.certeza === "asumida" && !(a.confirmados ?? []).includes("corte")
      ? "detalles APROXIMADOS (básico marcado, sin foto)"
      : null,
    // EL LAZO DEL CONJUNTO. Sin esto, el motor ya no era CASTIGADO por juntar
    // un saco con su pantalón —la regla los exime— pero seguía sin SABER que
    // son un traje: su propio prompt le dice "úsalos juntos sólo si de verdad
    // son un traje (misma tela)", y nada le decía cuáles lo eran. Se marcan las
    // dos piezas con el mismo id para que pueda decidir a propósito.
    a.conjunto ? `parte del conjunto ${a.conjunto.slice(0, 6)}` : null,
  ].filter(Boolean);
  // La categoría va pegada al nombre y entre corchetes: es lo que DEFINE qué es
  // la prenda, y el nombre solo no basta ("Traje marino de lana" es un saco).
  //
  // Y con ella el SUBTIPO, que es el tipo fino: derby contra oxford, cruzado
  // contra sencillo, con pinzas o sin ellas. Nació de Roberto calificando el
  // comparador: el modelo SÍ leía "zapatos derby", pero sólo dentro del texto
  // libre del nombre y de la descripción — y la descripción nunca llega hasta
  // acá, sólo alimenta al generador de imágenes. O sea que el motor llevaba
  // meses armando looks sin poder distinguir un oxford negro (que pide traje)
  // de un derby café (que va con jeans), aunque los dos se llamen "zapatos de
  // vestir cafés". Va como campo propio y no metido en el nombre porque así se
  // puede verificar, corregir y medir.
  const base = a.nombre ?? a.tipo;
  const conSubtipo = a.subtipo && !`${base}`.toLowerCase().includes(a.subtipo.toLowerCase())
    ? `${base} (${a.subtipo})`
    : base;
  const que = a.categoria ? `${conSubtipo} [${a.categoria}]` : conSubtipo;
  return [que, color, a.formalidad, a.temporada, ...extras]
    .filter(Boolean)
    .join(" · ");
}

// Contexto de la clienta (ocasión, colorimetría, estilo, gustos, clima).
// Compartido por el generador (1ª pasada) y el crítico (2ª pasada).
/**
 * `sinRecetario: true` quita del prompt TODO lo que introdujo la destilación:
 * las fórmulas del estilo, su paleta, sus vetos y el aviso de cobertura.
 *
 * Existe SOLO para el arnés (barrido-correr --ab=recetario). El recetario entró
 * en v28 y desde entonces el motor no lo ha visto un solo usuario real: los 155
 * outfits con votos son todos de v27 para atrás (13 👍, 3 👎, 12 puestos). O sea
 * que la reconstrucción del motor de esta semana está sin validar por humanos, y
 * la única forma honesta de saber si suma o resta es correr los dos lado a lado.
 * Producción nunca lo pasa.
 */
export function contextBlock(
  ctx: EngineContext,
  opciones: { sinRecetario?: boolean; sinNeutros?: boolean } = {}
): string[] {
  const lines: string[] = [];

  // Género: concordancia gramatical de lo que la persona LEE (explicación/tip)
  // + con qué ojo de stylist juzgar. Sin género, frases neutras.
  if (ctx.gender === "mujer") {
    lines.push(
      "Es mujer: escribe la explicación y el tip EN FEMENINO (concordancia gramatical femenina) y juzga con ojo de moda femenina."
    );
  } else if (ctx.gender === "hombre") {
    lines.push(
      "Es hombre: escribe la explicación y el tip EN MASCULINO (concordancia gramatical masculina) y juzga con criterio de moda masculina."
    );
  } else {
    lines.push(
      "Género no definido: evita adjetivos con género gramatical dirigidos a la persona; usa frases neutras."
    );
  }

  const objectiveLabel =
    ctx.objective && ctx.objective in OBJECTIVES
      ? OBJECTIVES[ctx.objective as Objective]
      : "Día a día";
  lines.push(`Ocasión: ${objectiveLabel}.`);
  // El piso concreto de esa ocasión va más abajo, junto al momento del día
  // (ver pisoDeFormalidad): "Ocasión: Un evento" a secas no le dice al modelo
  // qué exigir.
  if (ctx.lifestyle) {
    lines.push(ctx.lifestyle);
  }
  // QUÉ evento es, antes que sus palabras: el catálogo trae lo que la
  // formalidad no captura (postura, fotos, qué se ve mal ahí).
  const queEvento = lineaTipoEvento(ctx.tipoEvento, ctx.registroPorPlan);
  if (queEvento) lines.push(`Es ${queEvento}.`);
  if (ctx.plan?.trim()) {
    lines.push(`Tiene en mente: "${ctx.plan.trim()}" — afina el look a ese plan.`);
    // Y SI ESAS PALABRAS NOMBRAN UN LUGAR QUE SABEMOS DESCRIBIR, va también la
    // situación. Nace de un caso real (Roberto, 2026-08-14): "ida a viñedos con
    // mis amigos" salía con mocasines de suela lisa para caminar sobre grava,
    // porque el campo libre manda `objective: "diario"` y esa línea de arriba
    // era TODO el andamiaje que el motor recibía — mientras un chip ("una
    // boda") trae piso de formalidad y perfil de la ocasión.
    //
    // Sólo cuando NO hay chip: el chip es lo que la persona eligió a mano y
    // gana siempre sobre lo que nosotros infiramos de su texto.
    const perfil = ctx.tipoEvento ? null : reconocerOcasion(ctx.plan);
    if (perfil) {
      lines.push(`Dónde es: ${perfil.situacion}.`);
      // El piso sólo existe donde el vocabulario que ya teníamos lo describe
      // bien (hoy: playa). No se dice "evento" porque puede no serlo.
      const piso = perfil.formalidadPiso && lineaFormalidad(perfil.formalidadPiso);
      if (piso && !ctx.formality) {
        lines.push(
          `Nivel que pide el lugar: ${piso} — aquí el error caro es arreglarse de más, no de menos.`
        );
      }
    }
  }
  // EL ANCLA, EN SINGULAR O EN PLURAL.
  //
  // LA FRASE DEL SINGULAR NO SE TOCÓ NI UNA COMA, y es deliberado. Este archivo
  // es prompt versionado y la casa decide los cambios del motor MIDIENDO, no de
  // oído. Si el texto de una ancla cambiara al volverlo plural, cada look con
  // una sola prenda fijada —o sea, todos los de hoy— pasaría a generarse con un
  // prompt distinto, y eso sí habría que medirlo en el comparador con corrida
  // pareada. Manteniéndolo idéntico, lo único nuevo es el caso de 2+, que antes
  // no existía: no hay contra qué compararlo porque no había nada.
  const anclas = (ctx.seedItemIds ?? [])
    .map((id) => ctx.items.find((i) => i.id === id))
    .filter((i): i is EngineItem => !!i);
  if (anclas.length === 1) {
    const seed = anclas[0];
    lines.push(
      `ANCLA (REGLA DURA): hoy QUIERE usar esta prenda → ${seed.id}: ${describeItem(seed)}. El look DEBE incluirla; arma el resto alrededor respetando clima, colorimetría y ocasión. Si choca con el clima, inclúyela igual y compénsala con el resto. Jamás la quites ni la sustituyas.`
    );
  } else if (anclas.length > 1) {
    // El plural repite la misma promesa —TODAS entran, ninguna se sustituye— y
    // agrega lo único que el singular no podía tener: qué hacer cuando las
    // prendas fijadas no se llevan bien entre ellas. La respuesta es la misma
    // que con el clima: se respetan igual y se compensa con el resto. Quien las
    // eligió sabe lo que quiere ponerse.
    const lista = anclas.map((i) => `${i.id}: ${describeItem(i)}`).join(" | ");
    lines.push(
      `ANCLA (REGLA DURA): hoy QUIERE usar estas ${anclas.length} prendas → ${lista}. El look DEBE incluirlas TODAS; arma el resto alrededor respetando clima, colorimetría y ocasión. Si alguna choca con el clima o entre ellas, inclúyelas igual y compénsalas con el resto. Jamás quites ni sustituyas ninguna.`
    );
  }
  if (ctx.timeOfDay === "noche") {
    lines.push("Momento: de noche — favorece tonos más oscuros.");
  } else if (ctx.timeOfDay === "dia") {
    lines.push("Momento: de día.");
  }

  const piso = pisoDeFormalidad(ctx);
  if (piso) lines.push(piso);

  // Y si el clóset da JUSTO para ese código: avisar, no bloquear. El caso de
  // "no da" ni siquiera llega hasta aquí — lo corta el pipeline antes de
  // generar (lib/engine/alcance.ts).
  const avisoAlcance = lineaAlcance(
    alcanceDeFormalidad(ctx.items, (ctx.formality as never) ?? null, ctx.gender)
  );
  if (avisoAlcance) lines.push(avisoAlcance);

  // Formalidad del evento (el wizard la pregunta para "evento") + default
  // mexicano: las bodas/eventos formales en México son más arreglados que el
  // default del modelo; ante la duda, subir nivel, no bajarlo.
  // La tabla vive en lib/formalidad.ts, compartida con la pantalla, la rúbrica
  // y el comparador. Estuvo escrita en las cuatro y la cuarta se quedó atrás.
  if (ctx.formality && lineaFormalidad(ctx.formality)) {
    // LA ESCALADA NO ES UNIVERSAL. "Ante la duda sube medio nivel" vale en la
    // ESCALERA (casual→gala), donde pasarse de arreglado es el error barato. En
    // "playa" el error barato es el CONTRARIO y el mismo consejo lo produce: la
    // primera corrida con boda de playa devolvió blazer marino y zapato de piel
    // de suela para la arena, empujada por esta misma frase.
    // v71: LA ESCALADA RESPETA EL DIAL. "Ante la duda sube medio nivel, nunca
    // lo bajes" se escribió para bodas mexicanas y aplicaba a TODO evento — así
    // que en una cena con dial relajado el prompt decía dos cosas a la vez: el
    // dial "un paso MÁS RELAJADO, blazer sobre traje" y esta línea "NUNCA lo
    // bajes". La categórica ganaba. Medido en 92 looks votados de
    // cita/cena/fiesta: traje completo 46% de aprobación, corbata 25%, sin
    // sastre 85% — y el control (traje en boda/funeral) 82%: el traje no es el
    // problema, el lugar sí. Con dial relajado la formalidad pasa de meta a
    // TECHO; sin dial (o con dial arreglado) todo queda como estaba.
    const dialRelajado = registroDe(ctx.registroPorPlan, ctx.tipoEvento) === "relajado";
    const empuje =
      ctx.formality === "playa"
        ? "RESPÉTALA. Y ojo con el reflejo de arreglar de más: AQUÍ pasarse es el error, no quedarse corto — el saco oscuro y el zapato de suela de cuero se leen como no haber entendido dónde es. Si dudas entre dos, gana el más fresco."
        : dialRelajado
          ? "RESPÉTALA como TECHO, no como meta: su dial para este plan va relajado, así que DENTRO de esta formalidad elige la lectura más relajada — piezas sueltas o un blazer con pantalón de otro juego antes que el traje completo, y el cuello abierto antes que la corbata. Aquí el error barato es pasarse de arreglado, no quedarse corto."
          : "RESPÉTALA, no te quedes corto (subvestir un evento se siente fuera de lugar). Contexto México: los eventos formales y las bodas son más arreglados que el promedio; ante la duda, sube medio nivel, nunca lo bajes.";
    lines.push(`Formalidad del evento: ${lineaFormalidad(ctx.formality)} — ${empuje}`);
  } else if (ctx.objective === "evento") {
    lines.push(
      "Es un evento: en México tienden a ser más formales que el promedio (sobre todo bodas). Ante la duda, arréglalo más, no menos."
    );
  }

  // normSeason rescata data legacy con mayúscula ("Invierno"): así el guiño no se
  // pierde ni en los colores prestados ni en el label.
  const seasonKey = normSeason(ctx.season);
  const s = seasonKey ? SEASONS[seasonKey] : null;
  if (s && seasonKey) {
    const { mejores, prestados, evita } = seasonPalette(seasonKey, ctx.flow);
    const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
    const avoid = evita.map((c) => c.nombre).join(", ");
    const flowKey = normSeason(ctx.flow);
    const flowSeason = flowKey ? SEASONS[flowKey] : null;
    const flowLabel = flowSeason ? ` (con flow a ${flowSeason.label})` : "";
    lines.push(
      `Su colorimetría: paleta tipo ${s.label}${flowLabel}. Le favorecen cerca de la cara: ${favs}. EVITA cerca de la cara (la apagan): ${avoid}.`,
      // SIN esta línea el modelo lee la paleta como binaria —o favorece o
      // apaga— y todo lo que no está en la lista de favoritos pierde siempre.
      // Medido en el clóset real de Roberto: sus grises, azules suaves y
      // denim claro salieron 0-1 veces en 31 looks (el 20% del clóset se
      // llevó el 2% del uso), mientras el vino —4% de las prendas— se llevó
      // el 12%, casi tres veces lo que le tocaba. Él lo cachó antes que la
      // medición: "está dándole demasiado peso a la paleta, son la guinda y
      // la esmeralda porque soy invierno, y a las otras no les da importancia;
      // ahí es donde nos está matando la rotación, porque rota pero
      // priorizando". Las paletas de estación solo listan colores CON carácter
      // —ninguna incluye un gris medio— y su ausencia se estaba leyendo como
      // rechazo.
      ...(opciones.sinNeutros ? [] : [`Los NEUTROS no entran en esa balanza: gris en cualquier tono, azul suave, denim, blanco hueso, crudo y negro son el FONDO del guardarropa, no un color que compita. Ni la favorecen ni la apagan — funcionan siempre, cerca de la cara y lejos. Que un neutro no esté en su lista de favoritos NO es motivo para descartarlo: la lista solo ordena los colores CON carácter. Un look de neutros con una sola pieza de su paleta es tan correcto como uno que la use entera.`])
    );
  }

  if (ctx.archetype) {
    lines.push(
      `Su estilo: "${ctx.archetype.nombre}" — ${ctx.archetype.descripcion}`
    );
  }
  if (ctx.tasteTags.length > 0) {
    lines.push(`Tags de gusto (en orden de fuerza): ${ctx.tasteTags.join(", ")}.`);
    // Las fórmulas en prosa del recetario vivieron aquí de v28 a v33 y se
    // fueron en v34 por el A/B pre-registrado (5-4-2, azar). Lo que queda del
    // recetario son sus DATOS: la marca de familia en el clóset (closetBlock) y
    // este aviso de cobertura — si el clóset NO da para su estilo, decirlo
    // ANTES de que el modelo arme algo y lo bautice con un nombre que no es.
    // La persona nota esa mentira antes que nosotros.
    if (ctx.gender && !opciones.sinRecetario) {
      const recetas = recetasParaTags(ctx.tasteTags, ctx.gender);
      if (recetas[0]) {
        const aviso = bloqueCobertura(
          coberturaDeReceta(recetas[0], ctx.items, bandaDeClima(ctx.weather))
        );
        if (aviso) lines.push(aviso);
      }
    }
  }
  // Va PEGADO a la receta: casi todas dicen "manda la preferencia de la persona"
  // entre recto y holgado, y sin esta línea esa frase queda apuntando a un dato
  // que el motor no tiene — así que elegía al azar entre el pantalón recto y el
  // amplio del mismo clóset. 'mixta' no se traduce a un corte: decirle al modelo
  // que no hay preferencia fuerte es más útil que inventarle una.
  if (ctx.fitPref === "recta" || ctx.fitPref === "holgada") {
    lines.push(
      ctx.fitPref === "holgada"
        ? `Cómo le gusta que le quede la ropa (lo eligió viendo fotos, no lo declaró): HOLGADA — prefiere caída y amplitud a que la prenda siga el cuerpo. Cuando la receta admita varias siluetas o su clóset tenga las dos opciones, elige la de corte amplio. No la conviertas en disfraz: sigue valiendo la regla de que solo UNA zona lleva volumen a la vez.`
        : `Cómo le gusta que le quede la ropa (lo eligió viendo fotos, no lo declaró): RECTA — prefiere que la prenda siga la línea del cuerpo, sin amplitud extra. Cuando la receta admita varias siluetas o su clóset tenga las dos opciones, elige el corte recto. Recto no es entallado: nada apretado.`
    );
  } else if (ctx.fitPref === "mixta") {
    lines.push(
      `Cómo le gusta que le quede la ropa: NO tiene preferencia fuerte (eligió distinto entre dos pares de fotos). Deja que mande la silueta que la receta de su estilo señale como dominante; no fuerces ni lo amplio ni lo recto.`
    );
  }
  // PEGADO al de la silueta porque es su hermano: los dos son gusto puro
  // elegido viendo fotos, no declarado con palabras. El de arriba dice cómo le
  // queda la ropa; éste, cuánto color lleva.
  if (ctx.acentoApetito) {
    lines.push(lineaApetitoAcentos(ctx.acentoApetito));
    // Y si pidió el color en dosis chicas SIN tener piezas chicas de color, se
    // dice — el patrón del pastel de manzana (cobertura.ts): la carencia se
    // nombra, no se compensa a escondidas metiéndole el suéter de color que
    // justamente pidió evitar.
    const aviso = bloqueCoberturaAcentos(
      coberturaDeAcentos(
        ctx.items.map((i) => ({
          nombre: i.attrs.nombre,
          color: i.attrs.color,
          categoria: categoriaDeItem(i as never),
        })),
        ctx.acentoApetito
      )
    );
    if (aviso) lines.push(aviso);
  }
  if (ctx.styleWords?.trim()) {
    // slice defensivo: el tope de 280 vive en la app, no en la DB — un valor
    // gigante escrito por otra vía no debe inflar el prompt.
    lines.push(
      `Su estilo EN SUS PALABRAS: "${ctx.styleWords.trim().slice(0, 280)}". Es la señal más directa de quién es — respétala; si contradice los tags, sus palabras mandan (pero las REGLAS DURAS — vetos, género, clima — siempre están por encima).`
    );
  }
  if (ctx.styleReference) {
    lines.push(
      `Estilo de referencia que le encanta (inspira el VIBE y las siluetas, NO los colores — la colorimetría de arriba manda el color): ${ctx.styleReference}. Empuja los looks hacia ese aire sin copiarlo al pie de la letra.`
    );
  }
  if (ctx.silueta) {
    lines.push(
      `Su cuerpo (orientación de styling, NO regla ni motivo de rechazo): ${ctx.silueta}. Úsalo solo para desempatar entre looks parejos y para enriquecer el porqué cuando el look de verdad la equilibre — sin que domine sobre el clima, su colorimetría, la ocasión o sus gustos, y sin forzarlo en cada explicación.`
    );
  }
  if (ctx.ageStyling) {
    lines.push(ctx.ageStyling);
  }
  if (ctx.weather) {
    // LA TEMPERATURA, TRADUCIDA A ROPA. Hasta v38 esto decía solo el número
    // ("Clima de hoy: 18°C, nublado") y nunca qué significa vestirse a 18°.
    // Que Opus acertara era suerte: adivinaba el registro mexicano. Gemini
    // adivinó distinto y apiló lana sobre lana sobre lana a 18° — dos veces.
    // La app YA tiene esta traducción (el selector de clima dice "Templado ·
    // manga larga ligera"); nunca llegaba al motor.
    lines.push(
      `Clima de hoy: ${ctx.weather.temp_c}°C, ${ctx.weather.condition}. ${queSePoneA(
        ctx.weather.temp_c
      )}`
    );
    // LA LLUVIA. Antes viajaba como una palabra suelta ("lluvia") sin decir qué
    // exige. Los DOS motores fallaron ahí en el veredicto — producción incluida,
    // con el prompt más afinado que existe. Aquí se dice; y además se comprueba
    // en código (lib/engine/reglas-ejecucion.ts), porque una instrucción que se
    // puede ignorar no es una garantía.
    if (hayLluvia(ctx.weather.condition)) {
      lines.push(
        ctx.paraguas
          ? "VA A LLOVER y lleva paraguas: la capa de arriba la eliges por estilo (el paraguas la cubre). El CALZADO no: el paraguas no tapa los pies. Fuera el ante, la gamuza y la tela, y fuera también el mocasín, el náutico y la sandalia — son escotados y de suela fina, el agua entra por arriba aunque sean de piel. Sí pasan botas, botines y tenis de piel o sintético."
          : "VA A LLOVER y NO lleva paraguas: la capa de arriba tiene que repeler agua (impermeable, técnica, gabardina). Y el CALZADO: fuera el ante, la gamuza y la tela, y fuera también el mocasín, el náutico y la sandalia — son escotados y de suela fina, el agua entra por arriba aunque sean de piel. Sí pasan botas, botines y tenis de piel o sintético."
      );
    }
  }

  if (ctx.vetoes.length > 0) {
    lines.push(
      `REGLA DURA — VETOS: la persona NUNCA quiere y jamás debes incluir ni sugerir: ${ctx.vetoes.join(
        ", "
      )}. En ninguna prenda, ni cerca de la cara ni en ningún lado, en ningún look. Es una regla absoluta.`
    );
  }

  lines.push(...tasteSignalLines(ctx.tasteSignal));

  return lines;
}

// "La app aprende": traduce el feedback real a guía para el motor. Señal SUAVE
// (orienta, no es regla dura ni motivo de rechazo): inclínate hacia lo que se
// puso y le gustó, aléjate de lo que rechazó, aprendiendo el patrón sin copiar.
// Exportada: también la usan los motores de cápsula y viaje (v24).
export function tasteSignalLines(s: TasteSignal): string[] {
  if (!hasTasteSignal(s)) return [];
  const fmt = (o: RememberedOutfit): string => {
    const prendas = o.items.length > 0 ? o.items.join(", ") : o.title ?? "un look";
    const name = o.title && o.items.length > 0 ? `"${o.title}": ` : "";
    const oc = o.occasion ? ` (ocasión: ${o.occasion})` : "";
    const why = o.reason ? ` — dijo: "${o.reason}"` : "";
    return `${name}${prendas}${oc}${why}`;
  };
  const lines: string[] = [
    "Lo que ya aprendiste de su gusto (de looks que le mostraste antes — orienta el estilo, NO es regla dura ni para copiar exacto):",
  ];
  for (const o of s.worn) {
    lines.push(`- SE LO PUSO de verdad (lo que MÁS le gusta — busca este tipo de combinación): ${fmt(o)}`);
  }
  for (const o of s.liked) lines.push(`- Le gustó (👍): ${fmt(o)}`);
  for (const o of s.disliked) {
    lines.push(`- Lo RECHAZÓ (no repitas este patrón): ${fmt(o)}`);
  }
  for (const o of s.skipped) lines.push(`- Pidió otro en vez de este: ${fmt(o)}`);
  lines.push(
    "Inclínate hacia lo que se puso y le gustó; aléjate de lo que rechazó. Aprende el patrón (colores, formalidad, siluetas, qué combina con qué) — NO copies un look exacto."
  );
  return lines;
}

// El clóset llega del DB en orden pseudo-estable (el query no tiene ORDER BY) y
// los modelos tienen sesgo posicional: sobre-eligen lo de arriba de la lista →
// SIEMPRE las mismas prendas. Neutralizado aquí: agrupar por categoría (la
// estructura además ayuda al modelo a armar looks) y BARAJAR dentro de cada
// grupo en cada llamada. `rand` inyectable para tests deterministas.
export function orderClosetForEngine(
  items: EngineItem[],
  rand: () => number = Math.random
): EngineItem[] {
  const groups = new Map<string, EngineItem[]>();
  for (const it of items) {
    const a = it.attrs as Record<string, unknown>;
    const cat = String(a.categoria ?? a.category ?? it.attrs.tipo ?? "otros");
    const g = groups.get(cat);
    if (g) g.push(it);
    else groups.set(cat, [it]);
  }
  const out: EngineItem[] = [];
  for (const g of groups.values()) {
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
    out.push(...g);
  }
  return out;
}

/**
 * Las recetas que aplican a esta persona. Una sola definición para que el
 * contexto, el clóset y la cobertura hablen de las MISMAS recetas: calculadas
 * por separado en cada sitio, un cambio en el tope o en el puntaje las
 * desincronizaría en silencio y el clóset acabaría marcado con una familia que
 * el prompt no explicó.
 */
export function recetasDelContexto(ctx: EngineContext): Receta[] {
  if (!ctx.gender || ctx.tasteTags.length === 0) return [];
  return recetasParaTags(ctx.tasteTags, ctx.gender);
}

// El clóset como bloque (ids + descripción con hex).
//
// LA MARCA DE FAMILIA
// Cada prenda que pertenece al vocabulario de su estilo va marcada. El motor
// recibe hasta 45 prendas sueltas y la receta en prosa; emparejarlas de memoria
// es donde se cae (ver familiasPorPrenda). Marcarlas le ahorra ese trabajo y le
// deja el que sí es suyo: elegir entre las que sirven.
//
// Redactado como DATO y no como orden a propósito: "usa estas" convertiría el
// motor en un filtro y le quitaría el clima, la ocasión y la colorimetría, que
// mandan por encima de la receta en la escalera.
//
// Y dice "tipo de prenda de" y no "de su estilo" por una razón que se vio al
// mirar el prompt armado: el emparejamiento es por TIPO, así que unos tenis
// skate negros salen marcados para el preppy —cuya receta los veta por nombre—.
// "De su estilo" leería como aprobación de esa prenda concreta y le daría al
// motor una autoridad que el dato no tiene. Nombrar la marca por lo que de
// verdad es deja que la receta siga mandando sobre ella.
export function closetBlock(items: EngineItem[], recetas: Receta[] = []): string[] {
  const familias = recetas.length ? familiasPorPrenda(items, recetas) : new Map();
  const lines = ["Su clóset (usa SOLO estos ids):"];
  for (const item of items) {
    const suyas = familias.get(item.id);
    const marca = suyas?.length ? `  ← tipo de prenda de: ${suyas.join(" / ")}` : "";
    lines.push(`- ${item.id}: ${describeItem(item)}${marca}`);
  }
  if (familias.size > 0) {
    lines.push(
      "",
      "Las prendas marcadas son las que pertenecen al VOCABULARIO DE PRENDAS de la familia que le gusta: ya están cruzadas contra su receta, no lo vuelvas a hacer de memoria. Constrúyele el look con ellas cuando el clima, la ocasión y su colorimetría lo permitan; un look armado ENTERO con prendas sin marcar suele ser señal de que te fuiste de su estilo sin querer.",
      "OJO con qué significa la marca: es por TIPO de prenda, no por color ni por acabado. Que unos tenis estén marcados no quiere decir que ESOS tenis sirvan — si la receta veta el calzado voluminoso o de color, la receta manda sobre la marca. Y una prenda sin marcar puede entrar perfectamente si el look la pide (un neutro que resuelve, la capa que el día exige)."
    );
  }
  return lines;
}

/**
 * `marcarEstilo: false` apaga la marca de familia en el clóset.
 *
 * Existe SOLO para el A/B del arnés (scripts/barrido-correr.ts --ab): correr el
 * mismo caso con y sin la marca, en la misma corrida y contra el mismo modelo,
 * es la única forma de saber si sirve sin que el ruido del modelo se coma la
 * señal. Comparar dos corridas distintas ya nos dio un resultado ilegible.
 * Producción nunca lo pasa.
 */
export function buildUserMessage(
  ctx: EngineContext,
  opciones: {
    marcarEstilo?: boolean;
    sinRecetario?: boolean;
    /** Apaga la estructura de referencia. Solo para el A/B del arnés. */
    sinBlueprint?: boolean;
    /** Apaga la rotación del clóset. Solo para medirla contra su ausencia. */
    sinRotacion?: boolean;
    /** Apaga la aclaración de que los neutros no compiten. Solo para medirla. */
    sinNeutros?: boolean;
    /**
     * Usa ESTA estructura en vez de la sembrada del día. Solo para el arnés.
     *
     * En producción la siembra por día es lo correcto (generador y juez tienen
     * que ver la misma), pero eso le daría al A/B la MISMA estructura en los 20
     * casos y mediría una sola. Inyectándola, cada caso prueba una distinta —
     * que es justo la variable bajo prueba.
     */
    blueprint?: BlueprintEmparejado | null;
  } = {}
): string {
  // Sin recetario no hay marca posible: la marca ES el recetario aplicado al
  // clóset. Apagar uno y dejar la otra mediría una mezcla que nunca existió.
  const recetas =
    opciones.marcarEstilo === false || opciones.sinRecetario
      ? []
      : recetasDelContexto(ctx);
  const lines: string[] = [
    ...contextBlock(ctx, opciones),
    "",
    ...closetBlock(ctx.items, recetas),
  ];

  // La estructura de referencia: UN look real de calle diseccionado, con su
  // núcleo ya cruzado contra el clóset. Va DESPUÉS del clóset porque nombra sus
  // ids, y solo existe para las celdas de (ocasión × clima) que tienen material.
  //
  // Silencio absoluto cuando no hay: elegirBlueprint devuelve null si la celda
  // no está cubierta o si el clóset no da para ninguno, y ahí el motor arma
  // como siempre. Es la misma decisión que se tomó con las fotos de inspiración
  // tras perder su A/B — cuando la referencia no ayuda, ninguna es mejor que
  // una mala.
  if (!opciones.sinBlueprint) {
    const bp =
      opciones.blueprint ??
      blueprintDelContexto(
        ctx,
        bandaDeClima(ctx.weather),
        recetasDelContexto(ctx).map((r) => r.familia)
      );
    if (bp) lines.push("", bloqueBlueprint(bp));
  }

  if (ctx.recentCombos.length > 0) {
    lines.push("", "Combinaciones recientes (NO las repitas exactas):");
    for (const combo of ctx.recentCombos) {
      lines.push(`- ${combo.join(" + ")}`);
    }
  }

  // Y el mismo historial leído POR PRENDA, no por look. La lista de arriba solo
  // prohíbe repetir un conjunto entero; nada le decía al motor que una prenda
  // lleva tres semanas sin salir. Medido sobre 240 looks del clóset real: los
  // chinos carbón salieron en el 30% y 61 de 127 prendas no salieron nunca.
  if (!opciones.sinRotacion) {
    const rot = bloqueRotacion(calcularRotacion(ctx.items, ctx.recentCombos));
    if (rot) lines.push("", rot);
  }

  lines.push("", "Ármale 2-3 outfits.");
  return lines.join("\n");
}
