# Plan d'implémentation — Socialix

> Document vivant. On le relit au début de chaque chapitre et on coche ce qui est fini.
> Dernière mise à jour : 26/10/2026 (v3 : agents sur Gemini, l'offre de tokens OpenAI gratuits n'étant plus disponible).

## 1. Objectif

Reproduire l'application « Socialix » de la vidéo *Build Social Media AI Agent Team Using Claude Code & Next.js*, en apprenant à chaque étape.

**Critère de fin (test de bout en bout) :**
1. Je crée une campagne.
2. Je demande à l'agent maître : « crée 2 posts Instagram pour le lancement d'un café, programmés à 8 h deux matins de suite ».
3. Je vois le plan, les tâches assignées et la progression de chaque agent.
4. Les 2 posts (image + légende + hashtags) apparaissent dans **Posts** et dans le **Calendrier**.
5. Je peux en déplacer un dans le calendrier, et la nouvelle date part chez Blotato.
6. Les posts sont publiés sur Instagram via le service de publication à l'heure prévue.

**Objectifs :** apprendre et démontrer la construction d'un système agentique complet (agents qui planifient et se répartissent le travail, outils, tâches de fond, intégrations d'API, humain dans la boucle). L'application doit pouvoir servir d'outil réel de gestion de réseaux sociaux, avec une campagne par marque. Le moteur d'agents doit rester réutilisable pour d'autres projets.

**Principes :** relecture humaine avant toute publication. Les vraies photos et vidéos du client servent de matière première, l'IA monte, rédige et habille : aucun visuel trompeur. Aucune donnée client dans une offre gratuite qui s'en sert pour l'entraînement.

## 2. Méthode de travail

- **Un chapitre = une branche Git = une PR** relue par CodeRabbit, puis fusionnée sur `main`.
- **Un chapitre du plan = un chapitre de la vidéo.** Tu regardes le passage de la vidéo, on en discute, puis tu le codes.
- **Méthode (depuis le 27/10/2026, à ta demande) :** Claude code et **explique chaque étape** : le concept d'abord, puis ce que fait le code. Tu valides avant de passer à l'étape suivante. Tu peux reprendre la main sur n'importe quelle étape en le disant.
- **Différence avec la vidéo :** l'auteur colle de longs prompts (document Eraser, que nous n'avons pas) et laisse Claude tout générer d'un coup. Nous, on découpe chaque chapitre en petites étapes expliquées et validées une par une.
- **Design :** direction « L'atelier des agents » validée → [`docs/DESIGN.md`](docs/DESIGN.md) (couleurs, polices, formes, états, mouvement). Chaque écran a sa fiche → [`docs/PAGES.md`](docs/PAGES.md). On ne reprend pas le style « Dribbble » ni les dégradés de la vidéo.
- **Secrets :** uniquement dans `.env.local` (déjà ignoré par `.gitignore`), jamais dans le code ni dans un commit.
- **Chaque chapitre est « fini »** quand son critère « Fini quand » est vérifié dans le navigateur, que `npm run lint` et `npm run build` passent, et que la PR est fusionnée.

## 3. Architecture cible

L'application a **deux couches** :
- **L'application web classique** (pages, auth, base, posts, calendrier, Blotato). Elle fonctionnerait sans IA.
- **La couche agents** : un LLM + des outils + un orchestrateur de tâches de fond.

