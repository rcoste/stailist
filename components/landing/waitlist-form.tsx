"use client";

import { useId, useRef, useState, useTransition } from "react";
import { joinWaitlist } from "./actions";
import styles from "./landing.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Props = {
  // De dónde salió el alta (hero vs CTA final) — se guarda en waitlist.source.
  source: string;
  // Texto fino opcional bajo el formulario (solo en el CTA final).
  fineline?: string;
  // La trust line con puntos (solo en el hero).
  trust?: boolean;
};

export function WaitlistForm({ source, fineline, trust }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const errId = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const val = email.trim();
    if (!EMAIL_RE.test(val)) {
      setError(true);
      setNetError(null);
      inputRef.current?.focus();
      return;
    }
    setError(false);
    const fd = new FormData();
    fd.set("email", val);
    fd.set("source", source);
    startTransition(async () => {
      const res = await joinWaitlist({ status: "idle" }, fd);
      if (res.status === "success") {
        setDone(res.email);
        setNetError(null);
      } else if (res.status === "error") {
        setNetError(res.message);
      }
    });
  }

  function reset() {
    setDone(null);
    setNetError(null);
    setError(false);
    setEmail("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (done) {
    return (
      <div className={styles.cta}>
        <div className={styles.done} role="status" aria-live="polite">
          <div className={styles.doneIco} aria-hidden="true">
            &#10003;
          </div>
          <h3>Te anoté en la lista.</h3>
          <p>
            Por ahora es beta privada — te aviso a{" "}
            <span className={styles.mail}>{done}</span> en cuanto haya cupo.
          </p>
          <button type="button" className={styles.reset} onClick={reset}>
            Usar otro correo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cta}>
      <form className={styles.field} onSubmit={submit} noValidate>
        <div className={styles.ctl}>
          <input
            ref={inputRef}
            className={`${styles.email}${error || netError ? ` ${styles.bad}` : ""}`}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu correo"
            aria-label="Tu correo"
            aria-invalid={error || !!netError}
            aria-describedby={error || netError ? errId : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(false);
              if (netError) setNetError(null);
            }}
          />
          <button className={styles.btn} type="submit" disabled={pending}>
            {pending ? "Anotándote…" : "Armar mi primer look"}
            {!pending && (
              <span className={styles.arr} aria-hidden="true">
                &rarr;
              </span>
            )}
          </button>
        </div>
        {(error || netError) && (
          <div className={styles.errmsg} id={errId}>
            {netError ?? "Mmm, ese correo no se ve bien. ¿Lo revisas?"}
          </div>
        )}
      </form>

      {trust && (
        <div className={styles.trust}>
          <span>Beta privada</span>
          <span className={styles.dot} />
          <span>solo por invitación</span>
          <span className={styles.dot} />
          <span>español</span>
        </div>
      )}

      {fineline && <p className={styles.fineline}>{fineline}</p>}
    </div>
  );
}
