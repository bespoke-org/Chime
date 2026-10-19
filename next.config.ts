import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ATProto OAuth in development needs a loopback redirect on 127.0.0.1, so
  // the app is opened there rather than on localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
