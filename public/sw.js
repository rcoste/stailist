// Service worker mínimo: su único trabajo es habilitar la instalación de la PWA
// (Chrome exige un SW con handler de fetch). Es network-only a propósito —
// NADA de cachear HTML/JS, para que en beta nunca se sirva una versión vieja.
const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f3f0;color:#1a1718;text-align:center;padding:2rem"><div><p style="font-size:1.1rem">Te quedaste sin conexión 🤍</p><p style="color:#6b6360">Vuelve a intentarlo en un momento.</p></div>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener("fetch", (event) => {
  // Solo interceptamos navegaciones, para dar una pantalla decente sin conexión.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(OFFLINE, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
      )
    );
  }
});
