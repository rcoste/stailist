import { PREGUNTAS_FRECUENTES } from "@/lib/ficha-publica";
import styles from "./landing.module.css";

// LAS PREGUNTAS FRECUENTES DE LA LANDING. El texto vive en lib/ficha-publica.ts
// porque es el mismo que leen los buscadores y los asistentes de IA (JSON-LD y
// /llms.txt): aquí sólo se pinta.
//
// <details> nativo a propósito: se abre sin JavaScript, lo entiende un lector de
// pantalla, y las respuestas están en el HTML aunque estén cerradas (un
// asistente que lee la página las ve todas).
export function PreguntasFrecuentes() {
  return (
    <div className={styles.faq}>
      {PREGUNTAS_FRECUENTES.map((f) => (
        <details key={f.pregunta} className={styles.faqItem}>
          <summary className={styles.faqQ}>{f.pregunta}</summary>
          <p className={styles.faqA}>{f.respuesta}</p>
        </details>
      ))}
    </div>
  );
}
