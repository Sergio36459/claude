/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@uwt/shared", "@uwt/geo"],
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
};

export default nextConfig;
