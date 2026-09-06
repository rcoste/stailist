"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./landing.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Props = {
  /** Texto fino opcional bajo el formulario (solo en el CTA final). */
  fineline?: string;
  /** La trust line con puntos (solo en el hero). */
  trust?: boolean;
};

// EL FORMULARIO DE LA LANDING, DESDE LA APERTURA (B5).
//
// Antes era la lista de espera: "Armar mi primer look" te anotaba en una tabla
// y te decía "por ahora es beta privada". Prometía un look y entregaba una
// waitlist. Ahora el correo va derecho al login, que manda el código. Mismo
// CSS que el formulario anterior: sólo cambia a dónde lleva.
export function EntrarForm({ fineline, trust }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errId = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const val = email.trim().toLowerCase();
    if (!EMAIL_RE.test(val)) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    router.push(`/login?email=${encodeURIComponent(val)}`);
  }

  return (
    <div className={styles.cta}>
      <form className={styles.field} onSubmit={submit} noValidate>
        <div className={styles.ctl}>
          <input
            ref={inputRef}
            className={`${styles.email}${error ? ` ${styles.bad}` : ""}`}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu correo"
            aria-label="Tu correo"
            aria-invalid={error}
            aria-describedby={error ? errId : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(false);
            }}
          />
          <button className={styles.btn} type="submit">
            Armar mi primer look
            <span className={styles.arr} aria-hidden="true">
              &rarr;
            </span>
          </button>
        </div>
        {error && (
          <div className={styles.errmsg} id={errId}>
            Mmm, ese correo no se ve bien. ¿Lo revisas?
          </div>
        )}
      </form>

      {trust && (
        <div className={styles.trust}>
          <span>sin contraseña</span>
          <span className={styles.dot} />
          <span>sin tarjeta</span>
          <span className={styles.dot} />
          <span>español</span>
        </div>
      )}

      {fineline && <p className={styles.fineline}>{fineline}</p>}
    </div>
  );
}
