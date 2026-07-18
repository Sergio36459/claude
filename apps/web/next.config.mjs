/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  // NEXT_OUTPUT=export — полностью статическая сборка для GitHub Pages/CDN
  // (приложение клиентское, сервер ему не нужен)
  output: process.env.NEXT_OUTPUT === "export" ? "export" : undefined,
  basePath: basePath || undefined,
  transpilePackages: ["@uwt/shared", "@uwt/geo"],
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
};

export default nextConfig;
