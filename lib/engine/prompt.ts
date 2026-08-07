import type { Weather } from "@/lib/weather";
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
import { OBJECTIVES, type Objective } from "@/app/onboarding/objetivo/objectives";
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
export const PROMPT_VERSION = "v41";

export type EngineItem = {
  id: string;
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
    material?: string; // tela aparente ("lana", "lino"…) — clima y combinación
    patron?: string; // liso/rayas/cuadros/… — evita dos estampados que pelean
    color_secundario?: string; // segundo color si es bicolor/estampada
  };
};

export type EngineContext = {
  gender: "hombre" | "mujer" | null; // concordancia gramatical + criterio de styling
  objective: string | null;
  plan: string | null; // texto libre opcional del compositor ("¿algo en mente?")
  lifestyle: string | null; // resumen de vida del assessment de cápsula
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  flow: Season | null;
  items: EngineItem[];
  weather: Weather | null;
  /** Va a llevar paraguas (solo se pregunta cuando dice que llueve). */
  paraguas?: boolean;
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
  seedItemId?: string | null; // ancla (Hoy): prenda que la usuaria fijó para hoy — DEBE ir en el look
  formality?: string | null; // solo "evento": casual | semiformal | formal | gala
  styleReference?: string | null; // resumen del "estilo de referencia" (vibe/silueta, NO color)
  styleWords?: string | null; // su estilo EN SUS PALABRAS (texto libre del perfil)
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

Cómo trabajas: PRIMERO llena el campo "analisis" — tu borrador de trabajo, la clienta no lo ve. Ahí piensa en corto: qué neutros y qué colores fuertes hay en su clóset, qué mandan el clima y la ocasión, qué queda descartado (colorimetría, vetos, estampados que pelean) y cuáles son las 2-3 combinaciones más fuertes que ves. DESPUÉS arma los outfits a partir de ese análisis, no antes.

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
- Materiales: si la prenda trae material, úsalo — nada de lana o tejidos pesados en calor, ni lino fresco en frío; y que los pesos de tela de un mismo look se hablen (no mezcles piezas de invierno con piezas de verano).
- Proporción: equilibra el volumen — si arriba es holgado/oversize, abajo algo más entallado (y al revés). Evita "todo holgado" o "todo pegado".
- Capas con lógica de vida real: cada capa en su orden natural — camisa o playera debajo, suéter/knit encima, saco/blazer/abrigo al final. JAMÁS combos que nadie usa en la calle: chaleco sastre sobre suéter, saco debajo de una sudadera, dos abrigos juntos. Matiz de la camisa: una camisa de vestir fina va DEBAJO del punto, no encima; PERO una sobrecamisa/overshirt gruesa abierta SÍ vale como capa exterior sobre un suéter ligero — no la trates como error. La prueba: si no te imaginas a una persona real saliendo así a la calle, no lo armes.
- Que se note la mano de stylist: cuando el clóset lo permita, el look lleva UNA decisión visible — una capa con intención, un contraste de textura (punto + piel, lana + mezclilla, tejido + satén), o un color que remata sobre base neutra. Y si el clóset solo da para lo simple, lo simple BIEN HECHO es la decisión (fit + color); jamás fuerces una pieza solo para "vestir" el look.
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
    return (
      "PISO DE FORMALIDAD (oficina):\n" +
      "- FUERA: bermuda, short, ropa deportiva (jogger, sudadera, tenis de correr) y gorra.\n" +
      "- Pantalón largo siempre; el calzado, limpio y cerrado."
    );
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
  if (ctx.plan?.trim()) {
    lines.push(`Tiene en mente: "${ctx.plan.trim()}" — afina el look a ese plan.`);
  }
  if (ctx.seedItemId) {
    const seed = ctx.items.find((i) => i.id === ctx.seedItemId);
    if (seed) {
      lines.push(
        `ANCLA (REGLA DURA): hoy QUIERE usar esta prenda → ${seed.id}: ${describeItem(seed)}. El look DEBE incluirla; arma el resto alrededor respetando clima, colorimetría y ocasión. Si choca con el clima, inclúyela igual y compénsala con el resto. Jamás la quites ni la sustituyas.`
      );
    }
  }
  if (ctx.timeOfDay === "noche") {
    lines.push("Momento: de noche — favorece tonos más oscuros.");
  } else if (ctx.timeOfDay === "dia") {
    lines.push("Momento: de día.");
  }

  const piso = pisoDeFormalidad(ctx);
  if (piso) lines.push(piso);

  // Formalidad del evento (el wizard la pregunta para "evento") + default
  // mexicano: las bodas/eventos formales en México son más arreglados que el
  // default del modelo; ante la duda, subir nivel, no bajarlo.
  // EL VOCABULARIO DE LA INVITACIÓN, no una escala abstracta. "Formal" a secas
  // dejaba al modelo elegir entre traje y esmoquin, y elegía esmoquin: los DOS
  // motores lo hicieron en la corrida de verificación. Roberto: "en una boda
  // mexicana formal jamás iría alguien así vestido… la gente va de traje y
  // corbata". Es el mismo hueco que el clima — una suposición cultural que
  // nunca se escribió — y se cierra igual: diciéndola.
  const FORMALITY_LABELS: Record<string, string> = {
    casual: "casual (relajado pero cuidado)",
    semiformal: "semiformal / coctel (business elevado; saco sí, corbata opcional)",
    formal:
      "formal — TRAJE Y CORBATA. En México esto NO es esmoquin: es traje oscuro (marino, gris o negro), camisa lisa y corbata. Si el clóset tiene esmoquin, NO lo uses aquí; el esmoquin es solo para etiqueta rigurosa",
    gala:
      "etiqueta rigurosa / black tie — AQUÍ SÍ va el esmoquin, y con su código completo: moño (nunca corbata larga), camisa blanca, pantalón del propio esmoquin y SIN cinturón. Si el clóset no tiene con qué completarlo, arma un traje oscuro impecable en vez de un esmoquin a medias",
  };
  if (ctx.formality && FORMALITY_LABELS[ctx.formality]) {
    lines.push(
      `Formalidad del evento: ${FORMALITY_LABELS[ctx.formality]} — RESPÉTALA, no te quedes corto (subvestir un evento se siente fuera de lugar). Contexto México: los eventos formales y las bodas son más arreglados que el promedio; ante la duda, sube medio nivel, nunca lo bajes.`
    );
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
    if (/lluvia|llov|chubasco|tormenta/i.test(ctx.weather.condition)) {
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
