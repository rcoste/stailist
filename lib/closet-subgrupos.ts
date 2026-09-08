// CÓMO SE PARTE UNA CATEGORÍA DEL CLÓSET EN SUBGRUPOS.
//
// Roberto, 2026-09-08, viendo su clóset: "está muy cabrón que tengo una
// chamarra de mezclilla junto a un abrigo de lana. Entiendo que todos caen en
// abrigo, pero podría haber sus categorías". Y luego: "esto duele en todos —
// en los pantalones tengo juntos pantalones, shorts, trajes de baño y
// pantalones de ejercicio".
//
// Tenía razón dos veces. Existía sólo para `abrigo` (Chamarras · Sobrecamisas
// · Chalecos, v0.2.x) y su cajón "Chamarras" acababa con 7 prendas donde
// conviven la de piel y la impermeable técnica. En sus 31 prendas de abajo hay
// pantalón de traje, jeans, cargo, deportivo, bermudas y CUATRO trajes de baño.
//
// POR NOMBRE Y NO POR `subtipo`, a propósito y midiendo: `subtipo` está lleno
// en 4 de sus 14 abrigos y 11 de sus 20 zapatos, mientras que los nombres son
// descriptivos al 100% ("Traje de baño negro liso", "Pantalón de vestir gris").
// El dato bueno sería `subtipo`; hoy el nombre acierta más. Cuando la visión lo
// llene siempre, este archivo es el único lugar que cambia.
//
// EL ORDEN DE CADA LISTA ES EL ORDEN EN PANTALLA, y va de más formal a más
// casual — que es como un stylist recorre un clóset. El catch-all (lo que no
// encaja) cae al final con la etiqueta de la categoría.
//
// CUIDADO CON LOS PREFIJOS: "camiseta" contiene "camisa"… no, contiene "camis",
// pero /\bcamisa\b/ NO casa con "camiseta" (la `e` es \w y rompe el \b). Los
// límites de palabra están puestos donde importa; el test lo fija con los
// nombres reales del clóset de Roberto.

export type SubgrupoDef = { label: string; test: (n: string) => boolean };

