/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @vacti/* libs are TS source consumed directly from the monorepo.
  transpilePackages: ['@vacti/core', '@vacti/config', '@vacti/db', '@vacti/auth', '@vacti/queue'],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
