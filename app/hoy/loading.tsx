import { Spinner } from "@/components/spinner";

// El home tarda ~2 s en servidor (perfil + último look + clima + checklist).
// Sin esto la persona se quedaba con la pantalla anterior congelada y sin señal
// de que algo pasa — el patrón que hace creer que la app se trabó.
//
// A propósito NO usa GeneratingScreen: esas frases anuncian que el stylist está
// PENSANDO, y aquí sólo se están leyendo datos. Prometer generación y entregar
// una lista es la clase de mentira pequeña que erosiona el resto.
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
