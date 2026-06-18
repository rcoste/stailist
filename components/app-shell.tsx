import { Logo } from "./logo";
import { TabBar } from "./tab-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-bg">
      <header className="flex items-center justify-center px-4 pt-4 pb-2">
        <Logo className="h-7" />
      </header>
      <main className="px-4 pb-28">{children}</main>
      <TabBar />
    </div>
  );
}
