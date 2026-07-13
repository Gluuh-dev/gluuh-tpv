/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite consumir los paquetes del monorepo (código TS sin precompilar).
  transpilePackages: ["@gluuh/core"],   // @gluuh/ui es un placeholder sin importadores
};

export default nextConfig;
