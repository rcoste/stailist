import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";
import { devLogin } from "./dev-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center gap-8 bg-bg px-4 pb-16">
      <header className="flex flex-col items-center gap-6">
        <Logo className="h-10" />
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-display font-semibold text-ink">
            Vamos a vestirte increíble.
          </h1>
          <p className="text-base text-muted">
            Tu stylist personal — un look listo para tu día en menos de 2
            minutos.
          </p>
        </div>
      </header>

      <LoginForm linkError={error === "link"} />

      {isDev && (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-surface/50 p-4">
          <p className="text-center text-xs font-medium uppercase tracking-wide text-muted">
            Acceso rápido · solo local
          </p>
          {error === "dev" && (
            <p className="text-center text-sm text-error">
              No pude entrar — ¿corriste el setup de usuarios de prueba?
            </p>
          )}
          <div className="flex gap-3">
            <form action={devLogin} className="flex-1">
              <input
                type="hidden"
                name="email"
                value="roberto.dev@stailist.app"
              />
              <button
                type="submit"
                className="min-h-12 w-full rounded-full border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
              >
                Entrar como Roberto
              </button>
            </form>
            <form action={devLogin} className="flex-1">
              <input
                type="hidden"
                name="email"
                value="claude.dev@stailist.app"
              />
              <button
                type="submit"
                className="min-h-12 w-full rounded-full border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
              >
                Entrar como Claude
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
