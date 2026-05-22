/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const isDevelopment = process.env.NODE_ENV !== "production";

const nextConfig = {
  productionBrowserSourceMaps: false,
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://unpkg.com https://www.gstatic.com`,
          "style-src 'self' 'unsafe-inline' https://unpkg.com",
          "img-src 'self' data: blob: https://*.openstreetmap.org https://*.basemaps.cartocdn.com",
          "font-src 'self' data:",
          `connect-src 'self' https: wss: ws:${isDevelopment ? " http:" : ""}`,
          "frame-src https://www.openstreetmap.org",
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
        destination: `${backendUrl.replace(/\/api\/v1\/?$/, "")}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
