import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['googleapis', 'mongoose'],
  async rewrites() {
    return [
      { source: '/recus', destination: '/payment-receipts' },
      { source: '/receipt-management', destination: '/receipts' },
      { source: '/receipt-management/portefeuilles', destination: '/portefeuilles' },
      { source: '/receipt-management/parametres', destination: '/admin/operators' },
      { source: '/seances', destination: '/sessions' },
      { source: '/taches', destination: '/tasks' },
    ];
  },
};

export default nextConfig;