```text
Navigateur (React / Next.js App Router)
   │  /sign-in · /campaigns/new · /dashboard/[campaignId]/{overview, agents, posts, calendar, analytics, accounts, settings}
   ▼
Serveur Next.js (Server Components, Server Actions, Route Handlers)
   ├── Auth ............ Better Auth (bibliothèque dans l'app, comptes rangés dans NOTRE base)
   ├── Base ............ PostgreSQL standard hébergé par Supabase, schéma + requêtes via Drizzle ORM
   ├── Stockage ........ Supabase Storage, compatible S3 (logos, images générées : bucket agent-files)
   ├── Chat agents ..... OpenAI Agents SDK (@openai/agents + zod) : un agent par rôle
   │                     modèle : Gemini, branché via @openai/agents-extensions + ai + @ai-sdk/google
   └── /api/inngest .... point d'entrée des tâches de fond
   ▼
Inngest (tâches de fond)
   ├── Cron toutes les 15 min : repère les tâches d'agents dues et les met en file
   ├── execute-agent-task : exécute une tâche (agent + outils), relance si échec
   └── on-failure : marque la tâche en échec et prévient l'utilisateur

Agents (OpenAI Agents SDK)                 Outils (tools)
   Maître ....... plan + assignation  →   créer / mettre à jour une tâche
   Recherche .... tendances, niche    →   recherche web, lecture de page, enregistrer la recherche
   Créateur ..... légende, image      →   rédiger, enregistrer un brouillon, générer une image (Gemini), ImageKit
   Planificateur  programmation       →   Blotato : comptes connectés, programmer un post
   Analytique ... performances        →   Blotato : statistiques
   (option) ordinateur cloud E2B      →   navigateur dans une VM Linux, prise de contrôle par l'utilisateur
```

**Comment ça s'enchaîne :** l'utilisateur écrit à l'agent maître. Celui-ci produit un **plan** et crée des **tâches** en base (avec dépendances : le Créateur attend la Recherche). Le cron Inngest repère les tâches dues, `execute-agent-task` lance l'agent concerné avec ses outils, enregistre le résultat et rend compte au maître. L'interface lit l'état en base pour afficher la progression.

