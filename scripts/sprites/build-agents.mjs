// Génère les personnages pixel des agents (32×32) en SVG.
// Usage : node scripts/sprites/build-agents.mjs
// Sortie : public/agents/<id>-idle.svg, <id>-working.svg, <id>-portrait.svg
//
// Principe : chaque image est une grille de 32×32 cases. On dessine des
// calques (fauteuil, personnage, ordinateur, bureau, accessoires), on les
// superpose, puis on convertit la grille en rectangles SVG.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 32;
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "public", "agents");

// Couleurs communes (bois et encre repris de docs/DESIGN.md)
const C = {
  ink: "#1D1A16",
  chair: "#4A4038",
  deskTop: "#C79A62",
  deskLight: "#D8AE78",
  deskFront: "#9C7443",
  deskEdge: "#7E5B33",
  lid: "#B9B4AC",
  lidEdge: "#8F8A82",
  paper: "#FAF7F1",
  cream: "#E9D9BE",
  grey: "#B9AF9F",
  lens: "#DDE8F0",
  slate: "#5B6080",
  green: "#4F7A5A",
  sky: "#8FB3D9",
  accent: "#E6E05A",
  red: "#C8432F",
};

// --- Outils de dessin sur la grille -------------------------------------

const grid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

function rect(g, x, y, w, h, color) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < SIZE && j >= 0 && j < SIZE) g[j][i] = color;
    }
  }
}

const px = (g, x, y, color) => rect(g, x, y, 1, 1, color);

function erase(g, ...points) {
  for (const [x, y] of points) g[y][x] = null;
}

// Contour d'un calque : toute case vide qui touche une case pleine.
function outline(layer, color) {
  const o = grid();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (layer[y][x]) continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => layer[y + dy]?.[x + dx]);
      if (touches) o[y][x] = color;
    }
  }
  return o;
}

// Superpose les calques : le dernier passe devant.
function compose(...layers) {
  const g = grid();
  for (const layer of layers) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (layer[y][x]) g[y][x] = layer[y][x];
      }
    }
  }
  return g;
}

// Grille → rectangles SVG (cases voisines de même couleur fusionnées par ligne).
function toRects(g) {
  let out = "";
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      const color = g[y][x];
      if (!color) { x++; continue; }
      let w = 1;
      while (x + w < SIZE && g[y][x + w] === color) w++;
      out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${color}"/>`;
      x += w;
    }
  }
  return out;
}

// --- Éléments communs ----------------------------------------------------

function chair() {
  const g = grid();
  rect(g, 8, 8, 16, 13, C.chair);
  erase(g, [8, 8], [23, 8]);
  return g;
}

function body(a) {
  const g = grid();
  rect(g, 10, 15, 12, 7, a.shirt);           // buste
  erase(g, [10, 15], [21, 15]);              // épaules arrondies
  rect(g, 9, 16, 1, 5, a.shirt);             // bras gauche
  rect(g, 22, 16, 1, 5, a.shirt);            // bras droit
  rect(g, 15, 14, 2, 1, a.skin);             // cou
  rect(g, 12, 6, 8, 8, a.skin);              // tête
  erase(g, [12, 6], [19, 6], [12, 13], [19, 13]);
  a.hair(g, a);                              // coiffure
  px(g, 14, 10, C.ink);                      // yeux
  px(g, 17, 10, C.ink);
  rect(g, 15, 12, 2, 1, a.skinShade);        // bouche
  a.face?.(g, a);                            // lunettes, casque…
  return g;
}

function laptop() {
  const g = grid();
  rect(g, 12, 17, 8, 5, C.lid);              // capot vu de dos
  rect(g, 12, 17, 8, 1, C.lidEdge);
  rect(g, 11, 21, 10, 1, C.lidEdge);         // base du clavier
  rect(g, 15, 19, 2, 1, C.paper);            // logo
  return g;
}

// Mains sur le clavier : la frame 1 lève la main gauche, la frame 0 la droite.
function hands(a, frame) {
  const g = grid();
  rect(g, 10, frame === 1 ? 20 : 21, 2, 1, a.skin);
  rect(g, 20, frame === 1 ? 21 : 20, 2, 1, a.skin);
  return g;
}

