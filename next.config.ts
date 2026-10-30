import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Une Server Action refuse par défaut un corps de plus de 1 Mo. Le logo d'un projet peut peser
    // 3 Mo (LOGO_MAX_BYTES) : 4 Mo laissent la place de l'enveloppe du formulaire. Valable pour toutes
    // les actions ; la taille du logo reste contrôlée octet par octet côté serveur (src/lib/logo-check.ts).
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
