import { readFileSync } from "node:fs";
import type { NextConfig } from "next";
import { LOOKS_V } from "./lib/looks";

// LA VERSIÓN, HORNEADA EN EL BUNDLE DEL NAVEGADOR.
//
// Existe por un día entero de confusión: se arregla algo, se despliega, Roberto
// prueba desde su teléfono, no funciona, y los dos investigamos un rato hasta
// descubrir que su navegador seguía corriendo el JavaScript de antes del
// arreglo. La app nunca decía qué versión traía, así que no había forma de
// saberlo sin excavar.
//
// Se lee del archivo VERSION y no de package.json, que lleva meses desfasado.
const VERSION = (() => {
  try {
    return readFileSync("VERSION", "utf8").trim();
  } catch {
    return "desconocida";
  }
})();

const nextConfig: NextConfig = {
  // Va al cliente a propósito: es lo que permite comparar "el JavaScript que
  // estoy corriendo" contra "lo que el servidor tiene ahora".
  env: { NEXT_PUBLIC_APP_VERSION: VERSION },
  // CABECERAS DE SEGURIDAD.
  //
  // Vercel pone HSTS solo; todo lo demás faltaba. La que de verdad importa aquí
  // es frame-ancestors: /api/permiso (el consentimiento del tutor de una menor)
  // es un <form> clásico sin token CSRF, así que dentro de un iframe invisible
  // alguien podría hacer que el tutor "dé permiso" creyendo que pulsa otra cosa.
  //
  // NO hay CSP completa todavía: la app usa estilos inline en varios sitios y
  // una CSP a medias se convierte en pantallas rotas sin mensaje. Se hace
  // aparte, midiendo con Report-Only primero.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nadie puede meter la app en un iframe.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // Un .txt subido no se puede servir como HTML ejecutable.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Al salir a otro sitio no se filtra la ruta interna en que estaba.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La app SÍ usa cámara (fotos de prendas) y ubicación (clima): se
          // permiten para el propio origen y se niegan a terceros incrustados.
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=(self), payment=()",
          },
        ],
      },
    ];
  },
  // El servidor de desarrollo bloquea por seguridad los recursos internos
  // (HMR, stack frames) pedidos desde un host que no sea localhost. Sin esto,
  // abrir la app desde el celular en la misma red pinta la página pero el
  // JavaScript nunca arranca: no se puede ni deslizar ni picar. Es solo de
  // desarrollo; en producción no aplica.
  allowedDevOrigins: ["192.168.100.5"],
  images: {
    // Las cartas del deck llevan un rompe-caché en la URL (`?v=N`): se rehacen
    // conservando el nombre de archivo, así que sin él el navegador sigue
    // sirviendo la carta vieja que ya tenía guardada.
    //
    // OJO CON `search`: es igualdad EXACTA, no un comodín. `search: ""` quiere
    // decir "sin query" y rechaza `?v=4`. Y el que valida no es solo el
    // endpoint del optimizador —ese responde 200 igual— sino el componente
    // <Image>, que LANZA en render y tumba la pantalla completa. Verificar esto
    // con un curl al optimizador no sirve: hay que renderizar la página.
    //
    // La versión se importa de lib/looks.ts para que no puedan separarse.
    localPatterns: [
      { pathname: "/looks/**", search: `?v=${LOOKS_V}` },
      { pathname: "/**" },
    ],
    // Las fotos propias de prendas vienen del Storage de Supabase (URL firmada).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "owmvdpdczznygbuctnpv.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
      // Imágenes de básicos regeneradas desde el admin (bucket público).
      {
        protocol: "https",
        hostname: "owmvdpdczznygbuctnpv.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
