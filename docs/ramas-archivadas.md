# Ramas archivadas — 2026-09-09

Trece ramas que `git branch --no-merged` seguía mostrando como pendientes
aunque su trabajo YA estaba en main: los PR se mergearon con squash, que
reescribe el commit, así que git no puede saber que el contenido llegó.

Costaban tiempo real: hoy `motor-v74` hizo dudar de si había trabajo del
motor sin shipear. Se borraron después de comprobar, una por una, que su
versión está en el CHANGELOG y que ninguna guarda un archivo que main no
tenga.

**Nada se perdió, y esto lo demuestra:** cada commit sigue existiendo. Para
recuperar cualquiera:

```bash
git fetch origin <sha> && git checkout -b rescate <sha>
```

| Rama | Último commit | Qué era | Dónde vive hoy |
|---|---|---|---|
| `claude/blissful-rubin-9338d4` | `d855b76` | borra la heurística de color muerta (`dominantColor`) | rehecha sobre main en v0.2.325.0 |
| `claude/gifted-mayer-fad8c7` | `85e4d4d` | feat(historial): rebrand v3 · detalle del look (back-view | PR #13 · el archivo sólo se renombró |
| `feat/cartera-fase3` | `e57e515` | docs(cartera): aterriza Fase 3 como Wishlist + try-on comb | el doc de main es idéntico |
| `herramienta-reset` | `ed2668b` | chore: herramienta para resetear el recorrido de un usuari | el script de main es idéntico |
| `momento-por-reloj` | `81bcebe` | fix: la ciudad del wizard se autocompleta, como en el viaj | CHANGELOG v0.2.248.1 |
| `motor-v74` | `9198005` | v0.2.296.0 motor(v74): la camiseta entra al piso de formal | CHANGELOG v0.2.296.0 · reglas idénticas |
| `rcoste/local-test` | `546c7f9` | Merge branch 'rcoste/drawer-mas-tiles' into rcoste/local-t | rama de pruebas local, sin nada propio |
| `origin/claude/gifted-mayer-fad8c7` | `85e4d4d` | feat(historial): rebrand v3 · detalle del look (back-view | copia remota de la de arriba |
| `origin/feat/trajes-negro-y-sastre-mujer` | `944611e` | chore: bump version and changelog (v0.2.250.1) | CHANGELOG v0.2.250.1 |
| `origin/header-pantalla-interna` | `282eb34` | chore: bump version and changelog (v0.2.238.1) | CHANGELOG v0.2.238.1 |
| `origin/observabilidad-ia` | `56a9388` | chore: bump version and changelog (v0.2.238.0) | CHANGELOG v0.2.238.0 |
| `origin/senal-de-oro` | `3465fcc` | chore: bump version and changelog (v0.2.238.2) | CHANGELOG v0.2.238.2 · senal-oro.ts idéntico |

## La que NO se borró

**`claude/laughing-mayer-d9999e`** (`fe44881`) sigue viva a propósito: trae un
glifo de camisa redibujado que **no está en main**, y el actual se pinta a 18 px
en "un día normal" —la primera pantalla de armar un look— donde el comentario
del arreglo dice que se lee como un vaso. Es una decisión visual y el veto de
diseño es de Roberto, así que la rama espera a que la vea.

Si decide que no, se borra igual que las demás: el commit queda anotado aquí.
