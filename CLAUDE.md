# Socialix

Application de gestion de réseaux sociaux par une équipe d'agents IA : un agent Maître planifie et répartit le travail entre Recherche, Créateur, Planificateur et Analytique (Vidéaste en phase 3). Projet d'apprentissage et de démonstration, utilisable comme outil réel (une campagne par marque).

@AGENTS.md

## Sources de vérité (à lire avant de proposer quoi que ce soit)

- `PLAN.md` : chapitres, décisions (D1 à D7), avancement. Toujours caler le travail sur le chapitre en cours.
- `docs/DESIGN.md` : couleurs, polices, formes, états, mouvement, personnages et décor.
- `docs/PAGES.md` : la fiche de chaque écran (contenu, états, interactions).

## Méthode

- Depuis le chapitre 1, Claude code et **explique ce qu'il fait** (le concept, puis le code). L'utilisateur valide. Les explications sont en français.
- Une étape à la fois, en suivant le chapitre de `PLAN.md`. Ne pas avancer sur un chapitre suivant sans validation.
- Un chapitre = une branche Git = une pull request relue par CodeRabbit, puis fusion sur `main`.
- Commit ou push seulement quand l'utilisateur le demande ou quand l'étape du chapitre le prévoit.

## Stack

- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS v4, ESLint. shadcn/ui à partir du chapitre 4.
- À venir : Drizzle ORM + PostgreSQL et stockage (Supabase), auth (Better Auth, comptes dans notre base), Inngest, OpenAI Agents SDK avec un modèle **Gemini**, ImageKit, service de publication derrière une interface « publicateur ».

## Commandes

- `npm run dev` : serveur de développement (http://localhost:3000)
- `npm run lint` : vérification ESLint
- `npm run build` : build de production (doit passer avant chaque PR)
- `node scripts/sprites/build-agents.mjs` : régénère les personnages des agents dans `public/agents/`

## Règles

- **Next.js 16 a des changements** : lire le guide concerné dans `node_modules/next/dist/docs/` avant d'utiliser une API (voir `AGENTS.md`).
- **Secrets** uniquement dans `.env.local` (ignoré par Git). Jamais de clé dans le code, un commit ou un log.
- **Interface en français.** Pas de faux contenu : des emplacements signalés entre crochets (`[Prénom]`) ou un état vide honnête.
- **Design** : respecter `docs/DESIGN.md` (un seul accent `#E6E05A` qui signale, bouton principal encre, hachures = pas encore confirmé, pas de dégradés ni d'emojis dans l'interface).
- **Données clients** : jamais dans une offre gratuite qui s'en sert pour l'entraînement (offre gratuite de Gemini comprise).
- **Publication** : relecture humaine avant toute publication, uniquement via les API officielles. Jamais d'agent qui se connecte aux comptes sociaux d'un client avec un navigateur.
- **Dépôt public** : ne jamais commiter `text` (transcription), `docs/inspirations/` (images de tiers) ni `docs/prive/` (notes personnelles), et aucune information personnelle (chemins locaux, matériel, projets ou stratégie de l'auteur). Ces informations vont dans `docs/prive/NOTES.md`.
- Tâches simples et mécaniques (chercher un fichier, renommer, petites corrections) : déléguer au sous-agent `quick-helper` (Haiku) pour économiser.