function restingHands(a) {
  const g = grid();
  rect(g, 10, 21, 2, 1, a.skin);
  rect(g, 20, 21, 2, 1, a.skin);
  return g;
}

function desk() {
  const g = grid();
  rect(g, 2, 22, 28, 2, C.deskTop);
  rect(g, 2, 22, 28, 1, C.deskLight);
  rect(g, 2, 24, 28, 4, C.deskFront);
  rect(g, 2, 24, 28, 1, C.deskEdge);
  rect(g, 3, 28, 2, 4, C.deskEdge);
  rect(g, 27, 28, 2, 4, C.deskEdge);
  return g;
}

// --- Coiffures et accessoires du visage ----------------------------------

const hair = {
  short(g, a) {
    rect(g, 11, 4, 10, 3, a.hairColor);
    erase(g, [11, 4], [20, 4]);
    rect(g, 11, 7, 1, 3, a.hairColor);
    rect(g, 20, 7, 1, 3, a.hairColor);
  },
  long(g, a) {
    hair.short(g, a);
    rect(g, 11, 7, 1, 7, a.hairColor);
    rect(g, 20, 7, 1, 7, a.hairColor);
  },
  bun(g, a) {
    hair.short(g, a);
    rect(g, 15, 2, 2, 2, a.hairColor);
  },
  sides(g, a) {
    rect(g, 11, 7, 1, 4, a.hairColor);
    rect(g, 20, 7, 1, 4, a.hairColor);
  },
};

const face = {
  headset(g) {
    const headset = "#5B6080";               // ardoise : visible sur des cheveux foncés
    rect(g, 12, 4, 8, 1, headset);           // arceau
    rect(g, 10, 8, 2, 3, headset);           // écouteurs
    rect(g, 20, 8, 2, 3, headset);
    px(g, 20, 11, headset);                  // tige du micro
    px(g, 19, 12, headset);
  },
  glasses(g) {
    // Monture fine (ardoise, pas noire) autour de deux verres clairs.
    for (const x of [13, 17]) {
      rect(g, x, 9, 2, 1, C.slate);
      rect(g, x, 11, 2, 1, C.slate);
      rect(g, x, 10, 2, 1, C.lens);
    }
    px(g, 15, 10, C.slate);                  // pont d'un seul pixel
    px(g, 16, 10, C.slate);
    px(g, 14, 10, C.ink);                    // yeux derrière les verres
    px(g, 17, 10, C.ink);
  },
  beret(g) {
    const beret = "#7A4E7A";
    rect(g, 12, 3, 7, 1, beret);
    rect(g, 11, 4, 10, 2, beret);
    rect(g, 10, 6, 10, 1, beret);
    px(g, 16, 2, beret);
  },
  cap(g) {
    const cap = "#4F7A5A";
    rect(g, 11, 4, 10, 3, cap);
    erase(g, [11, 4], [20, 4]);
    rect(g, 20, 5, 3, 1, cap);               // visière tournée en arrière
  },
};

// --- Accessoires posés sur le bureau (frame 0 / 1) -----------------------

const props = {
  clipboard(g) {
    rect(g, 24, 17, 5, 5, C.cream);
    rect(g, 25, 16, 3, 1, C.slate);
    rect(g, 25, 19, 3, 1, C.grey);
    rect(g, 25, 20, 2, 1, C.grey);
  },
  magnifier(g) {
    for (const [x, y] of [[5, 17], [6, 17], [4, 18], [7, 18], [4, 19], [7, 19], [5, 20], [6, 20]]) px(g, x, y, C.slate);
    rect(g, 5, 18, 2, 2, C.lens);
    px(g, 8, 21, C.slate);
  },
  frame(g) {
    rect(g, 23, 16, 6, 6, C.deskEdge);
    rect(g, 24, 17, 4, 4, C.sky);
    rect(g, 24, 20, 4, 1, C.green);
    px(g, 27, 17, C.accent);
  },
  calendar(g, frame) {
    rect(g, 3, 16, 6, 6, C.paper);
    rect(g, 3, 16, 6, 1, C.ink);
    for (const x of [4, 6, 8]) { px(g, x, 18, C.grey); px(g, x, 20, C.grey); }
    px(g, 4, 18, C.green);
    if (frame === 1) px(g, 6, 18, C.green);
  },
  chart(g, frame) {
    rect(g, 23, 21, 7, 1, C.deskEdge);
    const heights = frame === 1 ? [3, 2, 5] : [2, 4, 3];
    [24, 26, 28].forEach((x, i) => rect(g, x, 21 - heights[i], 1, heights[i], i === 1 ? C.green : C.slate));
  },
  camera(g, frame) {
    rect(g, 23, 18, 5, 4, C.ink);
    rect(g, 28, 19, 2, 2, C.slate);
    px(g, 24, 17, C.ink);
    px(g, 24, 19, frame === 1 ? C.red : C.grey);
  },
};

