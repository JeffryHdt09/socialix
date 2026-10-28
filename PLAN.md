# Plan d'implémentation — Socialix

> Document vivant. On le relit au début de chaque chapitre et on coche ce qui est fini.
> Dernière mise à jour : 28/10/2026 (v4 : décision D9 sur les modèles avec repli, section « Équipes d'agents futures »). v3 : agents sur Gemini, l'offre de tokens OpenAI gratuits n'étant plus disponible.

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
   ├── Chat agents ..... AI SDK (ai, boucle ToolLoopAgent + zod) : un agent par rôle (décision D1 révisée le 28/10/2026)
   │                     modèle : Gemini via @ai-sdk/google, liste ordonnée avec repli (src/lib/models.ts)
   └── /api/inngest .... point d'entrée des tâches de fond
   ▼
Inngest (tâches de fond)
   ├── Cron toutes les 15 min : repère les tâches d'agents dues et les met en file
   ├── execute-agent-task : exécute une tâche (agent + outils), relance si échec
   └── on-failure : marque la tâche en échec et prévient l'utilisateur

Agents (AI SDK, ToolLoopAgent)                 Outils (tools)
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
- **AI SDK (Vercel)** pour les agents, à la place du SDK OpenAI Agents prévu au départ : il parle à Gemini sans adaptateur, a une boucle d'agent (`ToolLoopAgent`) et la validation humaine d'un outil (`needsApproval`). Au chapitre 10 (passages de main entre agents), on compare honnêtement avec `@openai/agents` (à réinstaller si retenu, version 0.21.0 au 28/10/2026), Mastra et LangGraph sur le vrai besoin. Les consignes, l'historique, la liste de modèles et la table `messages` sont indépendants du framework. Inngest ne sert qu'aux tâches de fond.
- **Modèles OpenAI avec tokens gratuits quotidiens** : **remplacés par Gemini** (offre gratuite d'AI Studio, sans carte bancaire), l'offre OpenAI n'étant plus disponible. Le SDK reste le même, seul le modèle branché change (décision D1).
- **Gemini** pour générer les images, **ImageKit** pour les retoucher : repris. Une seule clé Google sert donc aux agents et aux images.
- **Blotato** pour la publication et les statistiques : **payant** (29 $/mois, API absente de l'essai). Remplaçant à choisir (décision D5).
- **E2B Desktop** pour l'« ordinateur cloud » : chapitre optionnel.

**Interface « publicateur » :** le code de l'app et les outils des agents n'appellent jamais Blotato, Buffer ou Meta directement. Ils passent par une petite interface commune (`listAccounts`, `schedulePost`, `reschedulePost`, `cancelPost`, `getStats`). On peut ainsi changer de service sans réécrire l'app.

## 4. Modèle de données (d'après la vidéo, affiné au fil des chapitres)

| Table | Colonnes principales | Ch. |
|---|---|---|
| `user`, `session`, `account`, `verification` | Tables de Better Auth (générées par son CLI) : comptes, sessions en base, liaisons Google, codes de vérification | 3 |
| `campaigns` | id (uuid), user_id (propriétaire, supprimé en cascade), name (1 à 60 caractères, contrôlé aussi par la base), icon (`icon:<nom>` icône proposée, `upload:<clé>` image téléversée, ou vide), office (`wooden` / `modern`, `wooden` par défaut), created_at (timestamptz). RLS activé | 5 |
| `messages` | id, campaign_id (cascade), agent (texte libre : le moteur accepte d'autres équipes), role (`user` / `assistant`), content, model (modèle qui a répondu), created_at — l'historique du chat. RLS activé. **Créée au chapitre 9** (nommée `messages` et non `agent_messages`) | 9 |
| `agent_plans` | id, campaign_id (cascade), request, summary, plan (JSON tel que produit par le modèle), status (`active` / `done` / `cancelled`), created_at. RLS activé | 10 |
| `agent_tasks` | id, plan_id (cascade), position (numéro d'affichage, unique dans le plan), agent, title, instruction, status (`pending` / `running` / `done` / `failed` / `cancelled`), output (JSON), created_at, updated_at. RLS activé. Les colonnes de répétition (`repeat_interval`, `repeat_until`, `repeat_count`, `run_count`, `next_run_at`) s'ajoutent au chapitre 11, quand on en a besoin | 10–11 |
| `agent_task_dependencies` | task_id, depends_on_task_id (clé primaire commune, les deux en cascade, une tâche ne peut pas dépendre d'elle-même). **Remplace la colonne `depends_on`** prévue d'abord : une liste d'identifiants que la base ne peut pas contrôler. Les cycles sont refusés par la validation du plan (étape 10.2). RLS activé | 10 |
| `agent_communications` | id, task_id (cascade), from_agent, to_agent, message, created_at — échanges maître ↔ agents. RLS activé | 10 |
| `agent_task_runs` | id, task_id, status, started_at, finished_at, error | 11 |
| `research_results` | id, task_id, campaign_id, topic, data (JSON) | 12 |
| `posts` | id (uuid), campaign_id (supprimé en cascade avec la campagne), title (1 à 120 caractères), caption, hashtags (liste), platforms (liste), image_url, scheduled_at (timestamptz, UTC), status (`draft` / **`to_review`** / `scheduled` / `published` / `failed`), external_id (identifiant chez le service de publication, nom neutre tant que D5 n'est pas tranchée), created_by (`user` / `agent`), created_at, updated_at. RLS activé. Contrôles dans la base : titre non vide, et un post `scheduled` ou `published` a forcément une date. **Créée au chapitre 7** (pour les calculs de la vue d'ensemble), les posts eux-mêmes arrivent aux chapitres 12 et 13 | 7 |
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
| 7 | **Vue d'ensemble + bureau isométrique** | Agrégations SQL, positionnement en %, animation CSS, composant réutilisable | Statut de campagne (états vides), bureau d'après `office-studio/*.json`, agents animés, étiquette du nom en police pixel (**sans emoji** : DESIGN.md les interdit), pastille d'état, positions stables au redimensionnement |
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

### Équipes d'agents futures (après le ch. 15, hors critère de fin)

> **Vision élargie (28/10/2026) : le projet ne sera plus forcément réservé au marketing.** D'autres domaines pourront suivre. Conséquence dès le chapitre 9 : le moteur d'agents (chat, historique, modèles, outils) ne contient aucune notion de marketing. Chaque agent appartient à une **équipe** (`team` dans `src/lib/agents.ts`), chaque équipe a son **contexte** (`CONTEXTE_EQUIPE` dans `src/lib/agent-instructions.ts`), et les règles communes (français, pas d'invention, accord humain avant toute action extérieure) valent pour toutes. Une nouvelle équipe = une entrée de contexte + des agents, sans réécrire le moteur. Les pages, la campagne et le bureau restent propres au marketing tant qu'on n'a pas décidé comment un autre domaine s'y présente (à trancher le moment venu, pas avant).
> Le détail (domaines, workflows visés, ce que le moteur doit offrir, garde-fous) est dans [`docs/VISION.md`](docs/VISION.md).

Idées notées pour plus tard, **à ne pas coder avant la fin du chapitre 15**. Chaque équipe aurait son propre Maître, ou partagerait celui de l'équipe marketing.

- **Prépare dès les ch. 9–10 : un agent est une donnée** (nom, rôle, instructions, liste d'outils, liste de modèles, voir D9). Ajouter un agent = ajouter une ligne, sans réécrire le moteur.
- **Prospection :** *Chasseur* (trouve des cibles via sources publiques et API officielles) · *Qualifieur* (note chaque piste) · *Rédacteur d'approche* (message personnalisé, **relecture humaine avant tout envoi**) · *Relance* (suivi à J+3, J+7…). Prévoit une table `leads` (statut : à contacter, contacté, répondu, gagné) comme mini-CRM.
- **Veille et recherche :** *Veilleur concurrence* (ce que publient les concurrents) · *Tendances et SEO* (mots-clés, sujets qui montent).
- **Vente de produits digitaux :** *Page de vente* (textes, variantes) · *Support* (FAQ sur une base de connaissances) · *Séquences e-mail* (accueil, relance, promotion). La vente elle-même demande un service de paiement et de livraison (type Stripe, Lemon Squeezy ou Gumroad) : c'est un module à part, pas un agent.
- **Qualité :** *Relecteur / Critique*, qui contrôle chaque production avant la relecture humaine (ton de la marque, affirmations invérifiables, orthographe, conformité). C'est l'agent le plus rentable à ajouter en premier.
- **Limites à respecter :** pas de collecte de données sur les réseaux sociaux contre leurs règles, jamais de connexion à un compte avec un navigateur, et prospection par e-mail encadrée en B2B (désinscription, motif légitime, pas d'envoi de masse) : à vérifier avant le premier envoi.

**Pourquoi E2B passe en dernier et en option :** dans la vidéo, il arrive entre Inngest et les outils. Mais c'est le morceau le plus lourd (VM, coûts, sécurité des sessions), la démo est elle-même lente et bancale, et l'outil de recherche web suffit à l'agent Recherche pour le critère de fin.

### Ce qu'on reprend d'Hermes Agent (étudié le 28/10/2026, d'après sa documentation officielle)

Hermes Agent (Nous Research, MIT) est un agent personnel généraliste. Écarté comme moteur : isolation par profil (un processus par client), outils terminal à accès complet, coût d'hébergement. On reprend seulement des idées, adaptées à des comptes multiples :

| Idée | Chez nous | Quand |
|---|---|---|
| Filtre anti-injection sur tout texte qui entre dans un prompt | `src/lib/prompt-safety.ts` (pure, **faite**, testée) | À brancher sur la mémoire (ch. 13) et le texte des pages web (ch. 12) |
| Protection SSRF avant tout outil web | `src/lib/url-safety.ts` (pure, **faite**, testée, avec résolution du nom) | À brancher à l'outil web (ch. 12) |
| Niveaux d'approbation : lecture libre, écriture visible avec confirmation, irréversible interdit ; règles de refus avant tout | Un niveau par outil, déclaré avec l'outil | Ch. 12 |
| Mémoire bornée, injectée figée en début de session, écriture validée par la personne, refus (pas d'effacement) quand pleine | Table par campagne : marque, ton, interdits | Ch. 13 |
| Skills : procédures chargées à la demande (liste courte, puis contenu) | Écrites et validées par nous, **jamais créées seules par l'agent** | Ch. 12-13 |
| Recherche plein texte dans l'historique, messages réels sans résumé | Postgres FTS | Ch. 13 |
| Clés d'idempotence (24 h), limite de concurrence (429), signal « toujours vivant » sur les flux | Exécuteur Inngest | Ch. 11 |

Limite assumée : les deux filtres sont des garde-fous par motifs, pas des preuves. Ils s'ajoutent aux vraies protections (outils autorisés par agent, confirmation avant action visible) et ne les remplacent pas. Hermes pourrait un jour servir d'**outil** d'un agent (veille), pas de moteur.

## 6. Comptes à créer (au moment où on en a besoin)

| Service | Ch. | Remarque |
|---|---|---|
| GitHub | 2 | Dépôt public, création et pull requests avec la CLI `gh` |
| CodeRabbit | 2 | Connexion avec GitHub. Vérifier l'offre gratuite à l'inscription |
| Supabase | 3 | Offre gratuite : projet PostgreSQL + stockage. Projet mis en pause après 7 jours de **faible** activité (e-mail d'avertissement une semaine avant ; restaurable pendant un an, données et réglages conservés). On n'utilise **pas** son système de comptes |
| Google Cloud Console | 3 | Création d'un identifiant OAuth (gratuit) pour « Continuer avec Google » |
| Google AI Studio (Gemini) | 9 | Clé API gratuite, sans carte. Sert aux agents (ch. 9) et aux images (ch. 12). Les données de l'offre gratuite peuvent servir à Google : rien de sensible |
| OpenRouter *(optionnel, D9)* | 9 | Une seule clé pour de nombreux modèles, dont des modèles gratuits (`:free`) et DeepSeek. Un achat unique de 10 $ de crédits fait passer le quota gratuit de 50 à 1 000 requêtes/jour. Les modèles gratuits peuvent journaliser les requêtes : rien de sensible |
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
| D1 | Quel LLM pour les agents ? (ch. 9) | Modèles OpenAI avec tokens gratuits quotidiens contre partage des données | ✅ **Décidé : Gemini** (offre gratuite d'AI Studio), branché sur l'OpenAI Agents SDK via l'adaptateur AI SDK. L'offre OpenAI n'est plus disponible pour ton compte. **Révisée le 28/10/2026** : pour le chat, l'AI SDK seul (voir ci-dessus), sans adaptateur ; le SDK OpenAI Agents reste candidat pour le chapitre 10 |
| D2 | Où stocker la clé du service de publication ? (ch. 14) | En base, chiffrée, par utilisateur (clé de chiffrement dans `.env.local`) | Suivre la vidéo : c'est l'occasion d'apprendre le chiffrement (AES-GCM) |
| D3 | Suivi « en temps réel » des agents (ch. 10–12) | Non expliqué dans la vidéo | Rafraîchissement périodique (polling) toutes les 2–3 s d'abord, simple à comprendre |
| D4 | Faire le chapitre 17 (E2B) ? | Oui | À décider après le chapitre 16 |
| D5 | Quel service de publication ? (ch. 14) | Blotato (payant) | **Buffer** (gratuit, mais réservé à un usage personnel : convient au développement et à mes propres comptes) · **API Instagram de Meta** (gratuite, vraies statistiques, mise en place plus longue, validation Meta nécessaire pour publier sur les comptes d'autres personnes) · **Blotato** (29 $/mois, 20 comptes, gère la vidéo). **Tendance :** Buffer pendant le développement, Blotato dès qu'il faut gérer plusieurs comptes. Grâce à l'interface « publicateur », le changement ne touche qu'un fichier. À décider avant le chapitre 14 |
| D6 | Dépôt GitHub public ou privé ? (ch. 2) | — | **Public**, pour que CodeRabbit fasse des revues complètes (sur un dépôt privé, l'offre gratuite ne fait que des résumés). Donc aucun secret commité, et le fichier `text` (transcription d'une vidéo tierce) ajouté à `.gitignore` |
| D7 | Où héberger l'application ? (ch. 18) | — | À décider au chapitre 18, selon que des clients payants l'utilisent déjà ou non |
| D9 | Quels modèles, et comment alterner entre les quotas ? (ch. 9, étendu au ch. 12) | Un seul fournisseur (modèles OpenAI) | **Trois niveaux avec repli**, branchés par l'adaptateur AI SDK déjà prévu (D1), donc un seul fichier à changer : **Maître** (plan, sortie structurée, appels d'outils fiables) = modèle solide (Gemini ou DeepSeek « Pro ») · **Agents de travail** (rédaction, résumés) = modèle très bon marché (DeepSeek « Flash », ordre de grandeur 0,07 $ / 0,18 $ par million de tokens) · **Secours** = modèles `:free` d'OpenRouter (20 requêtes/min ; 50/jour, ou 1 000/jour après 10 $ de crédits achetés au total) puis quota gratuit de Gemini. Les agents lisent une **liste ordonnée de modèles** (pas un modèle codé en dur) : en cas d'erreur 429 ou de modèle retiré, on passe au suivant. **Règles :** aucune donnée client sur un modèle gratuit ; chaque modèle est testé sur une tâche d'appel d'outil avant adoption. Chiffres à revérifier sur les pages officielles au moment d'ouvrir le compte |
| D10 | Quel moteur pour le Maître ? (ch. 10) | AI SDK seul · SDK OpenAI Agents · Mastra · LangGraph.js · `WorkflowAgent` | 🟢 **Retenue le 28/10/2026 (proposée, puis chapitre 10 construit dessus avec l'accord de l'utilisateur) : AI SDK seul, sans nouveau framework.** Le besoin : le Maître pose des questions, produit un **plan structuré** (tâches, agent assigné, dépendances) et un rapport visible. Cela se fait avec la sortie structurée de l'AI SDK (`Output.object` + zod), nos tables `agent_tasks` et `agent_communications` comme **source de vérité** (l'interface les lit), et, au chapitre 11, chaque tâche exécutée par `ToolLoopAgent` dans une étape Inngest (reprises et relances gérées par Inngest). **Pourquoi pas les autres :** le SDK OpenAI Agents apporte les passages de main (transfert d'un agent à l'autre dans une même conversation), pas des tâches durables avec dépendances ; Mastra et LangGraph.js ont chacun leur propre moteur d'état et de reprise (workflows et mémoire pour l'un, points de sauvegarde et interruptions pour l'autre), qui feraient double emploi avec Inngest et notre base ; `WorkflowAgent` demande l'environnement Vercel Workflow, en concurrence avec Inngest. **À reconsidérer** si un futur domaine demande de longues boucles avec interruption humaine (LangGraph ou Mastra deviennent alors sérieux). **À vérifier avant de trancher** : ces comparaisons viennent de la documentation de l'AI SDK installée et de résumés web (la version de Mastra, 1.x, varie selon les sources) ; lire les pages officielles de l'outil retenu avant de l'adopter |
| D8 | Auth, base et stockage (ch. 3) | InsForge, service propriétaire tout-en-un | ✅ **Décidé : Better Auth** (bibliothèque open source MIT, comptes dans notre base) + **PostgreSQL et stockage Supabase** (open source, standard). Si un hébergeur ferme : export de la base, nouvelle adresse dans `.env.local`, les comptes suivent |

## 8. Risques et points à vérifier

- **Alertes `npm audit` (28/10/2026) : 7, toutes dans des outils de développement** (`drizzle-kit` via un ancien `esbuild`, et le CLI `shadcn` via `deepmerge`), aucune dans le code livré. L'`esbuild` concerné n'est dangereux que pour son serveur de développement, que `drizzle-kit` ne lance pas. **Ne pas lancer `npm audit fix --force`** : il fait descendre `drizzle-kit` à 0.18.1 et casse les migrations. À revérifier à chaque chapitre qui ajoute des dépendances, et mettre `drizzle-kit` et `shadcn` à jour dès qu'une version sans l'alerte sort.
- **Boilerplate de la vidéo introuvable** : remplacé par `create-next-app` officiel. On ajoute shadcn, Drizzle et Inngest nous-mêmes.
- **Prompts de la vidéo indisponibles** (document Eraser) : on reconstruit chaque chapitre à partir de la transcription et de la doc officielle.
- **Next.js 16** : version récente avec des changements. Lire `node_modules/next/dist/docs/` avant d'utiliser une API (voir `AGENTS.md`).
- **Versions au 26/10/2026** : `ai` 7.0.155 et `@ai-sdk/google` 4.0.107 (installés le 28/10/2026 ; `@openai/agents` 0.21.0 non installé, voir D1), `zod` 4.6.7, `inngest` 4.26.0, `better-auth` 1.7.14, `drizzle-orm` 0.45.4, `@google/genai` 2.31.0, `@imagekit/next` 2.1.6, `@e2b/desktop` 2.5.0. On revérifie au moment d'installer.
- **Gemini à la place d'OpenAI** : la vidéo s'appuie sur l'outil de recherche web *hébergé par OpenAI*, qui ne marche pas avec Gemini. Au chapitre 12, on écrira notre propre outil de recherche, ou on utilisera la recherche Google intégrée à Gemini si elle se combine avec nos autres outils (à vérifier).
- **Quotas de l'offre gratuite Gemini** : limites par minute et par jour (chiffres différents selon les sources). Un plan de l'agent maître déclenche plusieurs appels : on surveillera les erreurs 429 (« trop de requêtes ») et on limitera la concurrence dans Inngest.
- **Next.js 16 et l'auth** : `middleware.ts` est déprécié et renommé `proxy.ts`. Next recommande de vérifier la session **côté serveur** (layouts, actions) plutôt que de reposer uniquement sur le proxy. Better Auth s'utilise ainsi.
- **Blotato** : base `https://backend.blotato.com/v2`, en-tête `blotato-api-key`, `POST /posts` avec `scheduledTime`, gestion via `/schedules`. **À confirmer dans la doc officielle** : le format de `scheduledTime`, la liste des comptes, le déplacement d'un post déjà programmé, et API REST ou MCP pour les agents.
- **Modèles gratuits et appels d'outils (D9)** : les petits modèles et les modèles gratuits appellent parfois mal les outils ou cassent la sortie structurée, ce dont les agents dépendent. On teste chaque modèle sur une tâche précise avant de l'ajouter à la liste. La liste des modèles gratuits change vite : d'où la liste ordonnée avec repli.
- **Abonnements « forfait fixe » à plusieurs modèles** : les offres de type « coding plan » (GLM, Kimi, MiniMax, Qwen) sont plafonnées par fenêtres de 5 heures et par semaine, et conçues pour des outils de code. Avant de les brancher sur Socialix, vérifier dans leurs conditions d'utilisation que l'usage par API depuis une application est permis. Éviter les revendeurs « illimité pour 10 $ » dont l'origine des clés n'est pas claire : coupure sans préavis et données clients exposées.
- **Cron toutes les 15 min** : une tâche d'agent peut démarrer jusqu'à 15 min en retard. Ce n'est pas grave pour la publication, dont l'heure est gérée par Blotato.
- **ImageKit** : transformations IA en bêta, paramètres exacts à vérifier au chapitre 13.

- **Better Auth 1.7 : outil en ligne de commande** : il s’appelle `auth` (`npx auth generate`), l’ancien `@better-auth/cli` est bloqué en 1.4. Il régénère `src/db/auth-schema.ts` : ne pas le modifier à la main, puis `npm run db:generate` et `db:migrate`.
- **Alertes `npm audit` (esbuild, 4 modérées)** : elles viennent de `drizzle-kit`, un outil de développement qui n’est pas dans l’application en production. Risque accepté : pas d’`audit fix --force`, qui casserait les versions. À revérifier à chaque mise à jour de `drizzle-kit`.
- **Supabase et RLS** : les tables du schéma `public` sont exposées par la Data API de Supabase, que nous n’utilisons pas. Chaque nouvelle table doit activer RLS sans règle (voir `drizzle/0001_enable-rls.sql`). Notre serveur, propriétaire des tables, n’est pas concerné.
- **Production serverless et poolers Supabase** : en production, passer `DATABASE_URL` au Transaction pooler (port 6543). Mesuré au chapitre 5 : avec les requêtes préparées que `postgres.js` utilise par défaut, derrière le port 6543 les requêtes restent **sans réponse** (blocage silencieux, pas d'erreur). `src/db/index.ts` désactive donc `prepare` automatiquement quand l'adresse est sur le port 6543 ; testé avec le vrai module sur les deux poolers (requêtes simultanées et transaction avec verrou). **Les migrations (`npm run db:migrate`) doivent, elles, utiliser le Session pooler (5432)** : `drizzle-kit` a son propre client, qui n'a pas cette protection.
- **« Mot de passe oublié »** : à ajouter quand un service d’envoi d’e-mails existera (chapitre 18 ou 19). Better Auth sait le faire, il lui faut une fonction `sendResetPassword`. Même chose pour la vérification de l’e-mail.
- **Google OAuth en production** : ajouter l’adresse du site dans les origines autorisées et l’URI de rappel `https://…/api/auth/callback/google` (chapitre 18). Application en mode « test » : seuls les utilisateurs tests peuvent se connecter ; passer en production avant d’ouvrir au public.

- **shadcn/ui : le code est à nous.** `npx shadcn add <composant>` copie le composant dans `src/components/ui/`, avec les réglages par défaut de shadcn (32 px, arrondi 12 px, anneau de focus pâle, noms de couleurs neutres). Il faut ensuite l'adapter à `docs/DESIGN.md` (voir « Implémentation » dans ce fichier). Les mises à jour de shadcn n'écrasent rien : on recopie à la main ce qui nous intéresse. Le paquet `shadcn` lui-même (la CLI, qui fournit aussi `shadcn/tailwind.css`) reste en `devDependencies` : il ne sert qu'à la compilation, et en production il apporterait trois alertes `npm audit` de gravité faible (`deepmerge`).
- **Paquet `cn`** : la CLI de shadcn 4.x l'utilise à la place de `clsx` + `tailwind-merge` (même auteur, MIT, aucune dépendance). Vérifié au chapitre 4 ; on le garde, car chaque composant ajouté l'importe.
- **`next-themes` 0.4.6** : dernière publication en mars 2025, mais très utilisé et compatible React 19. Si un jour il pose problème, le remplacer par un petit script maison (classe `dark` + `localStorage`).

- **Téléversement de fichiers (chapitre 5)** : Next refuse par défaut un corps de Server Action de plus de 1 Mo ; `next.config.ts` le relève à 4 Mo (`experimental.serverActions.bodySizeLimit`). Le bucket Supabase n'impose ni taille ni type : tout est contrôlé côté serveur sur les **octets** reçus (`src/lib/logo-check.ts` : taille, signature PNG / JPEG / WebP). Le nom du fichier est généré par le serveur, jamais repris du navigateur. Un fichier supprimé du stockage peut rester servi par le CDN de Supabase pendant environ une minute s'il avait déjà été lu : sans conséquence pour des logos publics, mais à retenir pour des fichiers privés (chapitre 12 : utiliser des liens signés).

- **Isolation des données (chapitre 6, fait)** : `getMyCampaign(id)` (`src/lib/dal.ts`) cherche par `id` **et** propriétaire, et `requireMyCampaign` renvoie `notFound()`. Testé avec trois comptes : la campagne d'un autre, une campagne inexistante et des identifiants piégés (`not-a-uuid`, `'; drop table…`, `../../api…`) donnent **exactement le même écran**. Le statut HTTP reste **200** (la page est diffusée en flux derrière un `<Suspense>`, comportement documenté de `notFound()`), donc c'est le **contenu** de la réponse qui compte : il ne contient aucune donnée de l'autre compte. Chaque nouvelle page ou route d'une campagne doit appeler `requireMyCampaign`, ou passer sous le layout `[campaignId]` qui le fait.
- **Cookie « dernière campagne »** : `socialix_campaign` (httpOnly, SameSite=Lax, un an) n'est qu'une **préférence**. `/dashboard` le compare à la liste des campagnes de l'utilisateur connecté et l'ignore s'il n'y figure pas : absent, périmé, falsifié ou venant d'un autre compte, il retombe sur la campagne la plus récente. Il est posé à la création d'une campagne et, à l'étape 6.3, au choix dans le sélecteur.
- **Redirection après connexion** : elle vit dans la page `/dashboard` (sans campagne, `redirect("/campaigns/new")`), pas dans les formulaires de connexion : le chemin est le même pour l'e-mail et pour Google. Au chapitre 6, « avec campagne » mènera à la vue d'ensemble de la dernière campagne ouverte.
- **Tests de bout en bout** : un test avec un vrai navigateur a trouvé deux défauts que `tsc`, `lint` et `build` laissaient passer (bouton « Continuer » qui envoyait le formulaire, image du décor non chargée dans une zone cachée). Pour une page interactive, un test de ce type fait partie de « fini ».

- **Audit d'accessibilité (méthode)** : `axe-core` (MPL-2.0, Deque), exécuté dans un vrai Chrome sur chaque page en Jour et en Nuit, menu replié et déplié, menus ouverts, tiroir mobile et écrans de connexion, avec les règles WCAG 2.2 AA et les bonnes pratiques. Installé **hors du projet** (non ajouté aux dépendances). Il a trouvé au chapitre 6 deux vrais défauts (boutons du menu replié sans nom accessible, barre latérale hors de tout repère) que ni `tsc`, ni `lint`, ni les captures ne montraient. À refaire à chaque chapitre qui ajoute des écrans.
- **Cache Components et `notFound()`** : voir « Isolation des données » plus haut.

- **Statut `to_review` (« À valider »)** : ajouté aux quatre statuts du plan initial, car la charte décrit cinq états et la carte « À valider » de la vue d'ensemble doit compter les posts que l'équipe IA remet à l'humain. Un **brouillon n'est pas « à valider »** : il est hachuré dans la bande des 7 jours mais ne compte pas dans la carte.
- **Jours et fuseau** : les dates sont en UTC dans la base, mais « aujourd'hui » et le découpage de la bande des 7 jours se font en `Europe/Paris` (`src/lib/overview-queries.ts`). Testé à la frontière : un post à 00 h 30 le 9 à Paris (23 h 30 UTC le 8) n'est pas compté le 8. `queryOverviewUnchecked` ne vérifie pas la propriété : seul `getOverview` (DAL) doit l'appeler.

- **Mouvement réduit et thème dans les tests** : un navigateur peut recevoir `prefers-reduced-motion: reduce` (réglage d'animations du système) et `prefers-color-scheme: dark` sans qu'on l'ait demandé. Le site les respecte : la pastille « en cours » ne respire pas et les personnages « au travail » ne bougent pas. Conséquence pour les tests : toujours fixer explicitement ces deux préférences avant de mesurer une animation ou une couleur.
- **Une erreur simulée n'est pas une erreur réelle** : au chapitre 9, 26 contrôles passaient avec un quota simulé, et c'est un vrai quota Gemini épuisé (429) qui a montré que l'AI SDK enveloppe l'erreur dans un `RetryError` : le quota n'était pas reconnu. Règle : quand l'occasion se présente d'observer une vraie panne, la tester dans le vrai navigateur, et garder un test de non-régression qui n'en dépend pas (`statusOf`).
- **Taper avant l'hydratation, cliquer avant l'activation** : les tests de bout en bout doivent attendre que la page soit interactive (props React présentes sur le champ) et que le bouton soit actif, sinon ils réussissent ou échouent selon la vitesse du serveur.
- **Un journal ne doit jamais contenir ce que les gens écrivent** : au chapitre 10, un test d'échec d'enregistrement a montré que le message d'erreur de la base recopie les paramètres de la requête, donc le texte du message de la personne. On journalise le code d'erreur, jamais `error.message` (règle dans `CLAUDE.md`).
- **Annuler ne détruit jamais un résultat** : `cancelPlanAs` n'annule que les tâches en attente ou en cours, jamais une tâche terminée, et ne touche pas un plan terminé. Annuler deux fois, ou trois fois en même temps, donne le même état (idempotent). Le plan annulé est « annulé » en base, pas supprimé : on garde l'historique de ce qui a été décidé.
- **Un faux modèle remplace le quota** : `MockLanguageModelV4` (paquet `ai/test`) permet de faire dire au « modèle » exactement ce qu'on veut (question, plan valide, plan avec cycle, texte absurde, erreur 404 ou 401) : le Maître est testé à fond sans appeler Gemini.
- **Zones cliquables qui se recouvrent** : au chapitre 8, les étiquettes larges du bureau (« planificateur », « analytique ») recouvraient les personnages voisins ; cliquer au centre de Recherche ouvrait Planificateur. Seul un test qui clique au vrai point l'a montré (`elementFromPoint` sur chaque personnage). Règle : l'étiquette est le lien (clavier, lecteur d'écran) et passe au-dessus ; le personnage est un lien réservé à la souris (`aria-hidden`, `tabIndex -1`).
- **Une capture vaut plus que des classes CSS** : au chapitre 7, 31 contrôles passaient alors que les étiquettes étaient illisibles (C = O) ; seule la capture l'a montré, puis un test de non-chevauchement a trouvé le seuil réel (512 px). Pour tout rendu visuel, regarder la capture **et** ajouter la mesure qui l'aurait trahi.

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
- [x] **Chapitre 2** : dépôt public GitHub, CodeRabbit, première pull request fusionnée (n° 1)
- [x] **Chapitre 3** : Supabase (PostgreSQL 17) + Drizzle + Better Auth : migrations `0000_auth` et `0001_enable-rls`, pages `/sign-in` et `/sign-up` (règles de mot de passe CNIL), connexion Google, `/dashboard` protégé (proxy + `verifySession`)
- [x] **Chapitre 4** : shadcn/ui (base Radix) avec la charte de `docs/DESIGN.md` : variables Jour/Nuit, composants `Button`, `Input`, `Label`, `DropdownMenu` adaptés (44 px, arrondi 10 px, focus encre), bouton Jour/Nuit (`next-themes`, classe `dark`)
- [ ] **Chapitre 5** (en cours, branche `ch5-campagne`) : table `campaigns`, règles de validation, stockage S3 des logos, page `/campaigns/new` en 2 étapes, liste sur `/dashboard`, redirections. Reste : pull request et relecture
- [ ] **Chapitre 6** (en cours, branche `ch6-layout`) : barre latérale adaptée, routes `/dashboard/[campaignId]/…` avec isolation, menu (sélecteur, 7 sections, profil), en-tête avec « Créer un post », audit d'accessibilité. Reste : pull request et relecture
- [ ] **Chapitre 7** (en cours, branche `ch7-vue-ensemble`) : table `posts`, requêtes de la vue d'ensemble (fuseau Paris), bureau isométrique, page `/overview` (3 cartes, bande de 7 jours, listes). Testé : 44 contrôles + axe. Reste : documentation finale, pull request et relecture
- [ ] **Chapitre 8** (en cours, branche `ch8-agents`, empilée sur `ch7-vue-ensemble`) : page Agents (équipe, onglets Discussion / Tâches / Historique / Réglages, journal en direct), composant de chat unique, panneau de chat à gauche ouvert depuis le bureau (adresse `?chat=`). Aucune IA : tout est honnêtement vide ou désactivé jusqu'au chapitre 9. Testé : 67 contrôles + axe. Reste : pull request et relecture
- [ ] **Chapitre 9** (en cours, branche `ch9-agents-gemini`) : consignes des 5 agents et de leur équipe, liste de modèles avec repli, table `messages`, chat serveur (`chat-service`, limite de 10 messages par minute), chat branché sur la page Agents et dans le panneau du bureau. AI SDK à la place du SDK OpenAI Agents (D1 révisée). Reste : tests de refus entre agents sur toute l'équipe, PR et relecture
- [x] **Chapitre 10b : projets et domaines** (branche `ch10b-projets`, empilée sur `ch10-maitre`). Vision de l'utilisateur : chaque personne vient avec SON projet (audio-description, marketing, prospection, montage…) et les agents sont prêts, quel que soit le domaine. Fait : la table `campaigns` devient `projects` (migration 0007, `RENAME` : les 6 lignes existantes conservées, vérifiée d'abord dans une transaction annulée) avec une colonne `teams` (domaines activés, au moins un, `marketing` par défaut) ; « campagne » devient « projet » dans le code, l'interface et les adresses (`/dashboard/[projectId]`, `/projects/new`) ; `src/lib/agents.ts` distingue les agents **communs** (Maître, Recherche) et ceux d'un **domaine** (marketing : Créateur, Planificateur, Analytique ; prospection : Qualificateur, Propositions, Suivi) ; le Maître, les consignes, la liste d'équipe, le bureau et le chat ne voient que les agents du projet ; le formulaire de création propose les domaines. Les agents sans poste dessiné dans le bureau restent listés sous la scène. Ajouter un domaine = une entrée dans `TEAMS`, des agents, un contexte dans `agent-instructions.ts`. Tests : `teams-test` (39), plus les suites des chapitres 9 et 10 rejouées sous le nouveau vocabulaire.
- [x] **Chapitre 10** (terminé côté code, PR n°9 à relire, branche `ch10-maitre`, empilée sur `ch9-agents-gemini`) : 10.1 tables du plan (faite) · 10.2 validation du plan, sans cycle (faite : `src/lib/plan.ts`, 32 contrôles dont 800 plans aléatoires) · 10.3 le Maître : questions ou plan structuré, correction par renvoi des défauts, enregistrement en une transaction (faite : `master.ts`, `plan-service.ts`, 34 contrôles avec un faux modèle ; le premier essai avec le vrai Gemini attend le quota) · 10.4 carte du plan, onglet Tâches, annulation (faite : `plan-card.tsx`, `plan-queries.ts`, 27 contrôles serveur et 58 de bout en bout) · 10.5 bilan « 1 terminée sur 3 » sur la carte (`summarizeTasks`) et passage automatique d'un plan fini à « terminé » (`settlePlan`, 10 contrôles ; sera appelée par l'exécuteur du chapitre 11), documentation, PR. **Reste à faire avec le quota Gemini (étape 9.6) : premier vrai plan du Maître.**
- [ ] Phase 1 : [ ] 5 · [ ] 5 · [ ] 6 · [ ] 7 · [ ] 8 · [ ] 9 · [ ] 10 · [ ] 11 · [ ] 12 · [ ] 13 · [ ] 14 · [ ] 15 · [ ] 16 · [ ] 17 (option)
- [ ] Phase 2 : [ ] 18 · [ ] 19 · [ ] 20
- [ ] Phase 3 : [ ] 21 · [ ] 22 · [ ] 23 (option)
