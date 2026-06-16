// Avisa que la usuaria acaba de dar un 👍 — el pico emocional donde ofrecemos
// instalar la PWA. El componente <PwaInstall/> escucha esto y decide si mostrar
// el prompt (solo una vez, ver components/pwa-install.tsx).
export function notifyFirstLike() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("stailist:first-like"));
  }
}
