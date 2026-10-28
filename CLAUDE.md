# Socialix

Application de gestion de réseaux sociaux par une équipe d'agents IA : un agent Maître planifie et répartit le travail entre Recherche, Créateur, Planificateur et Analytique (Vidéaste en phase 3). Projet d'apprentissage et de démonstration, utilisable comme outil réel (une campagne par marque).

@AGENTS.md

## Sources de vérité (à lire avant de proposer quoi que ce soit)

- `PLAN.md` : chapitres, décisions (D1 à D8), avancement. Toujours caler le travail sur le chapitre en cours.
- `docs/DESIGN.md` : couleurs, polices, formes, états, mouvement, personnages et décor.
- `docs/PAGES.md` : la fiche de chaque écran (contenu, états, interactions).

## Méthode

- Depuis le chapitre 1, Claude code et **explique ce qu'il fait** (le concept, puis le code). L'utilisateur valide. Les explications sont en français.
- Une étape à la fois, en suivant le chapitre de `PLAN.md`. Ne pas avancer sur un chapitre suivant sans validation.
- Un chapitre = une branche Git = une pull request relue par CodeRabbit, puis fusion sur `main`.
- Commit ou push seulement quand l'utilisateur le demande ou quand l'étape du chapitre le prévoit.

## Stack

- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS v4, ESLint. shadcn/ui (base Radix, chapitre 4) : composants dans `src/components/ui/`, déjà adaptés à la charte.
- Base et auth (chapitre 3) : Drizzle ORM + PostgreSQL sur Supabase (Session pooler), Better Auth (e-mail et mot de passe, Google ; comptes dans notre base). Contrôle d’accès : `src/proxy.ts` (cookie, optimiste) puis `verifySession()` de `src/lib/dal.ts` dans chaque page privée.
- À venir : stockage (Supabase Storage), Inngest, AI SDK (Vercel) avec un modèle **Gemini** (le SDK OpenAI Agents reste candidat au chapitre 10), ImageKit, service de publication derrière une interface « publicateur ».

## Commandes

- `npm run dev` : serveur de développement (http://localhost:3000)
- `npm run lint` : vérification ESLint
- `npm run build` : build de production (doit passer avant chaque PR)
- `npm run db:generate` : écrit une migration SQL dans `drizzle/` à partir de `src/db/schema.ts`
- `npm run db:migrate` : applique les migrations sur la base (`DATABASE_URL`)
- `npm run db:studio` : interface web pour voir les tables
- `npx auth generate --config src/lib/auth.ts --output src/db/auth-schema.ts --yes` : régénère les tables de Better Auth
- `node scripts/sprites/build-agents.mjs` : régénère les personnages des agents dans `public/agents/`

## Règles

- **Next.js 16 a des changements** : lire le guide concerné dans `node_modules/next/dist/docs/` avant d'utiliser une API (voir `AGENTS.md`).
- **Secrets** uniquement dans `.env.local` (ignoré par Git). Jamais de clé dans le code, un commit ou un log.
- **Base de données** : toute nouvelle table active RLS dans sa migration (Supabase expose sinon la table par sa Data API). Mots de passe : règles dans `src/lib/password-rules.ts`, contrôlées côté serveur.
- **Propriété des données** : une campagne appartient à un utilisateur. Toute lecture ou écriture de données d'une campagne passe par une fonction de `src/lib/dal.ts` qui prend le propriétaire dans la **session**, jamais dans une adresse, un formulaire ou un paramètre (`getMyCampaigns()` n'a aucun paramètre `userId`). Une route `[campaignId]` doit filtrer sur l'identifiant ET le propriétaire, et répondre « introuvable » (404) dans les deux cas, pour ne pas révéler qu'une campagne existe. Toute Server Action revérifie la session (`getSession()`), même si la page est déjà protégée.
- **Pages d'une campagne** : sous `src/app/dashboard/[campaignId]/<section>/page.tsx`, avec le titre fourni par `<PageHeader title subtitle />` (qui porte le bouton « Créer un post »). Le layout `[campaignId]` vérifie déjà la propriété ; toute nouvelle section se déclare aussi dans `src/lib/campaign-sections.ts` (menu et action « changer de campagne ») et reçoit une icône dans `sidebar-nav.tsx`.
- **Accessibilité** : pour masquer un texte à l'écran, `sr-only` et jamais `hidden` (voir `docs/DESIGN.md`). Après avoir ajouté des écrans, relancer un audit `axe-core` (méthode dans `PLAN.md`).
- **Interface en français.** Pas de faux contenu : des emplacements signalés entre crochets (`[Prénom]`) ou un état vide honnête.
- **Composants d'interface** : utiliser `Button`, `Input`, `Label`… de `src/components/ui/` et les couleurs par leurs noms shadcn (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, `text-success`). Pas de style de bouton ou de champ écrit à la main. Le jaune s'appelle `signal` (`bg-signal`) : il signale, ce n'est jamais un bouton. Après un `npx shadcn add`, adapter le composant (voir « Implémentation » dans `docs/DESIGN.md`).
- **Design** : respecter `docs/DESIGN.md` (un seul accent `#E6E05A` qui signale, bouton principal encre, hachures = pas encore confirmé, pas de dégradés ni d'emojis dans l'interface).
- **Données clients** : jamais dans une offre gratuite qui s'en sert pour l'entraînement (offre gratuite de Gemini comprise).
- **Publication** : relecture humaine avant toute publication, uniquement via les API officielles. Jamais d'agent qui se connecte aux comptes sociaux d'un client avec un navigateur.
- **Dépôt public** : ne jamais commiter `text` (transcription), `docs/inspirations/` (images de tiers) ni `docs/prive/` (notes personnelles), et aucune information personnelle (chemins locaux, matériel, projets ou stratégie de l'auteur). Ces informations vont dans `docs/prive/NOTES.md`.
- Tâches simples et mécaniques (chercher un fichier, renommer, petites corrections) : déléguer au sous-agent `quick-helper` (Haiku) pour économiser.
