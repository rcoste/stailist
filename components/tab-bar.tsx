"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/hoy", label: "Hoy", icon: "sol" },
  { href: "/closet", label: "Clóset", icon: "gancho" },
  { href: "/historial", label: "Historial", icon: "reloj" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-3">
        {TABS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors duration-200 ${
                active ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              <Icon name={icon} active={active} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
