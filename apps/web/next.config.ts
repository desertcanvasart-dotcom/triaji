import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@triaji/shared',
    '@triaji/rules-engine',
    '@triaji/normalization',
  ],
  images: {
    // Patient-uploaded triage images and doctor avatars are served from
    // Supabase Storage (signed + public URLs); next/image throws on
    // unconfigured remote hosts.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

export default nextConfig;
