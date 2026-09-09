// Avisa que la usuaria acaba de dar un 👍 — el pico emocional donde ofrecemos
// instalar la PWA. El componente <PwaInstall/> escucha esto y decide si mostrar
// el prompt (solo una vez, ver components/pwa-install.tsx).
export function notifyFirstLike() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stailist:pwa-momento", { detail: "like" }));
  }
}

/**
 * EL SEGUNDO MOMENTO, y por qué hacía falta (2026-09-09).
 *
 * El prompt de instalar vivía SOLO tras el primer 👍 — "el pico emocional",
 * que como teoría está bien. El problema es que el 👍 casi no pasa: en toda la
 * vida del producto **9 personas** han dado al menos uno, de 24 que llegaron a
 * generar un look. A las otras 15 nunca se les ofreció instalar la app.
 *
 * Así que se AÑADE un segundo momento (no se quita el primero): cuando la
 * persona genera un look en /hoy, o sea ya fuera del onboarding. No se dispara
 * en el wow a propósito — ahí acaba de llegar y todavía no sabe si le sirve;
 * pedirle instalar es pedirle un compromiso antes del valor.
 *
 * El prompt sigue mostrándose UNA sola vez (flag en localStorage), así que
 * quien vota 👍 primero lo ve en su pico y no lo ve dos veces.
 */
export function notifyLookListo() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stailist:pwa-momento", { detail: "look" }));
  }
}

// Avisa que la usuaria acaba de marcar "me lo puse" — el momento más
// comprometido (usó un look en la vida real). <EmailOptIn/> lo escucha para
// ofrecer el correo semanal (una sola vez). Distinto del 👍 (que ofrece la PWA)
// para que nunca aparezcan dos prompts a la vez.
export function notifyWorn() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("stailist:worn"));
  }
}
