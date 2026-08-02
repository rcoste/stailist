#!/usr/bin/env python3
"""Compara, por estilo, las referencias reales contra lo reconstruido del recetario.

La pregunta que responde de un vistazo: ¿lo generado SOLO CON EL TEXTO se ve
como las fotos de las que salió ese texto? Si sí, la destilación capturó el
estilo. Si no, está mal y hay que arreglarla antes de que llegue al motor.

Las dos filas van juntas y etiquetadas a propósito: separadas en dos imágenes,
el ojo compara contra el recuerdo en vez de contra la referencia.

Uso: python3 scripts/hoja-comparativa.py <estilo> <salida.jpg>
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

CELDA_W, CELDA_H = 320, 440
MARGEN = 8
BANDA = 30

estilo = sys.argv[1]
salida = sys.argv[2]

refs = sorted(Path(f"docs_para_claude/cosecha-hombre/{estilo}").glob("*.jpg"))[:4]
gens = sorted(Path("/tmp/recetario-prueba").glob(f"{estilo}-*.png"))

if not refs or not gens:
    print(f"faltan imágenes para {estilo}: {len(refs)} refs, {len(gens)} generadas")
    sys.exit(1)

cols = max(len(refs), len(gens))
ancho = cols * (CELDA_W + MARGEN) + MARGEN
alto = 2 * (CELDA_H + BANDA + MARGEN) + MARGEN + 10
hoja = Image.new("RGB", (ancho, alto), (245, 245, 243))
dibujo = ImageDraw.Draw(hoja)


def fila(imgs, y, etiqueta, color):
    dibujo.rectangle([MARGEN, y, ancho - MARGEN, y + BANDA - 4], fill=color)
    dibujo.text((MARGEN + 8, y + 8), etiqueta, fill=(255, 255, 255))
    for i, ruta in enumerate(imgs):
        x = MARGEN + i * (CELDA_W + MARGEN)
        im = Image.open(ruta).convert("RGB")
        escala = max(CELDA_W / im.width, CELDA_H / im.height)
        im = im.resize((int(im.width * escala), int(im.height * escala)), Image.LANCZOS)
        izq = (im.width - CELDA_W) // 2
        arriba = (im.height - CELDA_H) // 2
        hoja.paste(im.crop((izq, arriba, izq + CELDA_W, arriba + CELDA_H)), (x, y + BANDA))


fila(refs, MARGEN, f"REFERENCIAS REALES — {estilo} (las fotos que curaste)", (40, 40, 40))
fila(
    gens,
    MARGEN + CELDA_H + BANDA + MARGEN + 10,
    "RECONSTRUIDO SOLO CON EL TEXTO DEL RECETARIO (sin ver las fotos)",
    (114, 47, 55),
)

hoja.save(salida, quality=90)
print(salida, hoja.size)