**Ce que la vidéo utilise, et ce que nous en faisons :**
- **InsForge** (auth, base, stockage) : **remplacé** par Better Auth + PostgreSQL et stockage Supabase (décision D8), pour ne pas dépendre d'un service propriétaire.
- **OpenAI Agents SDK** pour les agents : repris tel quel. Inngest ne sert qu'aux tâches de fond.
- **Modèles OpenAI avec tokens gratuits quotidiens** : **remplacés par Gemini** (offre gratuite d'AI Studio, sans carte bancaire), l'offre OpenAI n'étant plus disponible. Le SDK reste le même, seul le modèle branché change (décision D1).
- **Gemini** pour générer les images, **ImageKit** pour les retoucher : repris. Une seule clé Google sert donc aux agents et aux images.
- **Blotato** pour la publication et les statistiques : **payant** (29 $/mois, API absente de l'essai). Remplaçant à choisir (décision D5).
- **E2B Desktop** pour l'« ordinateur cloud » : chapitre optionnel.

**Interface « publicateur » :** le code de l'app et les outils des agents n'appellent jamais Blotato, Buffer ou Meta directement. Ils passent par une petite interface commune (`listAccounts`, `schedulePost`, `reschedulePost`, `cancelPost`, `getStats`). On peut ainsi changer de service sans réécrire l'app.

## 4. Modèle de données (d'après la vidéo, affiné au fil des chapitres)

| Table | Colonnes principales | Ch. |
|---|---|---|
| `user`, `session`, `account`, `verification` | Tables de Better Auth (générées par son CLI) : comptes, sessions en base, liaisons Google, codes de vérification | 3 |
| `campaigns` | id, user_id, name, icon_url, office (`modern` / `wooden`), created_at | 5 |
| `agent_messages` | id, campaign_id, agent, role (`user` / `assistant`), content, created_at — l'historique du chat | 9 |
| `agent_plans` | id, campaign_id, request, plan (JSON), status, created_at | 10 |
| `agent_tasks` | id, plan_id, agent, title, instruction, depends_on, status, output (JSON), repeat_interval, repeat_until, repeat_count, run_count, next_run_at | 10–11 |
| `agent_communications` | id, task_id, from_agent, to_agent, message, created_at — échanges maître ↔ agents | 10 |
| `agent_task_runs` | id, task_id, status, started_at, finished_at, error | 11 |
| `research_results` | id, task_id, campaign_id, topic, data (JSON) | 12 |
| `posts` | id, campaign_id, title, caption, hashtags, platforms, image_url, scheduled_at (UTC), status (`draft` / `scheduled` / `published` / `failed`), blotato_id, created_by (`user` / `agent`) | 12–13 |
| `integrations` | id, user_id, provider (`blotato`), api_key_encrypted, created_at | 14 |
| `social_accounts` | id, user_id, blotato_account_id, platform, username, status, refreshed_at | 14 |

**Règle des dates :** on stocke en UTC (`timestamptz`) et on affiche dans le fuseau choisi (Europe/Paris par défaut). « 8 h » veut dire 8 h heure de Paris.

## 5. Chapitres (ordre de la vidéo)

On suit l'ordre de la vidéo pour pouvoir regarder chaque passage avant de le coder. Seul ajout : le chapitre 4 (design), pour fixer couleurs et polices avant la première interface.

| # | Chapitre | Ce que tu apprends | Fini quand |
|---|---|---|---|
| 1 | **Setup** | Structure Next.js, App Router, `CLAUDE.md`, sous-agents Claude Code | « Hello world » affiché, `CLAUDE.md` + `.claude/agents/quick-helper.md` écrits, premier commit |
| 2 | **GitHub + CodeRabbit** | Remote Git, branches, pull requests, revue automatisée | Dépôt GitHub créé, CodeRabbit commente une PR |
| 3 | **Base + auth (Supabase + Better Auth)** | ORM et PostgreSQL, Drizzle (schéma, migrations, Drizzle Studio), sessions en base, cookies sécurisés, OAuth Google | Connexion Google + e-mail OK, compte enregistré dans **notre** base, `/dashboard` refusé côté serveur si non connecté |
| 4 | **Système de design** *(ajout)* | Variables CSS, thème shadcn/ui, thèmes clair/sombre, composants accessibles | shadcn installé avec les couleurs, polices et arrondis de `docs/DESIGN.md`, bascule Jour/Nuit fonctionnelle |
| 5 | **Création de campagne** | Formulaire en 2 étapes, Server Actions, validation, upload | Campagne créée (nom, logo ≤ 3 Mo vers Supabase Storage, bureau), redirection si aucune campagne |
| 6 | **Layout du dashboard** | Layouts imbriqués, route dynamique `[campaignId]`, navigation | Sidebar repliable (icônes par défaut), sélecteur de campagne, header, pages vides propres |
| 7 | **Vue d'ensemble + bureau isométrique** | Agrégations SQL, positionnement en %, animation CSS, composant réutilisable | Statut de campagne (états vides), bureau d'après `office-studio/*.json`, agents animés, étiquette nom + emoji, positions stables au redimensionnement |
| 8 | **Page Agents (interface)** | Composition de composants, onglets, panneau latéral | Barre des agents, onglets Chat / Historique / Réglages (factices), clic sur un agent dans le bureau de la vue d'ensemble → panneau de chat à gauche, **même composant partout** |
| 9 | **Agents SDK + Gemini** | Appeler un LLM côté serveur, adaptateur de modèle, instructions d'agent, schémas zod, historique | Chat réel avec chaque agent (modèle Gemini), chacun refuse le travail des autres, historique en base |
| 10 | **Agent maître** | Planification, sortie structurée, tâches avec dépendances | Le maître pose des questions si besoin, crée un plan et des tâches assignées, rapport visible ; agent Publication remplacé par Analytique |
| 11 | **Tâches de fond (Inngest)** | Cron, file d'attente, relances, concurrence, idempotence | Cron 15 min + exécution + échec visibles dans le serveur de dev Inngest, pas de double exécution, tâches répétées (`next_run_at`), annulation d'un plan |
| 12 | **Outils des agents** | Tool use, enchaînement d'agents, stockage de fichiers | Recherche → Créateur enchaînés, image générée (Gemini) enregistrée dans `agent-files` et affichée dans le chat, brouillon de post en base |
| 13 | **ImageKit + création de post** | Upload, transformations d'image par URL, formulaire riche | Choix manuel / IA, éditeur (titre, légende, hashtags, plateformes, aperçu), retouche ImageKit (recadrage, détourage, upscale, texte…), programmer / modifier / déprogrammer → brouillon |
| 14 | **Publication (Blotato ou remplaçant, D5)** | API externe côté serveur, interface « publicateur », chiffrement d'une clé, outils agents | Clé chiffrée dans Réglages, comptes connectés listés, programmer un post l'envoie au service choisi, publication réelle vérifiée sur Instagram |
| 15 | **Calendrier** | Vues mois / semaine, glisser-déposer, fuseaux horaires | Publiés en vert / à venir en gris, détail au clic, « + » sur un jour → création avec la date, déplacement répercuté chez Blotato |
| 16 | **Analytique** | Récupération et affichage de statistiques | Page alimentée par Blotato (7 j / 30 j / personnalisé, par plateforme, top posts), agent Analytique branché |
| 17 | **Ordinateur cloud E2B** *(optionnel)* | VM distante, outils « computer use », mise en pause pour authentification | Onglet Ordinateur, prise de contrôle, l'agent Recherche navigue, pause + notification si une connexion est requise. **Jamais pour se connecter aux comptes sociaux des clients** (contraire aux règles des plateformes) |
| | ***Phase 2 : service et portfolio*** | | |
| 18 | **Mise en ligne** | Hébergement, variables d'environnement de production, Inngest en ligne, URL de rappel OAuth | Application accessible en ligne, connexion Google OK en production, tâches de fond exécutées par Inngest en ligne |
| 19 | **Espace client** | Lien de partage sécurisé (jeton), statuts de validation, export de rapport | Le client valide ou commente les posts via un lien sans compte, un post non validé n'est jamais publié, rapport mensuel exportable (PDF) |
| 20 | **Vitrine portfolio** | Rédiger pour un recruteur, démo vidéo, schéma d'architecture | README avec schéma et choix techniques, démo de 2 min (consigne → plan → posts → calendrier), lien de démo en ligne |
| | ***Phase 3 : vidéo IA*** | | |
| 21 | **Agent Vidéaste + montage automatique** | Script et découpage en plans en JSON, modèles HyperFrames, rendu long via Inngest, atelier de rendu séparé | « Fais un Reel pour… » produit un MP4 vertical 9:16 (photos du client + texte animé + musique), stocké, attaché à un post vidéo, visible dans le calendrier |
| 22 | **Voix off et sous-titres** | Synthèse vocale, transcription, synchronisation | Le Reel a une voix off et des sous-titres synchronisés |
| 23 | **Clips génératifs Veo** *(optionnel, payant)* | API asynchrone (lancer, attendre, récupérer), maîtrise des coûts | Un plan du Reel peut être un clip Veo généré via l'API Gemini, **après confirmation explicite du coût** |

**Le critère de fin est atteignable à la fin du chapitre 15.**

**Phase 3 et le rendu vidéo :** le rendu (HyperFrames + FFmpeg) se fait dans un **atelier de rendu séparé** que Socialix appelle. Il demande un navigateur sans interface et FFmpeg, donc il ne peut pas tourner sur un hébergement web classique. Les clips génératifs passent par l'**API Gemini (Veo)**, jamais par l'automatisation d'une interface web.

**Pourquoi E2B passe en dernier et en option :** dans la vidéo, il arrive entre Inngest et les outils. Mais c'est le morceau le plus lourd (VM, coûts, sécurité des sessions), la démo est elle-même lente et bancale, et l'outil de recherche web suffit à l'agent Recherche pour le critère de fin.

## 6. Comptes à créer (au moment où on en a besoin)

| Service | Ch. | Remarque |
|---|---|---|
| GitHub | 2 | Dépôt public, création et pull requests avec la CLI `gh` |
| CodeRabbit | 2 | Connexion avec GitHub. Vérifier l'offre gratuite à l'inscription |
| Supabase | 3 | Offre gratuite : projet PostgreSQL + stockage. Projet mis en pause après 7 jours de **faible** activité (e-mail d'avertissement une semaine avant ; restaurable pendant un an, données et réglages conservés). On n'utilise **pas** son système de comptes |
| Google Cloud Console | 3 | Création d'un identifiant OAuth (gratuit) pour « Continuer avec Google » |
| Google AI Studio (Gemini) | 9 | Clé API gratuite, sans carte. Sert aux agents (ch. 9) et aux images (ch. 12). Les données de l'offre gratuite peuvent servir à Google : rien de sensible |
| Inngest | 11 | Serveur de dev local gratuit (`npx inngest-cli dev`). Offre gratuite : 50 000 exécutions/mois |
| ImageKit | 13 | Offre gratuite : 25 Go/mois, 650 unités IA. Il faut l'URL endpoint + la clé privée. Fonctions IA en bêta |
| Service de publication | 14 | Selon D5 : Buffer (gratuit, API incluse) · app développeur Meta + compte Instagram professionnel (gratuit) · Blotato (29 $/mois, API absente de l'essai de 7 jours) |
| E2B | 17 | 100 $ de crédit offert d'après la vidéo (non confirmé) |
| Hébergement (ex. Vercel) | 18 | L'offre gratuite Hobby de Vercel est réservée à un usage personnel et non commercial (à revérifier) : pour un usage commercial, prévoir une offre payante ou un autre hébergeur (décision D7) |
| Inngest Cloud | 18 | Offre gratuite (50 000 exécutions/mois) |
| API Gemini payante (Veo) | 23 | Facturation à la seconde de vidéo. Confirmation avant chaque génération |

## 7. Décisions à prendre (avant le chapitre concerné)

| # | Question | Ce que fait la vidéo | Recommandation |
|---|---|---|---|
| D1 | Quel LLM pour les agents ? (ch. 9) | Modèles OpenAI avec tokens gratuits quotidiens contre partage des données | ✅ **Décidé : Gemini** (offre gratuite d'AI Studio), branché sur l'OpenAI Agents SDK via l'adaptateur AI SDK. L'offre OpenAI n'est plus disponible pour ton compte |
| D2 | Où stocker la clé du service de publication ? (ch. 14) | En base, chiffrée, par utilisateur (clé de chiffrement dans `.env.local`) | Suivre la vidéo : c'est l'occasion d'apprendre le chiffrement (AES-GCM) |
| D3 | Suivi « en temps réel » des agents (ch. 10–12) | Non expliqué dans la vidéo | Rafraîchissement périodique (polling) toutes les 2–3 s d'abord, simple à comprendre |
| D4 | Faire le chapitre 17 (E2B) ? | Oui | À décider après le chapitre 16 |
| D5 | Quel service de publication ? (ch. 14) | Blotato (payant) | **Buffer** (gratuit, mais réservé à un usage personnel : convient au développement et à mes propres comptes) · **API Instagram de Meta** (gratuite, vraies statistiques, mise en place plus longue, validation Meta nécessaire pour publier sur les comptes d'autres personnes) · **Blotato** (29 $/mois, 20 comptes, gère la vidéo). **Tendance :** Buffer pendant le développement, Blotato dès qu'il faut gérer plusieurs comptes. Grâce à l'interface « publicateur », le changement ne touche qu'un fichier. À décider avant le chapitre 14 |
| D6 | Dépôt GitHub public ou privé ? (ch. 2) | — | **Public**, pour que CodeRabbit fasse des revues complètes (sur un dépôt privé, l'offre gratuite ne fait que des résumés). Donc aucun secret commité, et le fichier `text` (transcription d'une vidéo tierce) ajouté à `.gitignore` |
| D7 | Où héberger l'application ? (ch. 18) | — | À décider au chapitre 18, selon que des clients payants l'utilisent déjà ou non |
| D8 | Auth, base et stockage (ch. 3) | InsForge, service propriétaire tout-en-un | ✅ **Décidé : Better Auth** (bibliothèque open source MIT, comptes dans notre base) + **PostgreSQL et stockage Supabase** (open source, standard). Si un hébergeur ferme : export de la base, nouvelle adresse dans `.env.local`, les comptes suivent |

## 8. Risques et points à vérifier

- **Boilerplate de la vidéo introuvable** : remplacé par `create-next-app` officiel. On ajoute shadcn, Drizzle et Inngest nous-mêmes.
- **Prompts de la vidéo indisponibles** (document Eraser) : on reconstruit chaque chapitre à partir de la transcription et de la doc officielle.
- **Next.js 16** : version récente avec des changements. Lire `node_modules/next/dist/docs/` avant d'utiliser une API (voir `AGENTS.md`).
- **Versions au 26/10/2026** : `@openai/agents` et `@openai/agents-extensions` 0.21.0 (pas encore en 1.0, l'API peut bouger), `ai` 7.0.153, `@ai-sdk/google` 4.0.105, `zod` 4.6.7, `inngest` 4.26.0, `better-auth` 1.7.14, `drizzle-orm` 0.45.4, `@google/genai` 2.31.0, `@imagekit/next` 2.1.6, `@e2b/desktop` 2.5.0. On revérifie au moment d'installer.
- **Gemini à la place d'OpenAI** : la vidéo s'appuie sur l'outil de recherche web *hébergé par OpenAI*, qui ne marche pas avec Gemini. Au chapitre 12, on écrira notre propre outil de recherche, ou on utilisera la recherche Google intégrée à Gemini si elle se combine avec nos autres outils (à vérifier).
- **Quotas de l'offre gratuite Gemini** : limites par minute et par jour (chiffres différents selon les sources). Un plan de l'agent maître déclenche plusieurs appels : on surveillera les erreurs 429 (« trop de requêtes ») et on limitera la concurrence dans Inngest.
- **Next.js 16 et l'auth** : `middleware.ts` est déprécié et renommé `proxy.ts`. Next recommande de vérifier la session **côté serveur** (layouts, actions) plutôt que de reposer uniquement sur le proxy. Better Auth s'utilise ainsi.
- **Blotato** : base `https://backend.blotato.com/v2`, en-tête `blotato-api-key`, `POST /posts` avec `scheduledTime`, gestion via `/schedules`. **À confirmer dans la doc officielle** : le format de `scheduledTime`, la liste des comptes, le déplacement d'un post déjà programmé, et API REST ou MCP pour les agents.
- **Cron toutes les 15 min** : une tâche d'agent peut démarrer jusqu'à 15 min en retard. Ce n'est pas grave pour la publication, dont l'heure est gérée par Blotato.
- **ImageKit** : transformations IA en bêta, paramètres exacts à vérifier au chapitre 13.

## 9. Avancement

- [x] Squelette Next.js 16.4.3 généré dans `socialix` (TypeScript, Tailwind v4, ESLint, `src/`, App Router)
- [x] Dépôt Git propre au projet (`git init -b main`)
- [x] Transcription complète lue (`text`), plan v2
- [x] Outils et alternatives gratuites passés en revue, D1 décidée (Gemini), plan v3
- [x] Objectifs fixés, phases 2 (service et portfolio) et 3 (vidéo IA) ajoutées
- [x] Direction visuelle « L'atelier des agents » validée (thèmes Jour / Nuit) → `docs/DESIGN.md`
- [ ] Fiches des 12 écrans rédigées → `docs/PAGES.md` — **en attente de validation**
- [x] Personnages pixel des agents + décor de l'atelier jour/nuit (`public/agents/`, `public/office/`)
- [x] **Chapitre 1** : Hello world, `CLAUDE.md`, `.claude/agents/quick-helper.md`, `.gitignore` (fichiers tiers exclus), lint + build OK, premier commit `f492b9a`
- [ ] Phase 1 : Ch. 2 · [ ] 3 · [ ] 4 · [ ] 5 · [ ] 6 · [ ] 7 · [ ] 8 · [ ] 9 · [ ] 10 · [ ] 11 · [ ] 12 · [ ] 13 · [ ] 14 · [ ] 15 · [ ] 16 · [ ] 17 (option)
- [ ] Phase 2 : [ ] 18 · [ ] 19 · [ ] 20
- [ ] Phase 3 : [ ] 21 · [ ] 22 · [ ] 23 (option)
