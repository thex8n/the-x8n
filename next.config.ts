import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '10.105.190.*',
    'localhost:3000'
  ]
};

export default nextConfig;