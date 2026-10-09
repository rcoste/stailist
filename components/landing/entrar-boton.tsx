import type { ReactNode } from "react";
import { entradaSinCorreo } from "@/lib/borrador";
import styles from "./landing.module.css";
import { FormEmpezar } from "./form-empezar";

type Props = {
  /** Texto fino opcional bajo el botón. */
  fineline?: ReactNode;
  /** La trust line con puntos (solo en el hero). */
  trust?: boolean;
};

// LA PUERTA DE LA LANDING: UN BOTÓN, SIN CAMPO DE CORREO (2026-09-23).
//
// Hasta hoy aquí había un campo de correo. Nació con la lista de espera (te
// anotaba en una tabla) y desde la apertura (B5, 2026-09-06) sólo pre-llenaba
// el login. Ese pre-llenado costaba más de lo que daba: era el ÚNICO campo de
// correo dentro de la zona con etiquetas de anuncios, y por él hubo que
// construir la tubería de sessionStorage, prohibir el correo en la URL y
// apagar la captura de formularios de Google y TikTok. Sin el campo, el correo
// se teclea una sola vez, en /login, que está fuera de la zona medida.
//
// Es un <a>, no un botón con router, a propósito: salir de la zona medida
// tiene que ser navegación completa para que las etiquetas se suelten
// (components/tags-publicidad.tsx intercepta los links por lo mismo), y un
// link lo es siempre, con o sin etiquetas.
//
// DESDE EL 2026-10-02 (con NEXT_PUBLIC_ENTRADA_SIN_CORREO=1) el botón ya no
// lleva a /login: abre un borrador y entra directo al onboarding; el correo se
// pide antes del primer look (lib/borrador.ts). Es un <form> con POST y no un
// link: un GET que crea cuentas lo dispara cualquier buscador. Un POST también
// es navegación completa, así que las etiquetas se sueltan igual.
export function EntrarBoton({ fineline, trust }: Props) {
  const sinCorreo = entradaSinCorreo();
  return (
    <div className={styles.cta}>
      {sinCorreo ? (
        <FormEmpezar formClassName={styles.ctaForm} buttonClassName={`${styles.btn} ${styles.btnSolo}`}>
          Armar mi primer look
          <span className={styles.arr} aria-hidden="true">
            &rarr;
          </span>
        </FormEmpezar>
      ) : (
        <a className={`${styles.btn} ${styles.btnSolo}`} href="/login">
          Armar mi primer look
          <span className={styles.arr} aria-hidden="true">
            &rarr;
          </span>
        </a>
      )}

      {trust && (
        <div className={styles.trust}>
          <span>{sinCorreo ? "sin registro para empezar" : "sin contraseña"}</span>
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
