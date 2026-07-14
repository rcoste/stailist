// Avisa que la usuaria acaba de dar un 👍 — el pico emocional donde ofrecemos
// instalar la PWA. El componente <PwaInstall/> escucha esto y decide si mostrar
// el prompt (solo una vez, ver components/pwa-install.tsx).
export function notifyFirstLike() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("stailist:first-like"));
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
