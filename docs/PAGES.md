# Fiches des pages — Socialix

> Une fiche par écran : à quoi il sert, ce qu'il contient, ses états, ses interactions. Style : voir `DESIGN.md`.
> Chaque fiche indique le chapitre du `PLAN.md` où l'écran est codé. Statut : **à valider** (26/10/2026).

**Règle pour tous les écrans :** prévoir quatre états. **Vide** (aucune donnée, avec une action pour démarrer), **chargement** (squelettes gris aux formes du contenu, pas de roue qui tourne au milieu de la page), **erreur** (ce qui s'est passé + comment réessayer), **rempli**.

**Plan du site :**

```text
/sign-in, /sign-up                     → 1. Connexion
/projects/new                         → 2. Création de projet
/dashboard/[projectId]/…              → 3. Cadre commun (menu + en-tête) autour de :
    overview                           → 4. Vue d'ensemble
    agents                             → 5. Agents IA
    posts                              → 6. Posts
    posts/new, posts/[id]/edit         → 7. Éditeur de post
    calendar                           → 8. Calendrier
    analytics                          → 9. Analytique
    accounts                           → 10. Comptes
    settings                           → 11. Réglages
/review/[token]                        → 12. Validation client (sans compte)
```

---

## 1. Connexion et inscription · ch. 3

**Rôle :** entrer dans l'application. Seule page vue par un visiteur non connecté.

**Contenu :**
- Colonne gauche : logo Socialix, titre « Connexion » (ou « Créer un compte »), bouton **Continuer avec Google**, séparateur « ou », champs e-mail et mot de passe, bouton principal, lien vers l'autre page (connexion ↔ inscription), lien « mot de passe oublié ».
- Colonne droite (masquée sur téléphone) : le bureau isométrique en thème Nuit, les agents au repos. Une phrase : « Ton équipe d'agents t'attend. »

**États :** chargement sur le bouton cliqué (texte « Connexion… », bouton désactivé) · erreur « E-mail ou mot de passe incorrect » sous le formulaire · e-mail déjà utilisé à l'inscription · échec Google (« La connexion avec Google a échoué, réessaie »).

**Après connexion :** aucun projet → `/projects/new` ; sinon → vue d'ensemble de la dernière projet ouverte.

---

## 2. Création de projet · ch. 5

**Rôle :** créer un espace de travail (un projet = une marque ou un client).

**Contenu :** une carte centrée, **sans défilement**, avec un indicateur d'étapes « 1 Identité · 2 Bureau ».
- **Étape 1 · Identité** : nom du projet (obligatoire), logo : choisir parmi quelques icônes proposées **ou** téléverser une image (PNG, JPG ou WebP, 3 Mo max), avec aperçu immédiat. Bouton « Continuer ».
- **Étape 2 · Bureau** : deux grandes vignettes cliquables, **Atelier bois** et **Bureau moderne**, avec un aperçu des agents en place. Boutons « Retour » et **Créer le projet**.

**États :** nom vide (message sous le champ) · fichier trop lourd ou mauvais format (« 3 Mo maximum, PNG, JPG ou WebP ») · téléversement en cours (barre fine) · création en cours · erreur serveur (« Le projet n'a pas pu être créée, réessaie »).

**Après création :** vue d'ensemble de la nouveau projet.

---

## 3. Cadre commun : menu et en-tête · ch. 6

**Rôle :** naviguer et garder le contexte (quelle projet, que faut-il faire).

**Menu latéral :**
- **Replié par défaut** (icônes seules, info-bulle au survol), dépliable par un bouton. Le choix est mémorisé.
- En haut : logo + **sélecteur de projet** (liste des projets + « Nouveau projet »).
- Liens : Vue d'ensemble · Agents IA (« 1 actif ») · Posts (nombre à valider) · Calendrier · Analytique · Comptes · Réglages. Compteurs en mono. Lien actif = pilule encre.
- En bas : carte accent **« Équipe IA »** (pastille qui respire si un agent travaille, lien « N posts à valider »), puis le profil (nom, menu : thème Jour/Nuit, déconnexion).

**En-tête de chaque page :** titre et sous-titre de la page à gauche ; à droite la recherche et le bouton **Créer un post**, qui ouvre un petit choix « Avec l'équipe IA » (→ Agents) ou « À la main » (→ Éditeur).

**Téléphone :** le menu devient un tiroir ouvert par un bouton ; l'en-tête garde le titre et le bouton Créer.

**Réalisé au chapitre 6, avec ces écarts assumés (pas de faux contenu) :**
- Pas de compteurs (« 1 actif », « N à valider ») ni de lien « N posts à valider » : il n'y a encore ni agent ni post. La carte « Équipe IA » dit « Tes agents sont au repos », pastille grise.
- Pas de champ de recherche : rien à chercher avant le chapitre 13.
- « Créer un post » : « Avec l'équipe IA » mène à la page Agents ; « À la main » est grisé, « Bientôt » (l'éditeur arrive au chapitre 13).
- Le profil contient le choix du thème Jour / Nuit / Système et la déconnexion.
- Changer de projet dans le sélecteur garde la même section et mémorise le projet.

---

## 4. Vue d'ensemble · ch. 7 (panneau de chat : ch. 8)

> **Réalisée au chapitre 7**, avec trois écarts assumés : les agents du bureau ne sont pas cliquables avant le chapitre 8 (pas de panneau de chat encore) ; « Activité récente » affiche un état vide honnête jusqu'aux chapitres 10-11 ; pas d'emoji sur les étiquettes, conformément à DESIGN.md.

**Rôle :** voir en 5 secondes où en est le projet et ce qui attend une décision.

**Contenu (maquette « Jour ») :**
- Trois cartes de tailles et de styles **différents** : « Programmés cette semaine » (gros chiffre + bande des 7 jours, jours non validés hachurés) · **« À valider »** en accent (chiffre + « Relire maintenant ») · « Publiés · 30 derniers jours ».
- Colonne gauche : liste **À valider** (vignette, titre, `jour · heure · réseau`, bouton Relire), puis **Activité récente** (heure en mono + phrase : « Le Maître a créé un plan de 3 tâches »).
- Colonne droite : **le bureau isométrique** du thème choisi (bois ou moderne), agents placés d'après le JSON de l'Office Builder, étiquette pixel au-dessus de chacun, pastille d'état.

**Interactions :** cliquer sur un agent dans le bureau ouvre un **panneau de chat à gauche** (même composant que la page Agents), sans quitter la page. Survol d'un agent : son étiquette indique ce qu'il fait (« Rédige le post 2 »).

**États :** nouveau projet → état vide : « Rien de prévu pour l'instant » avec deux boutons, « Demander à l'équipe IA » et « Créer un post ». Statistiques avant toute publication : tiret + phrase explicative, jamais de zéro trompeur.

---

## 5. Agents IA · ch. 8 à 12 (Ordinateur : ch. 17)

> **Plans du Maître (chapitre 10)** : la carte du plan (tâches numérotées « 01 », agent, état en texte, « après 02 », consigne dépliable, « Annuler le plan » avec confirmation) s'affiche sous la réponse du Maître et dans l'onglet Tâches (tous les plans pour le Maître, uniquement ses tâches pour un agent de travail). L'état est partagé entre les deux sans rechargement.
>
> **Interface réalisée au chapitre 8**, **chat branché à Gemini au chapitre 9** (messages enregistrés par projet et par agent, réponse mise en forme, erreurs et quota annoncés sans perdre le texte). Équipe, 4 onglets, journal restent honnêtement vides là où il n'y a pas encore de données. L'agent ouvert est dans l'adresse (`?agent=`). Écarts assumés : le chat n'a ni bulles ni carte de plan (il n'y a rien à y afficher avant le chapitre 9) ; les onglets Tâches, Historique et Réglages affichent un état vide qui dit à quel chapitre le contenu arrive ; le panneau du bureau (fiche 4) réutilise le même composant de chat.

**Rôle :** donner des consignes à l'équipe et suivre son travail.

> **Chapitre 12 :** « Voir le résultat » d'une tâche montre aussi les **images** que l'agent a produites (miniatures de 160 px qui s'ouvrent dans un nouvel onglet, avec un texte alternatif) ; les documents qu'il a enregistrés sont dans la page Documents (fiche 6 bis), les brouillons de post dans la page Posts (chapitre 13).

**Contenu (maquette « Nuit ») :**
- Colonne gauche : **l'équipe**. Maître, Recherche, Créateur, Planificateur, Analytique (Vidéaste en phase 3), chacun avec son rôle et son état en une ligne. L'agent ouvert est encadré d'accent.
- Centre : l'agent ouvert, avec ses onglets **Discussion · Tâches · Historique · Réglages** (+ **Ordinateur** au ch. 17).
  - Discussion avec le Maître : messages, **carte de plan** (tâches numérotées, agent, état, dépendance « après 02 »), images générées en vignettes cliquables, zone de saisie.
  - Tâches : liste filtrable (en cours, en attente, terminées), avec bouton « Annuler le plan ».
  - Historique : ce que l'agent a fait, daté.
  - Réglages : instructions de rôle de l'agent (modifiables), activé/désactivé.
- Colonne droite : **Journal en direct** en mono (heure · agent · événement), nouvelles lignes qui apparaissent en douceur.

**États :** l'agent écrit (texte qui s'affiche progressivement) · le Maître pose une question avant de planifier (la carte de plan n'apparaît qu'après la réponse) · agent bloqué (« Attend ta réponse » + bouton pour répondre) · **quota Gemini atteint** (« L'équipe fait une pause : limite gratuite atteinte, reprise à [heure] ») · erreur d'un agent (tâche marquée échouée, bouton Relancer).

---

## 6. Posts · ch. 12 à 14

**Rôle :** voir et gérer tous les posts, qu'ils viennent des agents ou de toi.

**Contenu :**
- Onglets : **À valider** (par défaut s'il y en a) · Programmés · Brouillons · Publiés · Échecs. Compteur sur chaque onglet.
- Grille de cartes : visuel, début de la légende, pastilles des réseaux, date et heure en mono, état, auteur (« par Créateur » ou « par toi »).
- Menu de chaque carte : Modifier et reprogrammer · Déprogrammer (→ Brouillons) · Dupliquer · Supprimer (avec confirmation).
- Sur une carte « À valider » : boutons **Valider** et **Modifier** visibles directement.

> **Réalisée au chapitre 13**, avec ces écarts assumés : le « menu de chaque carte » est remplacé par des **boutons visibles** (Modifier, Déprogrammer, Dupliquer, Supprimer avec confirmation : moins de clics, et pas de menu à piéger au clavier) ; « Valider » programme directement un post d'agent qui a déjà date, réseau, légende et image, sinon il ouvre l'éditeur sur la date (`?programmer=1`) ; « Réessayer » d'un post en échec arrive avec le service de publication (chapitre 14, la base ne garde pas encore la raison de l'échec) ; un post publié ne peut que se dupliquer ; les onglets se choisissent dans l'adresse (`?statut=a-valider|programmes|brouillons|publies|echecs`).

**États :** aucun post → « Aucun post. Demande à l'équipe IA ou crée-en un. » · onglet vide (« Aucun post programmé ») · post en échec : raison affichée (« Compte Instagram déconnecté ») + Réessayer.

---

## 6 bis. Documents · ch. 12

**Rôle :** voir ce que l'équipe a produit (étude, offre, script, page de vente, proposition) et décider de ce qu'on garde. C'est le fil rouge d'un projet : l'étape suivante relit le travail de la précédente.

**Contenu :**
- Onglets : **À relire** (par défaut s'il y a quelque chose à relire, sinon Validés) · Validés · Écartés. Compteur en mono sur chaque onglet.
- Une carte par document : titre, état en pilule (À relire en accent, Validé en vert, Écarté discret), `type · par agent · date`, **Lire le document** (dépliable), boutons **Valider** et **Écarter** (sur un document à relire) ou **Remettre à relire** (sur les deux autres).
- Un document « à relire » a une bordure en pointillés (pas encore confirmé, même sens que partout).

**Règles :** un agent ne peut ni modifier ni supprimer un document, ni changer son état : il en enregistre un nouveau, « à relire ». Seule la personne valide, écarte ou remet à relire. Les agents voient l'état des documents qu'ils relisent et ne s'appuient sans réserve que sur un document validé.

**États :** aucun document → « Aucun document pour l'instant » + bouton « Parler au Maître » · onglet vide → une phrase (« Aucun document à relire. »).

**Écarts assumés :** pas de modification du texte à la main ni de recherche (rien à chercher avant d'avoir beaucoup de documents) ; pas de compteur dans le menu ; contenu mis en forme par `FormattedText` (paragraphes, gras, puces), jamais en HTML brut.

---

## 7. Éditeur de post · ch. 13 (vidéo : ch. 21)

**Rôle :** créer ou retoucher un post à la main, avec un aperçu fidèle.

**Contenu (deux colonnes) :**
- Gauche, le formulaire :
  - Titre interne (non publié).
  - Légende, avec compteur de caractères par réseau.
  - Hashtags en étiquettes (Entrée pour ajouter, croix pour retirer).
  - Réseaux (choix multiple, seulement les comptes connectés).
  - Média : téléverser une image, ou une vidéo en phase 3. Bouton **Retoucher** qui ouvre l'éditeur d'image.
  - Date, heure et fuseau horaire.
- Droite : **aperçu en direct** du post tel qu'il apparaîtra sur le réseau choisi (Instagram d'abord).
- Actions en bas : Enregistrer en brouillon · **Programmer** (bouton principal). Pour un client : « Envoyer en validation ».

**Éditeur d'image (fenêtre, ImageKit) :** recadrage (1:1, 4:5, 9:16, 16:9), détourage, agrandissement, retouche, changement de fond par consigne écrite, noir et blanc, texte par-dessus (taille, position). Aperçu immédiat, Annuler / Enregistrer.

> **Réalisé au chapitre 13** (`/dashboard/[projectId]/posts/new` et `/posts/[postId]`), avec ces écarts assumés : « seulement les comptes connectés » et « Envoyer en validation » (client) arrivent aux chapitres 14 et 19 : pour l'instant tous les réseaux sont proposés, sauf TikTok et YouTube (vidéo, phase 3) ; la date se saisit en **heure de Paris** (le fuseau est affiché, pas encore modifiable) ; l'aperçu a deux dispositions (Instagram : image puis légende ; les autres : texte puis image) avec la coupure propre à chaque réseau et un sélecteur quand plusieurs réseaux sont choisis ; l'éditeur d'image est une fenêtre à droite (recadrage 1:1, 4:5, 9:16, 16:9 ; une retouche IA parmi détourer, agrandir, améliorer, changer le fond par une consigne ; noir et blanc ; texte avec taille, position, couleur) : elle part toujours de l'image d'origine et garde le résultat dans notre stockage ; sans ImageKit configuré, « Retoucher » est grisé avec la raison écrite ; pendant la retouche, l'image est estompée et « Retouche… » s'affiche (pas de flou : le verre dépoli est interdit par la charte).

**États :** champ obligatoire manquant · image trop lourde · date passée refusée · aucun compte connecté pour le réseau choisi (lien vers Comptes) · enregistrement en cours · retouche en cours (aperçu flouté + « Retouche… »).

---

## 8. Calendrier · ch. 15

**Rôle :** voir le planning et le modifier en déplaçant les posts.

**Contenu :**
- Barre d'outils : Mois / Semaine, précédent / aujourd'hui / suivant, sélecteur de **fuseau horaire**.
- **Mois** : cases de 6 px d'arrondi, chaque post en petite étiquette (pastille du réseau + heure en mono). Publié = succès, programmé = contour plein, non validé = hachuré.
- **Semaine** : colonnes par jour, lignes par heure, posts placés à leur heure.
- Un **« + »** au survol d'un jour ouvre l'éditeur avec la date préremplie.
- Clic sur un post : **panneau de détail à droite** (visuel, légende, réseaux, heure, état) avec Modifier · Reprogrammer · Déprogrammer.

**Glisser-déposer :** le post se soulève (ombre), la case d'arrivée s'éclaire. Au lâcher, la nouvelle date est enregistrée **et envoyée au service de publication**, puis une notification « Post déplacé à jeu. 08:00 · Annuler » s'affiche. Interdit de déposer dans le passé ou de déplacer un post déjà publié.

**États :** mois vide · échec de la mise à jour chez le service de publication (le post revient à sa place + message).

---

## 9. Analytique · ch. 16

**Rôle :** montrer ce que les publications ont donné, pour toi et pour le rapport client.

**Contenu :**
- Période : 7 jours · 30 jours · personnalisée. Bouton **Synchroniser** (avec l'heure de la dernière synchronisation).
- Indicateurs : posts publiés, taux de publication réussie, vues, engagement. Pas d'indicateur estimé comme « temps gagné » sans formule claire.
- Graphique des vues et de l'engagement dans le temps, répartition par réseau, **meilleurs posts** (vignette + chiffres).

**États :** avant la première publication → explication honnête, aucun graphique vide. Service de publication sans statistiques fiables (Buffer) → message clair sur ce qui est disponible. Synchronisation en cours / en échec.

---

## 10. Comptes · ch. 14

**Rôle :** voir quels réseaux sont connectés et s'ils fonctionnent.

**Contenu :** une ligne par compte, avec le logo du réseau, le nom du compte, l'état (Connecté · À reconnecter · Déconnecté), la date de la dernière vérification et le bouton **Rafraîchir**. En haut, un lien « Connecter un compte sur [service] », car la connexion se fait chez le service de publication.

**États :** aucun service configuré → « Ajoute d'abord ta clé dans Réglages » + lien · aucun compte · compte à reconnecter (mis en avant en haut).

---

## 11. Réglages · ch. 9, 14

**Rôle :** configurer le projet, les agents et les intégrations.

**Sections (liste à gauche, contenu à droite) :**
- **Projet** : nom, logo, bureau, fuseau horaire par défaut.
- **Intégrations** : clé du service de publication (champ masqué, « enregistrée et chiffrée », boutons **Tester la connexion** et Remplacer), clé ImageKit si nécessaire.
- **Agents** : instructions de rôle de chaque agent, limite de tâches simultanées.
- **Espace client** (ch. 19) : activer la validation client, générer ou révoquer le lien.
- **Profil** : nom, e-mail, thème Jour / Nuit / Système, déconnexion.

**États :** clé invalide (« La connexion a échoué : vérifie la clé ») · enregistrement réussi (notification brève) · modification non enregistrée en quittant (confirmation).

---

## 12. Validation client · ch. 19

**Rôle :** permettre au client de valider ses posts **sans créer de compte**, via un lien privé.

**Contenu :** en-tête aux couleurs du client (logo du projet, nom), puis la phrase « [N] posts attendent ta validation ». Pour chaque post : grand aperçu tel qu'il sera publié, date prévue, boutons **Valider** et **Demander une modification**, qui ouvre un champ de commentaire. Toujours en thème **Jour**, sans menu ni jargon technique.

**États :** lien expiré ou révoqué (« Ce lien n'est plus valide, contacte [nom de l'agence] ») · tout est validé (« Merci, tout est validé ») · erreur d'envoi du commentaire.

**Règle :** un post non validé n'est jamais publié. Si la date arrive sans validation, le post reste en attente et tu es prévenu.

---

## À venir (phase 3)

- **Vidéaste** : onglet vidéo dans l'éditeur de post (script, plans, aperçu du rendu, état « rendu en cours… »), carte de rendu dans la discussion. Fiche à rédiger avant le chapitre 21.
