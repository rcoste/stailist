import Link from "next/link";
import { Logo } from "./logo";
import { TabBar } from "./tab-bar";
import { DesktopHeader } from "./desktop-header";
import { Icon } from "./icon";
import { VersionNueva } from "./version-nueva";
import { loadNavState } from "@/lib/trip-context";

// hideTabBar: pantallas con una barra fija de acción abajo (Biblioteca,
// cuestionario). La nota crítica del handoff es que el CTA inferior y la tab bar
// NO deben coexistir — ahí se oculta la tab bar y la página pone su propia barra.
//
// desktop (plan desktop-full, F1): en lg+ la tab bar se oculta y aparece el
// DesktopHeader. El contenido:
//  - "column" (default): la columna móvil centrada y ENMARCADA (hairline +
//    laterales bg-surface) — el "escaparate". Toda página se ve intencional
//    sin migrarse.
//  - "wide": contenedor ancho (max-w-5xl); la página controla su layout con lg:.
//
// back / accion (patrón de PANTALLA INTERNA, 2026-08-13): una pantalla a la que
// se entra desde otra —tus esenciales, la biblioteca— pone su vuelta a la
// ALTURA DEL WORDMARK, flotando a la izquierda, y su menú a la derecha en el
// sitio del perfil.
//
// Por qué, y es espacio medido: esas pantallas repetían una cinta propia debajo
// del header con el back y el "···", ~50px que no llevaban contenido, justo
// bajo los ~52px del header. El wordmark está centrado, así que las dos
// esquinas estaban libres. El precedente ya vivía en la app: el detalle del
// historial sustituye el wordmark por "‹ historial".
//
// El perfil cede su sitio a propósito: dentro de una sección no se necesita, y
// vuelve solo con dar atrás. Si la pantalla no manda `accion`, el perfil se
// queda donde siempre.
export async function AppShell({
  children,
  hideTabBar = false,
  desktop = "column",
  back,
  accion,
}: {
  children: React.ReactNode;
  hideTabBar?: boolean;
  desktop?: "column" | "wide";
  /** A dónde vuelve esta pantalla. La etiqueta dice el destino ("clóset"), no
   *  "atrás": saber a dónde vas es la mitad del valor de un back. */
  back?: { href: string; label: string };
  /** El control de la esquina derecha (el menú "···" de la pantalla). Sustituye
   *  al acceso a perfil mientras estás dentro. */
  accion?: React.ReactNode;
}) {
  // La tab bar necesita saber quién eres (hoja de añadir) y si traes viaje vivo
  // (aviso en "Más"). Solo se pide cuando la barra se va a pintar.
  const nav = hideTabBar ? null : await loadNavState();
  return (
    <div className="min-h-dvh bg-bg lg:bg-surface">
      {/* Arriba del todo y en TODA pantalla: el aviso sirve para saber que lo
          que estás probando es lo que se desplegó. Ver components/version-nueva. */}
      <VersionNueva />
      <DesktopHeader />
      <div
        className={`mx-auto min-h-dvh w-full bg-bg lg:min-h-[calc(100dvh-3.5rem)] ${
          desktop === "wide"
            ? "max-w-[430px] lg:max-w-5xl"
            : "max-w-[430px] lg:border-x lg:border-line"
        }`}
      >
        {/* Header móvil (logo centrado + perfil). En desktop lo sustituye el
            DesktopHeader de arriba. */}
        <header className="relative flex items-center justify-center px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
          {/* Chevron + etiqueta, no un circulito: el circulito ahorra pixeles y
              pierde lo único que importa aquí, que es a DÓNDE vuelves. */}
          {back ? (
            <Link
              href={back.href}
              className="absolute left-4 flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-200 hover:text-ink"
            >
              <Icon name="chevron" size={15} rotate={180} />
              {back.label}
            </Link>
          ) : null}
          <Logo className="h-7" />
          {/* La esquina derecha: el menú de la pantalla si lo hay, y si no, el
              perfil de siempre. Misma caja de 36px en los dos casos, para que
              la fila no cambie de altura entre pantallas. */}
          {accion ? (
            <div className="absolute right-4 flex h-9 w-9 items-center justify-center">
              {accion}
            </div>
          ) : (
            <Link
              href="/perfil"
              aria-label="Tu perfil"
              className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors duration-200 hover:text-ink"
            >
              <Icon name="persona" size={18} />
            </Link>
          )}
        </header>
        <main
          className={`${hideTabBar ? "px-4 pb-32" : "px-4 pb-28"} lg:px-6 lg:pb-16 lg:pt-4`}
        >
          {children}
        </main>
        {hideTabBar || !nav ? null : <TabBar userId={nav.userId} trip={nav.trip} />}
      </div>
    </div>
  );
}
