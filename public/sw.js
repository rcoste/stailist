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

// ── AVISOS PUSH (2026-10-30; apagados hasta NEXT_PUBLIC_AVISOS_PUSH=1) ──────
// El servidor manda un JSON {titulo, cuerpo, url, tag} (lib/avisos-push.ts).
// Mostrar la notificación es obligatorio: con userVisibleOnly el navegador
// castiga a quien recibe un push y no enseña nada.
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {}
  const titulo = datos.titulo || "stailist";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "¿Qué te pones hoy? Te lo armo con tu ropa.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: datos.tag || "look-de-hoy",
      data: { url: datos.url || "/hoy" },
    })
  );
});

// Al tocarla: si la app ya está abierta se trae al frente y se navega; si no,
// se abre. La URL trae ?desde=aviso para dejar la huella push_abierto.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/hoy", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) {
          if ("navigate" in v) v.navigate(destino).catch(() => {});
          return v.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
