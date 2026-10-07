// "AHORA, CON TU ROPA" (2026-10-07): la pantalla que sigue al primer look.
//
// POR QUÉ EXISTE
// De las 15 personas que llegaron a su primer look en la primera semana de
// anuncios, sólo 3 subieron fotos de su ropa, y las dos únicas que volvieron
// fueron de esas 3 (las 12 que no subieron nada no volvieron). Con 15 personas
// no se sabe si subir ropa CAUSA que vuelvan o sólo lo hace quien ya venía con
// ganas; Roberto decidió probarlo. La regla, escrita antes de prenderla: si de
// las ~15 siguientes al menos la mitad sube su foto el primer día, la pantalla
// mueve la conducta; si siguen siendo 2 o 3, se quita. Si vuelven más NO se
// podrá concluir con esa muestra.
//
// QUÉ PIDE: UNA foto tuya de cuerpo entero, del carrete. Una sola para que no
// sea tarea; de cuerpo entero porque una foto así trae 3-4 prendas de una vez
// (el carrete ya las separa). No el fit check: pide estar vestido frente a un
// espejo en ese momento, y 0 de 15 lo usaron.
//
// QUÉ DA DE VUELTA, en el acto: un look armado alrededor de una de esas
// prendas. Subir ropa sin recompensa inmediata se siente como tarea.

/** Se ofrece una vez, y sólo a quien todavía no tiene ninguna prenda de foto propia. */
export function debeVerTuRopa(s: { fotosPropias: number; yaVista: boolean }): boolean {
  return s.fotosPropias === 0 && !s.yaVista;
}

/**
 * Con qué prenda de la foto se arma el primer look con tu ropa.
 *
 * UNA sola ancla, no todas: si se fijan playera, pantalón y tenis de una misma
 * foto, el motor devuelve el outfit que la persona ya traía puesto — la
 * recompensa sería ver su propia foto. Con una, el motor estiliza alrededor.
 *
 * El orden es de stylist: el vestido manda el look entero; luego lo de arriba,
 * que es lo más visible y lo que más cambia de una persona a otra; luego el
 * pantalón. Saco y abrigo van después aunque sean llamativos: en octubre en
 * México hace calor de día y un abrigo como ancla dispara el aviso de "no
 * encaja con el clima" en el primer intento, que es justo el peor momento.
 * Zapatos y accesorios al final: armar un look alrededor de unos tenis es raro
 * como primera impresión.
 */
const PRIORIDAD = ["vestido", "top", "bottom", "saco", "abrigo", "calzado", "accesorio"];

export function anclaParaPrimerLook(prendas: { id: string; categoria: string | null | undefined }[]): string | null {
  let mejor: { id: string; rango: number } | null = null;
  for (const p of prendas) {
    const i = PRIORIDAD.indexOf(p.categoria ?? "");
    const rango = i === -1 ? PRIORIDAD.length : i;
    if (!mejor || rango < mejor.rango) mejor = { id: p.id, rango };
  }
  return mejor?.id ?? null;
}

/** El mismo destino que "arma un look con esta prenda" de la ficha (components/closet-grid.tsx). */
export function hrefLookConPrenda(id: string, ahora: number = Date.now()): string {
  return `/hoy?generar=${ahora}&prenda=${encodeURIComponent(id)}`;
}
