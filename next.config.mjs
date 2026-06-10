/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@elastic/elasticsearch'],
  output: 'standalone',
};

export default nextConfig;
