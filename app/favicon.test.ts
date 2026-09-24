// EL FAVICON.ICO ENSEÑA EL GANCHO EN TODOS SUS TAMAÑOS.
//
// Hasta v0.2.339.0 estuvo roto en producción sin que nada lo notara: el de
// 16 px era un cuadro negro y los de 32 y 48 sólo enseñaban el destello. Se
// había rasterizado desde app/icon.svg, cuyo `transform-origin:center` el
// rasterizador ignoró y dejó los trazos fuera del cuadro. Los navegadores que
// usan el SVG se veían bien, así que a ojo nadie lo vio; Google usa el .ico
// junto a los resultados de búsqueda. Lo cazó el material del portafolio.
//
// Lo que se blinda: cada tamaño trae una buena cantidad de píxeles claros (el
// gancho blanco sobre fondo negro). Medido al arreglarlo: el roto tenía 0% /
// 0.4% / 0.5%; el bueno, 10.5% / 5.2% / 5.9%. El piso de 3% separa los dos.
//
// El de 16 px NO sale del icon-512 reducido: ahí el trazo de 2.6 queda gris y
// medio pixel de grueso. Sale de una versión con trazo de 4.4 hecha sólo para
// ese tamaño. Si se regenera el .ico, respetar eso.
//
// Sin dependencias: Node trae zlib, y un PNG RGBA de 8 bits se decodifica en
// unas líneas. Pillow guarda cada tamaño del .ico como PNG.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

type Imagen = { ancho: number; alto: number; rgba: Uint8Array };

function decodificarPng(buf: Buffer): Imagen {
  let p = 8;
  let ancho = 0;
  let alto = 0;
  let tipo = 0;
  const datos: Buffer[] = [];
  while (p < buf.length) {
    const largo = buf.readUInt32BE(p);
    const nombre = buf.toString("ascii", p + 4, p + 8);
    const cuerpo = buf.subarray(p + 8, p + 8 + largo);
    if (nombre === "IHDR") {
      ancho = cuerpo.readUInt32BE(0);
      alto = cuerpo.readUInt32BE(4);
      expect(cuerpo[8], "profundidad de 8 bits").toBe(8);
      tipo = cuerpo[9];
    }
    if (nombre === "IDAT") datos.push(cuerpo);
    p += 12 + largo;
  }
  const canales = tipo === 6 ? 4 : tipo === 2 ? 3 : 0;
  expect(canales, "PNG RGB o RGBA").toBeGreaterThan(0);
  const crudo = inflateSync(Buffer.concat(datos));
  const fila = ancho * canales;
  const out = new Uint8Array(ancho * alto * 4);
  const prev = new Uint8Array(fila);
  const cur = new Uint8Array(fila);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (fila + 1)];
    for (let x = 0; x < fila; x++) {
      const v = crudo[y * (fila + 1) + 1 + x];
      const a = x >= canales ? cur[x - canales] : 0;
      const b = prev[x];
      const c = x >= canales ? prev[x - canales] : 0;
      let pred = 0;
      if (filtro === 1) pred = a;
      else if (filtro === 2) pred = b;
      else if (filtro === 3) pred = (a + b) >> 1;
      else if (filtro === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = (v + pred) & 0xff;
    }
    for (let x = 0; x < ancho; x++) {
      const o = (y * ancho + x) * 4;
      out[o] = cur[x * canales];
      out[o + 1] = cur[x * canales + 1];
      out[o + 2] = cur[x * canales + 2];
      out[o + 3] = canales === 4 ? cur[x * canales + 3] : 255;
    }
    prev.set(cur);
  }
  return { ancho, alto, rgba: out };
}

function tamanosDelIco(ico: Buffer): Imagen[] {
  expect(ico.readUInt16LE(2), "es un .ico").toBe(1);
  const n = ico.readUInt16LE(4);
  const imgs: Imagen[] = [];
  for (let i = 0; i < n; i++) {
    const e = 6 + 16 * i;
    const size = ico.readUInt32LE(e + 8);
    const off = ico.readUInt32LE(e + 12);
    const datos = ico.subarray(off, off + size);
    expect(datos.subarray(0, 4).toString("hex"), "cada tamaño guardado como PNG").toBe("89504e47");
    imgs.push(decodificarPng(datos));
  }
  return imgs;
}

function fraccionClara(img: Imagen): number {
  let claros = 0;
  for (let i = 0; i < img.rgba.length; i += 4) {
    const [r, g, b, a] = [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], img.rgba[i + 3]];
    if (a > 128 && (r + g + b) / 3 > 150) claros++;
  }
  return claros / (img.ancho * img.alto);
}

// Se lee dentro de cada test y no al cargar el archivo: si el .ico se rompe,
// tiene que salir como test en rojo con su mensaje, no como error de carga.
const cargar = () => tamanosDelIco(readFileSync(join(import.meta.dirname, "favicon.ico")));

describe("app/favicon.ico", () => {
  it("trae 16, 32 y 48 px", () => {
    expect(cargar().map((i) => i.ancho).sort((a, b) => a - b)).toEqual([16, 32, 48]);
  });

  it.each([16, 32, 48])("a %i px el gancho se ve: al menos 3%% de píxeles claros", (s) => {
    const img = cargar().find((i) => i.ancho === s);
    expect(img, `falta el tamaño de ${s} px`).toBeDefined();
    expect(fraccionClara(img!)).toBeGreaterThan(0.03);
  });
});
