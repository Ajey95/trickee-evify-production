/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== "production";
const defaultBackendUrl = isDevelopment
  ? "http://127.0.0.1:8000"
  : "https://trickee-backend-397358873357.asia-south1.run.app";
const backendUrl = isDevelopment
  ? process.env.BACKEND_URL || defaultBackendUrl
  : defaultBackendUrl;

const nextConfig = {
  // Keep builds reliable on shared developer machines and small CI runners.
  experimental: { cpus: 2 },
  env: {
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL ||
      backendUrl.replace(/\/$/, "").replace(/\/api\/v1$/, "").replace(/^http/, "ws"),
  },
  productionBrowserSourceMaps: false,
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(self), geolocation=(self)",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://unpkg.com https://www.gstatic.com https://accounts.google.com/gsi/client`,
          "style-src 'self' 'unsafe-inline' https://unpkg.com https://accounts.google.com/gsi/style",
          "img-src 'self' data: blob: https://*.openstreetmap.org",
          "font-src 'self' data:",
          `connect-src 'self' https: wss: ws:${isDevelopment ? " http:" : ""}`,
          "frame-src https://www.openstreetmap.org https://accounts.google.com/gsi/",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl.replace(/\/$/, "").replace(/\/api\/v1$/, "")}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
