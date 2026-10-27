# Socialix

Une équipe d'agents IA qui prépare, planifie et publie des posts sur les réseaux sociaux.

Un agent **Maître** reçoit une consigne en langage naturel (« crée 2 posts Instagram pour le lancement d'un café, programmés à 8 h deux matins de suite »), établit un plan et répartit le travail entre des agents spécialisés : **Recherche**, **Créateur**, **Planificateur** et **Analytique**. Rien n'est publié sans validation humaine.

> **Projet en construction.** Il est développé chapitre par chapitre, en public. L'avancement est suivi dans [`PLAN.md`](PLAN.md).

![Le bureau des agents, de jour](public/office/atelier-jour.webp)

## Stack

- **Application** : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Prévu** : shadcn/ui, Drizzle ORM + PostgreSQL, Inngest (tâches de fond), OpenAI Agents SDK avec un modèle Gemini, ImageKit, un service de publication derrière une interface commune

## Lancer le projet

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## Documentation

- [`PLAN.md`](PLAN.md) : chapitres, décisions techniques et avancement
- [`docs/DESIGN.md`](docs/DESIGN.md) : direction visuelle « L'atelier des agents » (thèmes Jour et Nuit)
- [`docs/PAGES.md`](docs/PAGES.md) : fiche de chaque écran

Les personnages des agents sont du pixel art original, générés par [`scripts/sprites/build-agents.mjs`](scripts/sprites/build-agents.mjs).
