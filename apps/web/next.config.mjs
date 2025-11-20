/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
  // Permitir service worker
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};
export default nextConfig;



