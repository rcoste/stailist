// ¿ESTE LOOK YA SALIÓ? — la regla de "no repitas combinaciones" hecha código.
//
// El prompt ya lo pedía ("Combinaciones recientes (NO las repitas exactas)"),
// pero pedirlo no es cumplirlo. Cazado el 2026-09-16 armando la primera semana
// de prueba: el viernes y el martes salieron con el MISMO look (jeans azul
// oscuro, botas negras, blazer marino, camiseta negra) aunque el viernes ya
// estaba en la lista de recientes. Con un clóset chico el modelo vuelve a la
// combinación que más le convence.
//
// Por conjunto, no por orden: el motor devuelve item_ids en cualquier orden, y
// ["jeans","botas"] contra ["botas","jeans"] es el mismo look puesto. Y por
// conjunto ENTERO, no por prenda: repetir unos jeans en la semana es normal.

export function esCombinacionRepetida(itemIds: string[], recientes: string[][]): boolean {
  const clave = (ids: string[]) => [...new Set(ids)].sort().join("|");
  const esta = clave(itemIds);
  return recientes.some((r) => clave(r) === esta);
}
