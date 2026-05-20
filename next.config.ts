import type { NextConfig } from "next";

const portalMode = process.env.MV_PORTAL_MODE ?? "surveillance";

const nextConfig: NextConfig = {
  distDir: portalMode === "vinavi" ? ".next-vinavi" : ".next-surveillance",
  async redirects() {
    if (portalMode === "vinavi") {
      return [
        {
          source: "/",
          destination: "/vinavi",
          permanent: false,
        },
      ];
    }

    return [];
  },
};

export default nextConfig;
