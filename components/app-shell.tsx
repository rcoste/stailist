import Link from "next/link";
import { Logo } from "./logo";
import { TabBar } from "./tab-bar";
import { Icon } from "./icon";

export function AppShell({ children }: { children: React.ReactNode }) {
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
      <main className="px-4 pb-28">{children}</main>
      <TabBar />
    </div>
  );
}
