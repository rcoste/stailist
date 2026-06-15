import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
