import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { isInviteToken } from "@/lib/invitacion";
import { LoginForm } from "./login-form";
import { devLogin } from "./dev-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = await searchParams;
  const isDev = process.env.NODE_ENV !== "production";

  // Deep-link de invitación: si el token es válido, resolvemos su correo para
  // pre-llenar el formulario (una llamada menos para el invitado). El token NO
  // autentica — solo pre-llena; el código sigue llegando al correo. La función
  // es SECURITY DEFINER porque el invitado llega sin sesión (ver migración 0083).
  let prefillEmail: string | null = null;
  if (isInviteToken(invite)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("email_for_invite", {
      check_token: invite,
    });
    if (typeof data === "string") prefillEmail = data;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center gap-8 bg-bg px-4 pb-16">
      <header className="flex flex-col items-center gap-6">
        <Logo className="h-10" />
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-display font-semibold text-ink">
            {prefillEmail ? "¡Estás dentro!" : "Vamos a vestirte increíble."}
          </h1>
          <p className="text-base text-muted">
            {prefillEmail
              ? "Confírmame tu correo y te mando el código para entrar."
              : "Tu stylist personal — un look listo para tu día, con la ropa que ya tienes."}
          </p>
        </div>
      </header>

      <LoginForm prefillEmail={prefillEmail} />

      {/* Antes de dar el correo, que se pueda leer qué se hace con él. */}
      <p className="text-center text-xs text-muted">
        al entrar aceptas los{" "}
        <a href="/terminos" className="underline hover:text-ink">términos</a> y el{" "}
        <a href="/privacidad" className="underline hover:text-ink">aviso de privacidad</a>.
      </p>

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
