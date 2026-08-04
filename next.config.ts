import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next rechaza con 400 cualquier imagen LOCAL que traiga query string, salvo
    // que su ruta esté declarada aquí. Las cartas del deck la necesitan: se
    // rehacen conservando el nombre de archivo, así que sin un `?v=` el
    // navegador sigue sirviendo la carta vieja que ya tenía en caché (pasó: se
    // rehizo el deck de hombre entero y en el teléfono no cambió nada).
    // `search: ""` permite cualquier query en esa ruta; el número vive en
    // lib/looks.ts.
    localPatterns: [
      { pathname: "/looks/**", search: "" },
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
