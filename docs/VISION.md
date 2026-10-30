# Vision : un moteur d'agents pour plusieurs domaines

> Écrite le 28/10/2026. Ce document ne change pas l'ordre des chapitres de `PLAN.md` : il dit **où va le moteur** et ce qu'il doit savoir faire pour y arriver. Le marketing (Socialix) est le premier domaine, parce qu'il permet de construire et de tester le moteur de bout en bout.

## Principe

L'IA produit, les outils exécutent, les tests vérifient, l'humain garde le contrôle. Il ne s'agit pas de multiplier les agents, mais de leur donner chacun un **rôle précis, des outils autorisés, une mémoire utile et des critères de vérification**.

## Ce que le moteur doit offrir (quel que soit le domaine)

| Besoin | Où c'est construit |
|---|---|
| **Agent = donnée** : rôle, instructions, outils autorisés, modèles, appartenance à une équipe | Chapitre 9 (`team`, instructions, liste de modèles) ; outils au chapitre 12 |
| **Plan et tâches avec dépendances**, un agent orchestrateur qui découpe et distribue | Chapitre 10 |
| **Tâches de fond** (séquentielles ou parallèles), reprise après erreur | Chapitre 11 |
| **Points de validation humaine** avant toute action extérieure (publier, envoyer, payer) | Statut `to_review` (chapitre 7), validation dans l'interface (chapitres 13-14) |
| **Preuves, pas des annonces** : un agent ne dit pas « ça marche », il fournit le résultat des tests ou le livrable | Critère de vérification par agent, à ajouter avec les outils (chapitre 12) |
| **Agent de contrôle qualité** qui relit chaque production avant l'humain | Premier agent à ajouter après le chapitre 15 |
| **Mémoire utile** : informations structurées (préférences, décisions), pas tout l'historique de conversation | Table à concevoir après le chapitre 10 |
| **Journal d'exécution et suivi des appels** (erreurs, coûts, durée) | Journal en direct (chapitre 8, interface) ; suivi des appels au chapitre 18 |
| **Amélioration continue** : erreurs et retours → correction → tests → validation | Après le chapitre 15, toujours avec validation humaine : le système ne modifie jamais seul sa production |

## Catalogue de domaines (à ne pas lancer en même temps)

Développement logiciel · Audio (transcription, traduction, sous-titres, voix de synthèse) · Vidéo et création par IA · Marketing et acquisition · Prospection et ventes · Gestion et finances · Formation et produits numériques · Cybersécurité et assurance qualité (tests **autorisés** par le propriétaire) · Recherche, veille et analyse de données · Support client · Commerce en ligne et catalogues · Gestion de projets et assistant personnel.

Chaque domaine = une **équipe** (un contexte, des agents, des outils). Ajouter un domaine ne doit pas demander de réécrire le moteur.

**Un projet choisit ses domaines** (colonne `projects.teams`, chapitre 10b) : il dispose des agents communs (Maître, Recherche) et de ceux de chaque domaine activé. Les domaines sont **préparés d'avance** dans un catalogue (`TEAMS` dans `src/lib/agents.ts`) : le système ne crée pas d'agents à la volée, ce qui serait difficile à tester et à borner. Domaines présents : marketing et prospection. Un agent n'est utile que par ses outils : sans outils (chapitre 12), les agents d'un nouveau domaine discutent et conseillent seulement.

## Le catalogue visé (décidé avec l'utilisateur le 28/10/2026)

Chaque domaine couvre **toute sa chaîne**, du besoin au résultat.

| Domaine | Chaîne d'agents | État |
|---|---|---|
| **Marketing digital** | recherche de marché → stratégie → création → planification → analyse | Présent (Maître, Recherche, Créateur, Planificateur, Analytique), sans outils |
| **Prospection** | qualification → proposition → suivi (veille et analyse viendront avec les outils) | Présent depuis le 28/10 (Qualificateur, Propositions, Suivi), sans outils. Premier domaine hors marketing |
| **Montage vidéo** | scénario → découpage → prompts → montage → déclinaisons | À faire, relié à Video Studio (voir plus bas) |
| **Produits digitaux** | problème du marché → solution → offre → système de vente | À faire ; la validation de la demande passe avant tout investissement |

L'agent Recherche (commun) sert la recherche de marché des trois derniers domaines.

## Principes retenus