// --- Les agents ----------------------------------------------------------

const agents = [
  { id: "maitre", name: "Maître", skin: "#A86B47", skinShade: "#8C5536", hairColor: "#1D1A16", hair: hair.short, face: face.headset, shirt: "#2B2F5A", prop: props.clipboard },
  { id: "recherche", name: "Recherche", skin: "#F1C7A1", skinShade: "#D9A47A", hairColor: "#6B3E26", hair: hair.long, face: face.glasses, shirt: "#4F7A5A", prop: props.magnifier },
  { id: "createur", name: "Créateur", skin: "#D9A47A", skinShade: "#B98458", hairColor: "#2B1E16", hair: hair.sides, face: face.beret, shirt: "#5B6080", prop: props.frame },
  { id: "planificateur", name: "Planificateur", skin: "#6E4630", skinShade: "#573522", hairColor: "#2B1E16", hair: hair.bun, shirt: "#3C4378", prop: props.calendar },
  { id: "analytique", name: "Analytique", skin: "#F1C7A1", skinShade: "#D9A47A", hairColor: "#D9B26A", hair: hair.short, shirt: "#7A4E7A", prop: props.chart },
  { id: "videaste", name: "Vidéaste", skin: "#A86B47", skinShade: "#8C5536", hairColor: "#1D1A16", hair: hair.sides, face: face.cap, shirt: "#4A5E73", prop: props.camera },
];

function frameGrid(a, frame, working) {
  const character = body(a);
  const propLayer = grid();
  a.prop(propLayer, frame);
  return compose(
    chair(),
    outline(character, C.ink),
    character,
    laptop(),
    working ? hands(a, frame) : restingHands(a),
    desk(),
    propLayer,
  );
}

const svg = (viewBox, title, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges" role="img"><title>${title}</title>${inner}</svg>\n`;

// Animation : deux images qui alternent toutes les 0,3 s.
// Elle s'arrête si l'utilisateur a demandé de réduire les animations.
const ANIMATION = `<style>
.f1{animation:f1 .6s steps(1) infinite}.f2{animation:f2 .6s steps(1) infinite}
@keyframes f1{0%{visibility:visible}50%{visibility:hidden}}
@keyframes f2{0%{visibility:hidden}50%{visibility:visible}}
@media (prefers-reduced-motion:reduce){.f1,.f2{animation:none}.f2{visibility:hidden}}
</style>`;

mkdirSync(outDir, { recursive: true });

for (const a of agents) {
  const idle = toRects(frameGrid(a, 0, false));
  writeFileSync(join(outDir, `${a.id}-idle.svg`), svg("0 0 32 32", `${a.name}, au repos`, idle));
  writeFileSync(join(outDir, `${a.id}-portrait.svg`), svg("8 1 16 16", a.name, idle));
  const working =
    ANIMATION +
    `<g class="f1">${toRects(frameGrid(a, 0, true))}</g>` +
    `<g class="f2">${toRects(frameGrid(a, 1, true))}</g>`;
  writeFileSync(join(outDir, `${a.id}-working.svg`), svg("0 0 32 32", `${a.name}, au travail`, working));
}

console.log(`${agents.length} agents générés dans ${outDir}`);
