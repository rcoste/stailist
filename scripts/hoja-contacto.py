#!/usr/bin/env python3
"""Arma hojas de contacto de una carpeta de referencias.

Sirve para dos cosas distintas y por eso numera cada celda: para leer los
patrones de un estilo de un vistazo, y para que un humano pueda decir "la 07
no va" sin tener que abrir archivos uno por uno.

Uso: python3 scripts/hoja-contacto.py <carpeta> <salida-sin-extension> [por_hoja]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

CELDA_W, CELDA_H = 300, 420
COLS = 5
MARGEN = 6
BANDA = 22  # franja inferior con el número de celda

carpeta = Path(sys.argv[1])
salida = sys.argv[2]
por_hoja = int(sys.argv[3]) if len(sys.argv) > 3 else 20

fotos = sorted([p for p in carpeta.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png")])
if not fotos:
    print(f"sin fotos en {carpeta}")
    sys.exit(1)

hojas = [fotos[i:i + por_hoja] for i in range(0, len(fotos), por_hoja)]
for n, lote in enumerate(hojas, 1):
    filas = (len(lote) + COLS - 1) // COLS
    ancho = COLS * (CELDA_W + MARGEN) + MARGEN
    alto = filas * (CELDA_H + BANDA + MARGEN) + MARGEN
    hoja = Image.new("RGB", (ancho, alto), (245, 245, 243))
    dibujo = ImageDraw.Draw(hoja)

    for i, foto in enumerate(lote):
        col, fila = i % COLS, i // COLS
        x = MARGEN + col * (CELDA_W + MARGEN)
        y = MARGEN + fila * (CELDA_H + BANDA + MARGEN)
        try:
            im = Image.open(foto).convert("RGB")
        except Exception:
            continue
        # Recorte centrado que llena la celda: comparar siluetas exige que todas
        # las fotos ocupen el mismo rectángulo, no que floten con bordes.
        escala = max(CELDA_W / im.width, CELDA_H / im.height)
        im = im.resize((int(im.width * escala), int(im.height * escala)), Image.LANCZOS)
        izq = (im.width - CELDA_W) // 2
        arriba = (im.height - CELDA_H) // 2
        hoja.paste(im.crop((izq, arriba, izq + CELDA_W, arriba + CELDA_H)), (x, y))
        etiqueta = f"{(n - 1) * por_hoja + i + 1:02d}  {foto.stem}"
        dibujo.rectangle([x, y + CELDA_H, x + CELDA_W, y + CELDA_H + BANDA], fill=(30, 30, 30))
        dibujo.text((x + 6, y + CELDA_H + 5), etiqueta, fill=(255, 255, 255))

    destino = f"{salida}-{n}.jpg"
    hoja.save(destino, quality=88)
    print(destino, hoja.size, f"({len(lote)} fotos)")