- Construction **hybride** : orchestrer d'un côté, coder les parties complexes de l'autre.
- Budget maîtrisé : le quota gratuit des modèles est une contrainte réelle (plafond de jetons par personne, au chapitre 11).
- Autonomie : **les agents préparent, la personne valide les actions sensibles**.
- Règle de calcul : tout ce qui est déterministe (facture, total, date) se fait par une fonction classique testée, jamais par le modèle.

## Studio 360 et Flow MCP (le montage vidéo)

Deux outils **locaux** (sur la machine de l'auteur) :

- **Studio 360** : un logiciel de montage vidéo tout-en-un, **fork de HyperFrames** (Apache 2.0) avec nos extensions (relecture, storyboard, générateurs, montage de rushes, musique, kits de marque, zones de sécurité). Il expose un **serveur MCP `studio-360` de 56 outils** (projets, marques, contrôle qualité, relecture et versions, storyboard, génération Flow, montage, musique…) que Claude Code pilote.
- **Flow MCP** : un programme qui ouvre une fenêtre Chrome à part, s'y connecte à Google Flow avec un compte Google personnel et clique les vrais boutons pour générer images et courtes vidéos, avec les crédits d'un abonnement Google AI (sans l'API payante). Studio 360 s'en sert pour ses outils `generate_image` et `generate_clip`.

**Exception encadrée, pas une règle de Socialix.** Flow MCP pilote un navigateur, ce que les garde-fous ci-dessous interdisent aux agents de Socialix. Il reste donc **hors du code de Socialix** : un outil de l'auteur, lancé à la main sur sa machine, pour ses propres projets. Aucun agent hébergé, aucun projet de client ne s'en sert.

**Ce que cela implique pour Socialix**
- Le domaine **montage vidéo** ne peut tourner que **sur la machine de l'auteur** : Flow MCP a besoin d'un Chrome réel et d'un écran allumé, et il automatise l'interface web de Flow (zone grise des conditions d'utilisation de Google, risque limité à un compte personnel, jamais celui d'un client).
- Piste d'intégration (chapitre 12) : un agent « Monteur » qui appelle les outils MCP de Studio 360 depuis l'application lancée en local (le SDK que nous utilisons sait se connecter à un serveur MCP). Une génération Flow qui dépense des crédits attend toujours l'accord explicite de la personne : c'est déjà la règle de Studio 360.
- Pour des clients hébergés, il faudrait un autre moteur de génération (API officielle) : décision à prendre à ce moment-là, pas maintenant.
- Pas avant le chapitre 12, et avant cela, la prospection et le marketing donnent des revenus sans dépendre de ces outils.

## Les workflows visés

- **Idée → logiciel** : analyse, recherche, architecture, développement par petites fonctionnalités, tests, documentation. Points de contrôle : architecture, tests, mise en production.
- **Trouver des clients** : veille des besoins, qualification, estimation, proposition personnalisée, suivi, mesure des résultats. Une proposition précise à un problème précis, pas des envois en masse.
- **Service audio** : un fichier déposé → vérification, transcription, correction, traduction, sous-titres (SRT/VTT), voix de synthèse, contrôle qualité, dossier de livraison.
- **Projet marketing complet** : brief, audience, stratégie, scripts, visuels, déclinaisons, contrôle qualité, rapport. Aucune publication ni dépense sans autorisation.
- **Micro-logiciel par abonnement** : problème récurrent, **validation de la demande avant d'investir**, prototype, tests, paiement et accès, lancement, support.
- **Administration** : commande, dossier, devis, échéances, facture, suivi des paiements, archivage. Les paiements et décisions financières restent soumis à validation.
- **Amélioration continue du système** : voir ci-dessus.

## Garde-fous (valables pour tous les domaines)

- Aucun agent ne se connecte à un compte avec un navigateur ; on passe par des API officielles.
- Aucune collecte de données contre les règles d'un service ; prospection par e-mail encadrée (consentement, désinscription, motif légitime), à vérifier avant le premier envoi.
- Aucune donnée client sur une offre gratuite qui s'en sert pour l'entraînement.
- Un agent peut accélérer la construction, il ne garantit ni la demande ni les ventes.

## Ordre proposé

1. **Marketing** : chapitres 1 à 15 de `PLAN.md` (construit le moteur).
2. **Un deuxième domaine**, choisi quand le critère de fin du chapitre 15 est atteint : celui qui a un cas concret et un client possible. Le moteur doit alors tenir sans réécriture ; sinon, c'est qu'il était trop lié au marketing, et on le corrige.
3. Les autres domaines au fil des besoins, un à la fois.
