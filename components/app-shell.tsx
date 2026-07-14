import Link from "next/link";
import { Logo } from "./logo";
import { TabBar } from "./tab-bar";
import { DesktopHeader } from "./desktop-header";
import { Icon } from "./icon";

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
export function AppShell({
  children,
  hideTabBar = false,
  desktop = "column",
}: {
  children: React.ReactNode;
  hideTabBar?: boolean;
  desktop?: "column" | "wide";
}) {
  return (
    <div className="min-h-dvh bg-bg lg:bg-surface">
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
          <Logo className="h-7" />
          <Link
            href="/perfil"
            aria-label="Tu perfil"
            className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors duration-200 hover:text-ink"
          >
            <Icon name="persona" size={18} />
          </Link>
        </header>
        <main
          className={`${hideTabBar ? "px-4 pb-32" : "px-4 pb-28"} lg:px-6 lg:pb-16 lg:pt-4`}
        >
          {children}
        </main>
        {hideTabBar ? null : <TabBar />}
      </div>
    </div>
  );
}
