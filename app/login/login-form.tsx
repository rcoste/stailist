"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  sendCode,
  verifyCode,
  type LoginState,
  type VerifyState,
} from "./actions";
import { Spinner } from "@/components/spinner";

const SEND_INITIAL: LoginState = { status: "idle" };

export function LoginForm({ prefillEmail }: { prefillEmail?: string | null }) {
  const [state, sendAction, sending] = useActionState(sendCode, SEND_INITIAL);

  if (state.status === "sent") {
    return (
      <CodeForm email={state.email} resendAction={sendAction} resending={sending} />
    );
  }

  return (
    <form
      action={sendAction}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Tu correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={prefillEmail ?? undefined}
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          className="min-h-12 rounded-sm border border-line bg-surface px-4 text-base text-ink outline-none transition-colors duration-200 placeholder:text-muted focus:border-accent"
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-error">{state.message}</p>
      )}
      {state.status === "not_allowed" && (
        <p className="text-sm text-ink">
          Por ahora la beta es por invitación. ¿Quieres entrar? Pídele tu lugar
          a Roberto.
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
      >
        {sending ? (
          <>
            <Spinner className="h-4 w-4" />
            Mandando…
          </>
        ) : (
          "Mándame el código"
        )}
      </button>
    </form>
  );
}

const VERIFY_INITIAL = (email: string): VerifyState => ({
  status: "idle",
  email,
});

function CodeForm({
  email,
  resendAction,
  resending,
}: {
  email: string;
  resendAction: (formData: FormData) => void;
  resending: boolean;
}) {
  const [state, verifyAction, verifying] = useActionState(
    verifyCode,
    VERIFY_INITIAL(email)
  );

  // Cooldown de 60s para reenviar — espeja el límite del server (1 envío por
  // correo cada 60s) para que el usuario no tape el botón y choque con el error.
  const [secondsLeft, setSecondsLeft] = useState(60);
  const wasResending = useRef(resending);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // Cuando un reenvío termina (resending true → false), reinicia el cooldown.
  useEffect(() => {
    if (wasResending.current && !resending) setSecondsLeft(60);
    wasResending.current = resending;
  }, [resending]);

  const canResend = !resending && secondsLeft <= 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-semibold text-ink">Revisa tu correo</h2>
        <p className="text-base text-muted">
          Te mandé un código de 6 dígitos a{" "}
          <span className="font-medium text-ink">{email}</span>. Tecléalo aquí.
        </p>
      </div>

      <form action={verifyAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]*"
          required
          autoFocus
          placeholder="••••••"
          aria-label="Código de 6 dígitos"
          className="min-h-14 rounded-sm border border-line bg-surface text-center text-2xl font-semibold tracking-[0.4em] text-ink tabular outline-none transition-colors duration-200 placeholder:tracking-[0.3em] placeholder:text-muted focus:border-accent"
        />

        {state.status === "error" && (
          <p className="text-sm text-error">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={verifying}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          {verifying ? (
            <>
              <Spinner className="h-4 w-4" />
              Validando…
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        ¿No lo ves? Revisa tu carpeta de correo no deseado (spam).
      </p>

      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={!canResend}
          className="min-h-12 w-full rounded-sm border border-line bg-surface text-base font-medium text-ink transition-colors duration-200 hover:border-ink disabled:opacity-50 disabled:hover:border-line"
        >
          {resending
            ? "Reenviando…"
            : secondsLeft > 0
              ? `Reenviar en ${secondsLeft}s`
              : "¿No llegó? Reenviar"}
        </button>
      </form>
    </div>
  );
}
