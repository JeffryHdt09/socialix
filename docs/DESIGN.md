# Direction visuelle — « L'atelier des agents »

> Validée le 26/10/2026. Maquettes : https://claude.ai/artifact/4Tuo7TaVssvv1fPJNmwevs (planche, écran Jour, écran Nuit).
> Ce fichier sert de référence au chapitre 4 (thème shadcn) et à chaque écran ensuite.

## Concept

- **Jour** (thème clair) : un atelier en bois clair où l'on prépare et valide. Structure inspirée d'un tableau de bord clair à cartes, matières d'un atelier en contreplaqué.
- **Nuit** (thème sombre) : une salle de contrôle aux couleurs d'un bureau pixel de nuit, où l'on surveille les agents.
- **Un seul système**, deux thèmes. L'utilisateur bascule avec un bouton Jour/Nuit. Par défaut : le réglage de son système.

## Couleurs

| Rôle | Jour | Nuit | Usage |
|---|---|---|---|
| Fond | `#ECE6DA` | `#161929` | Fond de page |
| Surface | `#FAF7F1` | `#1F2338` | Cartes, panneaux, menu |
| Surface 2 | `#ECE6DA` | `#262B44` | Champs, éléments imbriqués |
| Encre | `#1D1A16` | `#ECE8DF` | Texte principal, **bouton principal** |
| Texte secondaire | `#6B6358` | `#A3A6BF` | Libellés, métadonnées |
| Filet | `#DCD3C3` | `#33395A` | Bordures fines |
| **Accent (le seul)** | `#E6E05A` | `#E6E05A` | **Signaler** : à valider, en cours. Jamais un bouton. Texte foncé dessus |
| Succès | `#2F7A4A` | `#5CC08A` | Publié, terminé |
| Erreur | `#B5402C` | `#F0705C` | Échec, bloqué |
| Inactif | `#B9AF9F` | `#5B6080` | Agent au repos |

**Couleurs des réseaux sociaux** : uniquement en petites pastilles (calendrier, liste des posts), jamais en grands aplats.

## Typographie

| Police | Rôle | Remarque |
|---|---|---|
| **Schibsted Grotesk** (400–800) | Titres, interface, gros chiffres | Police principale |
| **JetBrains Mono** (400–500) | Heures, dates, journaux, compteurs, états techniques | Les chiffres s'alignent en colonne |
| **Pixelify Sans** (500–600) | **Uniquement** les étiquettes des agents dans le bureau isométrique | La touche « jeu » reste confinée |

Échelle indicative : 76 / 34 / 28 / 20 / 16 / 15 / 13 / 12 px. Gros chiffres de 64 à 88 px, graisse 600.

## Formes

- **Arrondis variés** (jamais le même partout) : 6 px (cases du calendrier, petites vignettes), 10 px (champs, boutons), 12 px (éléments de liste), 16 px (panneaux et cartes), pilule (états, étiquettes).
- **Bordures fines** de 1 px plutôt que des ombres.
- **Ombre** uniquement sur ce qui flotte : menus déroulants, fenêtres, post qu'on déplace dans le calendrier.
- **Hachures** (lignes diagonales fines) = **« pas encore confirmé »** : brouillon, post non validé, tâche en attente. Même signification partout.

## États (vocabulaire commun)

- **Post** : Brouillon (hachuré) → À valider (accent) → Programmé (contour + heure en mono) → Publié (succès) · Échec (erreur).
- **Agent** : Au repos (inactif) · En cours (pastille accent qui respire) · Terminé (succès) · Bloqué, attend une réponse (erreur).
- **Tâche** : En attente (hachuré, « après 02 ») · En cours · Terminée · Échouée.

## Mouvement

1. **Le mouvement informe** : quelque chose a changé, travaille ou a fini. Sinon, pas d'animation.
2. **Court** : 150 à 300 ms pour panneaux, onglets, boutons. Courbe douce en sortie.
3. **Vivant seulement dans le bureau** : les personnages peuvent bouger en continu, le reste non.
4. Animations prévues : panneau de chat qui glisse, pastille « en cours » qui respire, texte de l'agent qui s'écrit, nouvelle ligne du journal qui apparaît, post soulevé pendant le glisser-déposer, notification d'annulation (« Post déplacé · Annuler »).
5. **`prefers-reduced-motion`** respecté : toutes les animations non essentielles s'arrêtent.

## Personnages et décor du bureau (créés le 27/10/2026)

- **Personnages** : pixel art original de 32×32, un par agent (Maître, Recherche, Créateur, Planificateur, Analytique, Vidéaste), chacun avec un accessoire qui dit son rôle. Générés par `scripts/sprites/build-agents.mjs` → `public/agents/<agent>-idle.svg` (au repos), `-working.svg` (animé, respecte `prefers-reduced-motion`), `-portrait.svg` (chat, liste des agents). Pour modifier un personnage : changer sa ligne dans le script, puis `node scripts/sprites/build-agents.mjs`.
- **Décor** : atelier bois en pixel art isométrique, version jour et nuit identiques, générées avec Flow (Nano Banana 2, 0 crédit), puis recalées sur une grille de pixels → `public/office/atelier-jour.webp`, `atelier-nuit.webp`. Le centre de la pièce est vide pour accueillir les postes.
- **Placement** : `public/office/atelier.json` donne la position de chaque poste en % de l'image (`x`, `y` = point bas-centre du poste, `width` = largeur). Les positions restent justes quel que soit l'écran. C'est notre équivalent du fichier de l'Office Builder de la vidéo.
- **Aperçus** : `docs/personnages/apercu.html` (personnages) et `docs/personnages/bureau.html` (personnages dans le décor).
- **À faire au chapitre 7** : un léger assombrissement des personnages en thème Nuit, pour qu'ils baignent dans la même lumière que la pièce.

## Accessibilité

- Contraste du texte ≥ 4,5:1 (vérifié pour les couleurs ci-dessus sur leurs surfaces).
- Focus clavier toujours visible (contour encre en Jour, encre claire en Nuit).
- Zones cliquables ≥ 44 px.
- Les états ne reposent jamais sur la couleur seule : texte ou hachures en plus.
- Vrais éléments HTML (`button`, `a`, `label`), pas de `div` cliquable.

## Interdits (en plus de la liste du skill design)

- Dégradés, néons, halos, verre dépoli.
- Emojis dans l'interface. Les étiquettes du bureau utilisent la police pixel.
- Personnages de marques existantes : nos agents ont leurs propres personnages.
- Chiffres ou contenus inventés : un état vide honnête (« Les chiffres apparaîtront après la première publication ») plutôt qu'un faux tableau rempli.
