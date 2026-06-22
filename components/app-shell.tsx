import Link from "next/link";
import { Logo } from "./logo";
import { TabBar } from "./tab-bar";
import { Icon } from "./icon";

// hideTabBar: pantallas con una barra fija de acción abajo (Biblioteca,
// cuestionario). La nota crítica del handoff es que el CTA inferior y la tab bar
// NO deben coexistir — ahí se oculta la tab bar y la página pone su propia barra.
export function AppShell({
  children,
  hideTabBar = false,
}: {
  children: React.ReactNode;
  hideTabBar?: boolean;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-bg">
      {/* Logo centrado; Perfil salió de la barra inferior a este ícono. */}
      <header className="relative flex items-center justify-center px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo className="h-7" />
        <Link
          href="/perfil"
          aria-label="Tu perfil"
          className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors duration-200 hover:text-ink"
        >
          <Icon name="persona" size={18} />
        </Link>
      </header>
      <main className={hideTabBar ? "px-4 pb-32" : "px-4 pb-28"}>{children}</main>
      {hideTabBar ? null : <TabBar />}
    </div>
  );
}
