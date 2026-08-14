// Loading boundary del detalle de usuario: la página firma URLs de TODO su
// clóset + outfits y tarda segundos — sin esto, picarle a la fila del listado
// no mostraba nada hasta que llegaba el server y se leía como "no reaccionó"
// (Roberto, 2026-08-13). Next lo pinta al instante al navegar.
export default function Loading() {
  return (
    <div className="flex flex-col gap-2 py-10 text-center">
      {/* shimmer-txt (DESIGN.md): el token del DS para etiquetas de carga
          cortas. Sin movimiento, una espera de segundos se lee como una
          página que ya cargó y salió vacía. */}
      <p className="shimmer-txt text-sm font-medium">abriendo el perfil…</p>
      <p className="text-xs text-muted">
        cargando su clóset y sus looks — un momento.
      </p>
    </div>
  );
}
