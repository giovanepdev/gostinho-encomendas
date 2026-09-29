import type { NextConfig } from "next";

// Aceita fotos do domínio do seu projeto Supabase (inclusive domínio próprio, se um dia tiver)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  env: {
    // Endereço público do site, usado nos links de pré-visualização (WhatsApp, Instagram).
    // Na Netlify, a variável URL vem preenchida no build com o endereço principal do site
    // (o .netlify.app hoje; o domínio próprio quando existir). No seu PC, localhost.
    NEXT_PUBLIC_SITE_URL: process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  },
  images: {
    // Fotos dos produtos vêm do Storage do Supabase
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      ...(supabaseUrl
        ? [
            {
              protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
              hostname: supabaseUrl.hostname,
              port: supabaseUrl.port,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: {
      // A foto é reduzida no navegador antes do envio (~100 KB); 4 MB é só folga.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
