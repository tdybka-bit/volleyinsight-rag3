/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  eslint: {
    // WARNING: This allows production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // WARNING: This allows production builds to complete even with TypeScript errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;