import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Configuración de imágenes para Cloudflare R2
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-70739f5647f14c49a39c5a04ac6dfea7.r2.dev',
        port: '',
        pathname: '/**', // ✅ Cambié de /products/** a /** para permitir todas las rutas
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev', // ✅ Wildcard para cualquier bucket R2
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'jqmmtlkbdbcbawgsbxyf.supabase.co', // ✅ Añadí Supabase por si acaso
        port: '',
        pathname: '/storage/v1/object/**',
      }
    ],
    // ✅ Configuración de optimización
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ✅ Headers para mejor rendimiento
  async headers() {
    return [
      {
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },

  // ✅ Configuración para desarrollo (acceso desde red local)
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    }
  },
};

export default nextConfig;