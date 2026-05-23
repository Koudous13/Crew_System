import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl =
      process.env.CREW_API_URL ??
      (process.env.NODE_ENV === "development" && !process.env.SUPABASE_URL
        ? "http://127.0.0.1:8765"
        : "");
    if (!apiUrl) {
      return [];
    }
    return [
      {
        source: "/crew-api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
