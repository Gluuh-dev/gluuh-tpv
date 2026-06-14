/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite consumir los paquetes del monorepo (código TS sin precompilar).
  transpilePackages: ["@gluppo/ui", "@gluppo/core"],
};

export default nextConfig;