export const SUBGROUPS: Record<string, SubgrupoDef[]> = {
  top: [
    { label: "Camisas", test: (n) => /\bcamisas?\b|blusa/.test(n) },
    { label: "Polos", test: (n) => /\bpolos?\b/.test(n) },
    { label: "Playeras y camisetas", test: (n) => /playera|camiseta|\bt-?shirt\b|tank|jersey de/.test(n) },
    // Punto: lo que se teje. El cárdigan entra aquí y no en abrigos porque en
    // el clóset se busca junto a los suéteres, aunque el motor lo use de capa.
    { label: "Suéteres y punto", test: (n) => /su[eé]ter|sweater|c[aá]rdigan|cardigan|cuello (alto|tortuga)|turtleneck|knit|punto|jersey\b/.test(n) },
    { label: "Sudaderas", test: (n) => /sudadera|hoodie|felpa/.test(n) },
  ],
  bottom: [
    // El traje de baño va PRIMERO: es lo que menos se parece a un pantalón y lo
    // único que nunca entra en un look de diario. Si cae al cajón general, la
    // categoría entera se lee como revuelta.
    { label: "Trajes de baño", test: (n) => /traje de ba[nñ]o|ba[nñ]ador|short de ba[nñ]o|bikini/.test(n) },
    { label: "De vestir", test: (n) => /de (vestir|traje|smoking)|formal|franela (azul|carb|gris|marino)/.test(n) },
    // Shorts ANTES de chinos: "Bermuda caqui" y "Short de lino" casan con el
    // patrón de chinos (caqui, lino) y se los robaba. Lo cazó el test.
    { label: "Shorts y bermudas", test: (n) => /short|bermuda/.test(n) },
    { label: "Chinos y casuales", test: (n) => /chino|lino|cargo|t[eé]cnico|khaki|caqui/.test(n) },
    { label: "Jeans", test: (n) => /jean|mezclilla|denim/.test(n) },
    { label: "Deportivos", test: (n) => /deportiv|jogger|chandal|gym|running|licra/.test(n) },
  ],
  calzado: [
    { label: "De vestir", test: (n) => /oxford|derby|formal|charol|blucher|monk/.test(n) },
    { label: "Mocasines", test: (n) => /mocas[ií]n|loafer|penny/.test(n) },
    { label: "Botines y botas", test: (n) => /bot[ií]n|bota|chelsea|senderismo/.test(n) },
    { label: "Tenis", test: (n) => /tenis|sneaker|zapatilla/.test(n) },
    { label: "Sandalias", test: (n) => /sandalia|hurache|huarache|chancla|alpargata/.test(n) },
  ],
  abrigo: [
    // Parkas y plumas PRIMERO: un "Abrigo impermeable técnico" es una parka,
    // no un abrigo de paño, y /\babrigo/ se lo llevaba. Lo cazó el test. El
    // corte entre estos dos grupos es el que Roberto pidió: la ultraligera y
    // la de piel no se ponen el mismo día ni con el mismo look.
    { label: "Parkas y plumas", test: (n) => /parka|puffer|acolchad|plumas|anorak|ultraligera|impermeable t[eé]cnic/.test(n) },
    // Luego "Abrigos", y antes que "Chamarras" para que /chamarra/ no se robe
    // un "abrigo de chamarra"; el orden general es de más abrigo a menos.
    // "Abrigos y gabardinas" y no "Abrigos" a secas: la CATEGORÍA ya se llama
    // Abrigos (ver CAT en closet-grid) y en pantalla se leería "ABRIGOS ›
    // Abrigos". Aquí "abrigo" es la prenda en sentido estricto: paño o lana,
    // registro alto — el blazer de lana de Roberto entra aquí, y él confirmó
    // que ES un abrigo, no un saco mal catalogado.
    { label: "Abrigos y gabardinas", test: (n) => /\babrigo|gab(a|á)rdina|trench|\bblazer .*(lana|pa[nñ]o)|sobretodo/.test(n) },
    { label: "Chamarras", test: (n) => /chamarra|chaqueta|cazadora|bomber|biker|moto|mezclilla|denim/.test(n) },
    { label: "Sobrecamisas", test: (n) => /sobrecamisa|overshirt|shacket|camisola/.test(n) },
    { label: "Chalecos", test: (n) => /chaleco|gilet/.test(n) },
  ],
  accesorio: [
    { label: "Corbatas y moños", test: (n) => /corbata|mo[nñ]o|pajarita|bow tie/.test(n) },
    { label: "Cinturones", test: (n) => /cintur[oó]n|correa|faja/.test(n) },
    { label: "Bufandas y pañuelos", test: (n) => /bufanda|pa[nñ]uelo|foulard|mascada|pashmina/.test(n) },
    { label: "Lentes", test: (n) => /lentes|gafas|anteojos|sunglasses/.test(n) },
    { label: "Gorras y sombreros", test: (n) => /gorra|sombrero|beanie|boina|cachucha/.test(n) },
    { label: "Relojes y joyería", test: (n) => /reloj|anillo|pulsera|collar|cadena|arete/.test(n) },
  ],
};

export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Parte las prendas de una categoría en subgrupos, en el orden de SUBGROUPS,
 * con el catch-all al final bajo la etiqueta de la categoría.
 *
 * Devuelve null si la categoría no sub-agrupa o si TODO cayó en un solo grupo:
 * un encabezado que cubre el 100% de lo que hay abajo es ruido, no orden.
 */
export function subgroupsFor<T extends { nombre: string }>(
  cat: string,
  prendas: T[],
  catLabel: string
): { label: string; prendas: T[] }[] | null {
  const defs = SUBGROUPS[cat];
  if (!defs) return null;
  const rest = [...prendas];
  const out: { label: string; prendas: T[] }[] = [];
  for (const d of defs) {
    const hit = rest.filter((p) => d.test(norm(p.nombre)));
    if (hit.length) {
      out.push({ label: d.label, prendas: hit });
      for (const p of hit) rest.splice(rest.indexOf(p), 1);
    }
  }
  if (rest.length) out.push({ label: catLabel, prendas: rest });
  return out.length > 1 ? out : null;
}
