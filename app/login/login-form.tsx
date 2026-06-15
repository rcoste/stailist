"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";
import { Spinner } from "@/components/spinner";

const INITIAL: LoginState = { status: "idle" };

export function LoginForm({ linkError = false }: { linkError?: boolean }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, INITIAL);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
        <h2 className="text-h3 font-semibold text-ink">Revisa tu correo ✉️</h2>
        <p className="text-base text-ink">
          Te mandé un link a <span className="font-medium">{state.email}</span>.
          Un tap y estás dentro — sin contraseñas.
        </p>
        <form action={formAction}>
          <input type="hidden" name="email" value={state.email} />
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 w-full rounded-full border border-line bg-surface text-base font-medium text-ink transition-colors duration-200 hover:border-ink disabled:opacity-50"
          >
            {pending ? "Reenviando…" : "¿No llegó? Reenviar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]"
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
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          className="min-h-12 rounded-lg border border-line bg-surface px-4 text-base text-ink outline-none transition-colors duration-200 placeholder:text-muted focus:border-accent"
        />
      </div>

      {linkError && state.status === "idle" && (
        <p className="text-sm text-error">
          Ese link ya caducó o no funcionó. Pide uno nuevo aquí abajo.
        </p>
      )}
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
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
      >
        {pending ? (
          <>
            <Spinner className="h-4 w-4" />
            Mandando…
          </>
        ) : (
          "Mándame el link"
        )}
      </button>
    </form>
  );
}
