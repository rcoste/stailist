// LO QUE SE VE MIENTRAS CARGA UNA PANTALLA DEL ADMIN (2026-10-12).
//
// Roberto: "no funciona el clic". Sí funcionaba: Actividad tardaba 4.7 s en
// pintar y en ese rato no pasaba NADA en pantalla, así que el clic parecía
// muerto y se volvía a picar. Con este archivo, Next enseña esto en el instante
// del clic, mientras el servidor arma la página.
export default function CargandoAdmin() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-7 w-40 animate-pulse rounded-sm bg-tile" />
      <p className="text-sm text-muted">cargando…</p>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-tile" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  );
}
