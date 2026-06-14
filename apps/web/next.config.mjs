/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite consumir los paquetes del monorepo (código TS sin precompilar).
  transpilePackages: ["@gluuh/ui", "@gluuh/core"],
};

export default nextConfig;
