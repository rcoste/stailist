"use client";

import { useState } from "react";
import styles from "./landing.module.css";

// Demo interactivo del paso 4: la tarjeta "en ti" muestra a la modelo con su ropa
// normal; al tocar "pruébatelo" hace crossfade a la misma modelo con el outfit
// propuesto puesto. Es el try-on del producto, demostrado en vivo en el landing.
export function TryDemo() {
  const [tried, setTried] = useState(false);
  return (
    <div className={styles.tryCard}>
      <div className={styles.tryShot}>
        <span className={styles.tryTag}>en ti</span>
        <img
          src="/landing/b1-normal.png"
          alt="La modelo con su ropa"
          className={styles.tdImg}
          style={{ opacity: tried ? 0 : 1 }}
        />
        <img
          src="/landing/b1-tryon.png"
          alt="La modelo con el outfit propuesto"
          className={styles.tdImg}
          style={{ opacity: tried ? 1 : 0 }}
        />
        <button
          type="button"
          className={styles.tdBtn}
          onClick={() => setTried((t) => !t)}
          aria-pressed={tried}
        >
          {tried ? "ver original" : "pruébatelo ✨"}
        </button>
      </div>
    </div>
  );
}
