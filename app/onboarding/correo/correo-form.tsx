"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { pedirCodigo, verificarCodigo, type CorreoState } from "./actions";

// El correo y su código, en la misma pantalla. Mismo patrón que /login, con una
// diferencia: aquí la persona ya invirtió varios minutos, así que el texto dice
// para qué sirve el correo (guardar lo que ya hizo) y no "regístrate".
export function CorreoForm() {
  const [pedido, pedir, pidiendo] = useActionState<CorreoState, FormData>(pedirCodigo, { status: "idle" });
  const [verificado, verificar, verificando] = useActionState<CorreoState, FormData>(verificarCodigo, {
    status: "idle",
  });
  const [correo, setCorreo] = useState("");

  if (pedido.status === "sent") {
    return (
      <Codigo
        email={pedido.email}
        aviso={verificado.status === "sent" ? (verificado.message ?? null) : null}
        verificar={verificar}
        verificando={verificando}
        pedir={pedir}
        pidiendo={pidiendo}
      />
    );
  }

  return (
    <form action={pedir} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        autoFocus
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder="tu correo"
        aria-label="Tu correo"
        className="min-h-14 rounded-sm border border-line bg-surface px-4 text-[17px] text-ink outline-none transition-colors duration-200 placeholder:text-muted focus:border-accent"
      />
      {pedido.status === "error" ? <p className="text-sm text-error">{pedido.message}</p> : null}
      <button
        type="submit"
        disabled={pidiendo}
        className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
      >
        {pidiendo ? (
          <>
            <Spinner className="h-4 w-4" /> mandando…
          </>
        ) : (
          <>
            mándame el código <Icon name="flecha" size={19} />
          </>
        )}
      </button>
      <p className="text-center text-[13px] leading-snug text-muted">
        sin contraseña. al seguir aceptas los{" "}
        <a href="/terminos" target="_blank" className="underline underline-offset-2">
          términos
        </a>{" "}
        y el{" "}
        <a href="/privacidad" target="_blank" className="underline underline-offset-2">
          aviso de privacidad
        </a>
        .
      </p>
    </form>
  );
}

// El paso del código. Componente aparte para que la cuenta regresiva de
// "reenviar" nazca en 60 al montarse (mismo patrón que app/login/login-form.tsx).
function Codigo({
  email,
  aviso,
  verificar,
  verificando,
  pedir,
  pidiendo,
}: {
  email: string;
  aviso: string | null;
  verificar: (f: FormData) => void;
  verificando: boolean;
  pedir: (f: FormData) => void;
  pidiendo: boolean;
}) {
  const [resta, setResta] = useState(60);
  const estabaPidiendo = useRef(pidiendo);
  useEffect(() => {
    if (resta <= 0) return;
    const t = setTimeout(() => setResta((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resta]);
  // Cuando un reenvío termina (pidiendo true → false), reinicia la cuenta.
  useEffect(() => {
    if (estabaPidiendo.current && !pidiendo) setResta(60);
    estabaPidiendo.current = pidiendo;
  }, [pidiendo]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] leading-snug text-muted">
        Te mandé un código de 6 dígitos a <span className="font-semibold text-ink">{email}</span>. ¿No lo ves? Revisa
        tu carpeta de correo no deseado (spam).
      </p>
      <form action={verificar} className="flex flex-col gap-3">
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
        {aviso ? <p className="text-sm text-error">{aviso}</p> : null}
        <button
          type="submit"
          disabled={verificando}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {verificando ? (
            <>
              <Spinner className="h-4 w-4" /> validando…
            </>
          ) : (
            <>
              guardar y armar mi look <Icon name="destello" size={18} />
            </>
          )}
        </button>
      </form>
      <form action={pedir}>
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={pidiendo || resta > 0}
          className="min-h-11 w-full text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {pidiendo ? "reenviando…" : resta > 0 ? `reenviar en ${resta}s` : "¿no llegó? reenviar"}
        </button>
      </form>
    </div>
  );
}
