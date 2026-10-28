# Fiches des pages — Socialix

> Une fiche par écran : à quoi il sert, ce qu'il contient, ses états, ses interactions. Style : voir `DESIGN.md`.
> Chaque fiche indique le chapitre du `PLAN.md` où l'écran est codé. Statut : **à valider** (26/10/2026).

**Règle pour tous les écrans :** prévoir quatre états. **Vide** (aucune donnée, avec une action pour démarrer), **chargement** (squelettes gris aux formes du contenu, pas de roue qui tourne au milieu de la page), **erreur** (ce qui s'est passé + comment réessayer), **rempli**.

**Plan du site :**

```text
/sign-in, /sign-up                     → 1. Connexion
/campaigns/new                         → 2. Création de campagne
/dashboard/[campaignId]/…              → 3. Cadre commun (menu + en-tête) autour de :
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

**Après connexion :** aucune campagne → `/campaigns/new` ; sinon → vue d'ensemble de la dernière campagne ouverte.

---

## 2. Création de campagne · ch. 5

**Rôle :** créer un espace de travail (une campagne = une marque ou un client).

**Contenu :** une carte centrée, **sans défilement**, avec un indicateur d'étapes « 1 Identité · 2 Bureau ».
- **Étape 1 · Identité** : nom de la campagne (obligatoire), logo : choisir parmi quelques icônes proposées **ou** téléverser une image (PNG, JPG ou WebP, 3 Mo max), avec aperçu immédiat. Bouton « Continuer ».
- **Étape 2 · Bureau** : deux grandes vignettes cliquables, **Atelier bois** et **Bureau moderne**, avec un aperçu des agents en place. Boutons « Retour » et **Créer la campagne**.

**États :** nom vide (message sous le champ) · fichier trop lourd ou mauvais format (« 3 Mo maximum, PNG, JPG ou WebP ») · téléversement en cours (barre fine) · création en cours · erreur serveur (« La campagne n'a pas pu être créée, réessaie »).

**Après création :** vue d'ensemble de la nouvelle campagne.

---

## 3. Cadre commun : menu et en-tête · ch. 6

**Rôle :** naviguer et garder le contexte (quelle campagne, que faut-il faire).

**Menu latéral :**
- **Replié par défaut** (icônes seules, info-bulle au survol), dépliable par un bouton. Le choix est mémorisé.
- En haut : logo + **sélecteur de campagne** (liste des campagnes + « Nouvelle campagne »).
- Liens : Vue d'ensemble · Agents IA (« 1 actif ») · Posts (nombre à valider) · Calendrier · Analytique · Comptes · Réglages. Compteurs en mono. Lien actif = pilule encre.
- En bas : carte accent **« Équipe IA »** (pastille qui respire si un agent travaille, lien « N posts à valider »), puis le profil (nom, menu : thème Jour/Nuit, déconnexion).

**En-tête de chaque page :** titre et sous-titre de la page à gauche ; à droite la recherche et le bouton **Créer un post**, qui ouvre un petit choix « Avec l'équipe IA » (→ Agents) ou « À la main » (→ Éditeur).

**Téléphone :** le menu devient un tiroir ouvert par un bouton ; l'en-tête garde le titre et le bouton Créer.

**Réalisé au chapitre 6, avec ces écarts assumés (pas de faux contenu) :**
- Pas de compteurs (« 1 actif », « N à valider ») ni de lien « N posts à valider » : il n'y a encore ni agent ni post. La carte « Équipe IA » dit « Tes agents sont au repos », pastille grise.
- Pas de champ de recherche : rien à chercher avant le chapitre 13.
- « Créer un post » : « Avec l'équipe IA » mène à la page Agents ; « À la main » est grisé, « Bientôt » (l'éditeur arrive au chapitre 13).
- Le profil contient le choix du thème Jour / Nuit / Système et la déconnexion.
- Changer de campagne dans le sélecteur garde la même section et mémorise la campagne.

---

## 4. Vue d'ensemble · ch. 7 (panneau de chat : ch. 8)

**Rôle :** voir en 5 secondes où en est la campagne et ce qui attend une décision.

**Contenu (maquette « Jour ») :**
- Trois cartes de tailles et de styles **différents** : « Programmés cette semaine » (gros chiffre + bande des 7 jours, jours non validés hachurés) · **« À valider »** en accent (chiffre + « Relire maintenant ») · « Publiés · 30 derniers jours ».
- Colonne gauche : liste **À valider** (vignette, titre, `jour · heure · réseau`, bouton Relire), puis **Activité récente** (heure en mono + phrase : « Le Maître a créé un plan de 3 tâches »).
- Colonne droite : **le bureau isométrique** du thème choisi (bois ou moderne), agents placés d'après le JSON de l'Office Builder, étiquette pixel au-dessus de chacun, pastille d'état.

**Interactions :** cliquer sur un agent dans le bureau ouvre un **panneau de chat à gauche** (même composant que la page Agents), sans quitter la page. Survol d'un agent : son étiquette indique ce qu'il fait (« Rédige le post 2 »).

**États :** nouvelle campagne → état vide : « Rien de prévu pour l'instant » avec deux boutons, « Demander à l'équipe IA » et « Créer un post ». Statistiques avant toute publication : tiret + phrase explicative, jamais de zéro trompeur.

---

## 5. Agents IA · ch. 8 à 12 (Ordinateur : ch. 17)

**Rôle :** donner des consignes à l'équipe et suivre son travail.

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

**États :** aucun post → « Aucun post. Demande à l'équipe IA ou crée-en un. » · onglet vide (« Aucun post programmé ») · post en échec : raison affichée (« Compte Instagram déconnecté ») + Réessayer.

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

**Rôle :** configurer la campagne, les agents et les intégrations.

**Sections (liste à gauche, contenu à droite) :**
- **Campagne** : nom, logo, bureau, fuseau horaire par défaut.
- **Intégrations** : clé du service de publication (champ masqué, « enregistrée et chiffrée », boutons **Tester la connexion** et Remplacer), clé ImageKit si nécessaire.
- **Agents** : instructions de rôle de chaque agent, limite de tâches simultanées.
- **Espace client** (ch. 19) : activer la validation client, générer ou révoquer le lien.
- **Profil** : nom, e-mail, thème Jour / Nuit / Système, déconnexion.

**États :** clé invalide (« La connexion a échoué : vérifie la clé ») · enregistrement réussi (notification brève) · modification non enregistrée en quittant (confirmation).

---

## 12. Validation client · ch. 19

**Rôle :** permettre au client de valider ses posts **sans créer de compte**, via un lien privé.

**Contenu :** en-tête aux couleurs du client (logo de la campagne, nom), puis la phrase « [N] posts attendent ta validation ». Pour chaque post : grand aperçu tel qu'il sera publié, date prévue, boutons **Valider** et **Demander une modification**, qui ouvre un champ de commentaire. Toujours en thème **Jour**, sans menu ni jargon technique.

**États :** lien expiré ou révoqué (« Ce lien n'est plus valide, contacte [nom de l'agence] ») · tout est validé (« Merci, tout est validé ») · erreur d'envoi du commentaire.

**Règle :** un post non validé n'est jamais publié. Si la date arrive sans validation, le post reste en attente et tu es prévenu.

---

## À venir (phase 3)

- **Vidéaste** : onglet vidéo dans l'éditeur de post (script, plans, aperçu du rendu, état « rendu en cours… »), carte de rendu dans la discussion. Fiche à rédiger avant le chapitre 21.
