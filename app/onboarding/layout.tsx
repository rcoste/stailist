import { Logo } from "@/components/logo";

// Cascarón del onboarding: sin tabs (todavía no hay a dónde ir), logo arriba,
// columna única móvil-first como el resto de la app.
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg">
      <header className="flex items-center justify-center px-4 pt-6 pb-2">
        <Logo className="h-8" />
      </header>
      <main className="flex flex-1 flex-col px-4 pb-8">{children}</main>
    </div>
  );
}
