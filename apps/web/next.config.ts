import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@triaji/shared',
    '@triaji/rules-engine',
    '@triaji/normalization',
  ],
};

export default nextConfig;
