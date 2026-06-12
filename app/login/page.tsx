import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
    </div>
  );
}
