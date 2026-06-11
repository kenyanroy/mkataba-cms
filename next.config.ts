import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=self, microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Allow DocuSeal iframe (internal — same host or iframe origin)
              `frame-src 'self' ${process.env.DOCUSEAL_API_URL ?? "http://docuseal:3000"}`,
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.js requires unsafe-eval in dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // DocuSeal runs on the internal Docker network — no need to allow external image domains
  images: {
    remotePatterns: [],
  },

  // Redirect root to dashboard
  async redirects() {
    return [
      { source: "/", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
