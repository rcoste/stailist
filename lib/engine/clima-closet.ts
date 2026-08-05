import type { EngineItem } from "./prompt";
import type { Weather } from "@/lib/weather";
import { tipoDePrenda, type Zona } from "./vocabulario";

// Quitar del clóset lo que el día no admite, ANTES de mandárselo al motor.
//
// LA IDEA ES DE ROBERTO, y es la pregunta correcta: "¿hay alguna manera de
// barajear inteligentemente o por partes? Si va a hacer calor, ¿qué metes al
// barajeo, una gabardina o un abrigo? Y si va a hacer frío, pues no metes shorts
// o ropa de lino".
//
// QUÉ PROBLEMA ATACA
// Midiendo la concentración salió que el motor usa 34 de 66 prendas aplicables
// (52%) y repite las mismas. No es que le falte información —cada prenda ya le
// llega con su temporada escrita— sino que le llegan 127 prendas de las cuales
// decenas no vienen al caso, y compiten por su atención.
//
// LA BANDA NO ALCANZA, y por eso esto no reusa bandaDeClima. La banda templada
// va de 16 a 25°: a 17° una camisa de lino sobra y a 24° sobra el suéter de
// lana, y un solo criterio para toda la banda no puede decir las dos cosas. Se
// filtra por TEMPERATURA, que es lo que Roberto llamó "por partes".
//
// CONSERVADOR A PROPÓSITO. Entre 19 y 22° no se quita nada: ahí conviven
// legítimamente una camisa ligera y un punto fino, y quitar de más es peor que
// quitar de menos — un hueco falso le dice a la persona que no puede vestirse
// cuando sí puede (el mismo criterio que gobierna cobertura.ts).

/** Qué temporada estorba a esta temperatura. null = no quitar nada. */
export function temporadaQueEstorba(weather: Weather | null): "frio" | "calor" | null {
  if (!weather) return null; // sin clima no se recorta: el error saldría gratis y caro
  const t = weather.temp_c;
  if (t <= 18) return "calor"; // ni shorts ni sandalias ni lino
  if (t >= 23) return "frio"; // ni abrigo de lana ni bufanda
  return null; // 19-22°: zona donde de verdad conviven las dos
}

/**
 * Cuántas prendas de calle tiene que quedar en una zona para poder recortarla.
 *
 * El recorte NUNCA puede dejar una zona sin con qué. Si a alguien con tres
 * pantalones dos son de frío, quitarlos a 24° lo deja con uno y el motor pierde
 * toda opción — peor que el ruido que se quería quitar. Con menos de este mínimo
 * la zona se deja completa.
 */
const MINIMO_POR_ZONA = 3;

/**
 * El clóset del día: fuera lo que la temperatura no admite.
 *
 * Devuelve también qué se quitó, para poder medirlo y para que el arnés lo
 * pueda imprimir. Un filtro silencioso que se equivoca es indistinguible de un
 * clóset pobre.
 */
export function closetDelDia(
  items: EngineItem[],
  weather: Weather | null
): { items: EngineItem[]; quitadas: EngineItem[] } {
  const estorba = temporadaQueEstorba(weather);
  if (!estorba) return { items, quitadas: [] };

  const zonaDe = (it: EngineItem): Zona | "?" =>
    tipoDePrenda(it.attrs.nombre ?? it.attrs.tipo ?? "")?.zona ?? "?";
  const sobra = (it: EngineItem) =>
    (it.attrs as { temporada?: string }).temporada === estorba;

  // Cuántas quedarían por zona si se recortara.
  const quedanPorZona = new Map<Zona | "?", number>();
  for (const it of items) {
    if (sobra(it)) continue;
    const z = zonaDe(it);
    quedanPorZona.set(z, (quedanPorZona.get(z) ?? 0) + 1);
  }

  const quitadas: EngineItem[] = [];
  const quedan = items.filter((it) => {
    if (!sobra(it)) return true;
    const z = zonaDe(it);
    // Accesorios y prendas sin tipo reconocido: se recortan sin mínimo. No
    // sostienen un look — nadie se queda sin poder vestirse por falta de gorra.
    const protegida =
      z !== "accesorio" && z !== "?" && (quedanPorZona.get(z) ?? 0) < MINIMO_POR_ZONA;
    if (protegida) return true;
    quitadas.push(it);
    return false;
  });

  return { items: quedan, quitadas };
}
