import type { NextConfig } from 'next';

// Hôtes autorisés à appeler l'application en développement (ex. Codespaces, tunnel, IP du réseau local).
// Variable : NEXT_ALLOWED_ORIGINS="mon-site.app.github.dev,192.168.1.20:3000" (séparés par des virgules).
// Sans cela, Next.js refuse les Server Actions (« Invalid Server Actions request ») dès que l'en-tête
// Origin du navigateur ne correspond pas à l'hôte vu par le serveur (proxy, tunnel, autre adresse).
const extraOrigins = (process.env.NEXT_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: extraOrigins.map((origin) => origin.replace(/:\d+$/, '')),
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '127.0.0.1:3000', ...extraOrigins],
    },
  },
  images: {
    // Avatars, bannières et logos servis par Supabase Storage (buckets publics)
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },
};

export default nextConfig;
