import type { NextConfig } from "next";
import { LOOKS_V } from "./lib/looks";

const nextConfig: NextConfig = {
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
