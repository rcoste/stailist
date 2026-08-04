// Arregla la ambigüedad de la "y" en las cápsulas destiladas.
//
// EL BUG QUE LO DESTAPÓ
// En la reconstrucción de preppy en frío salió un suéter BICOLOR: azul marino
// arriba, beige abajo. Esa prenda no existe. El generador recibe la cápsula de
// la familia como texto plano y ahí decía:
//
//     "Suéter de ochos azul marino y crema"
//
// que en español quiere decir "hay dos suéteres, uno marino y otro crema",
// pero se lee igual de bien como "un suéter marino-y-crema". El generador tomó
// la segunda lectura y cosió las dos mitades.
//
// POR QUÉ IMPORTA MÁS ALLÁ DE LA IMAGEN
// La cápsula no es material de la prueba: es lo que el motor le va a decir a la
// IA que busque en el clóset de la persona. La misma frase ambigua puede
// hacerle buscar un jogger "negro y azul marino" que nadie tiene, en vez de
// aceptar el negro liso que sí está colgado.
//
// LA REGLA
// - Colores o cortes alternativos de la MISMA prenda → "o" ("marino o crema").
// - Prendas DISTINTAS metidas en un renglón → renglones separados.
//
// Uso: node scripts/desambiguar-capsulas.mjs
// Escribe en lib/engine/recetas/ y en docs_para_claude/recetas/.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

// `a` string = reemplazo; `a` arreglo = ese renglón se parte en varios.
const CAMBIOS = {
  "casual-limpio": [
    { de: "Playera negra lisa (a talla y oversize)", a: "Playera negra lisa (a talla u oversize)" },
    { de: "Pantalón de pinza crema y negro", a: "Pantalón de pinza, en crema o en negro" },
  ],
  "clasico-arreglado": [
    { de: "Cinturón de piel fino café y negro", a: "Cinturón de piel fino, café o negro" },
  ],
  deportivo: [
    { de: "Playera de algodón lisa en blanco, negro y azul marino", a: "Playera de algodón lisa, en blanco, negro o azul marino" },
    { de: "Sudadera con capucha en gris, negro y azul marino", a: "Sudadera con capucha, en gris, negro o azul marino" },
    { de: "Jogger entallado negro y azul marino", a: "Jogger entallado, negro o azul marino" },
    { de: "Pants amplio en gris oscuro y negro", a: "Pants amplio, en gris oscuro o negro" },
    { de: "Short deportivo en negro, azul marino y gris", a: "Short deportivo, en negro, azul marino o gris" },
    { de: "Tenis de correr en blanco, gris y negro/blanco", a: "Tenis de correr, en blanco, en gris o en negro con blanco" },
    { de: "Riñonera cruzada negra y gorro de punto", a: ["Riñonera cruzada negra", "Gorro de punto"] },
  ],
  preppy: [
    { de: "Polo de punto o piqué en verde y azul", a: "Polo de punto o piqué, en verde o en azul" },
    { de: "Suéter de ochos azul marino y crema", a: ["Suéter de ochos azul marino", "Suéter de ochos crema"] },
    { de: "Short chino caqui y short blanco", a: ["Short chino caqui", "Short blanco"] },
    { de: "Mocasín penny café y náutico café", a: ["Mocasín penny café", "Náutico café"] },
  ],
  "street-urbano": [
    { de: "Gorra béisbol y beanie", a: ["Gorra de béisbol", "Beanie"] },
  ],
  "thrift-vintage": [
    { de: "Jean azul medio y azul oscuro de corte ancho", a: "Jean de corte ancho, azul medio o azul oscuro" },
    { de: "Camiseta blanca lisa y de estampado gráfico", a: ["Camiseta blanca lisa", "Camiseta de estampado gráfico"] },
  ],
};

const DESTINOS = ["lib/engine/recetas", "docs_para_claude/recetas"];
let tocados = 0;

for (const [familia, cambios] of Object.entries(CAMBIOS)) {
  for (const dir of DESTINOS) {
    const ruta = `${dir}/${familia}.json`;
    if (!existsSync(ruta)) continue;
    const json = JSON.parse(readFileSync(ruta, "utf8"));

    json.receta.capsula = json.receta.capsula.flatMap((linea) => {
      const cambio = cambios.find((c) => c.de === linea);
      if (!cambio) return [linea];
      tocados++;
      return Array.isArray(cambio.a) ? cambio.a : [cambio.a];
    });

    writeFileSync(ruta, JSON.stringify(json, null, 2) + "\n");
  }
  // Cada cambio debe encontrar su renglón en cada destino; si no, el texto
  // cambió desde que se escribió esta tabla y el arreglo se aplicó a medias.
  console.log(`${familia}: ${cambios.length} renglones`);
}

const esperados = Object.values(CAMBIOS).flat().length * DESTINOS.length;
console.log(tocados === esperados ? `\nOK — ${tocados} aplicados` : `\nOJO: ${tocados} de ${esperados}`);
