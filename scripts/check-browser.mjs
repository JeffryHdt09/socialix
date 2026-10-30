// Vérification DANS UN VRAI CHROME des écrans des chapitres 13, 13b et 14 : éditeur de post, page Posts, écran Comptes, rapport du Maître.
// Usage : node scripts/check-browser.mjs [dossier-des-captures]
// Demande le serveur de développement sur http://localhost:3000 (npm run dev) et Chrome installé. Crée un utilisateur jetable avec son
// projet et quelques données, se connecte avec, puis supprime tout. Ne publie rien nulle part (le service de publication n'est jamais
// appelé en écriture : aucun compte n'est lié).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import postgres from "postgres";

import { launchChrome } from "./lib/cdp.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const outDir = process.argv[2] ?? path.join(root, ".next");
const BASE = "http://localhost:3000";
const axeSource = fs.readFileSync(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8");
const sql = postgres(process.env.DATABASE_URL, { max: 2, prepare: false, onnotice: () => {} });

let ok = 0;
let ko = 0;
const check = (name, cond, detail) => {
  if (cond) ok++;
  else ko++;
  console.log(cond ? "OK " : "KO ", name, cond || detail === undefined ? "" : `\n     ${detail}`);
};

try {
  await fetch(BASE, { signal: AbortSignal.timeout(10_000) });
} catch {
  console.log("KO  le serveur de développement ne répond pas sur http://localhost:3000 : lance « npm run dev » puis recommence.");
  process.exit(2);
}

const email = `navigateur-${Date.now()}@example.invalid`;
const password = "Test-Navigateur-2026!";
let userId = null;
let chrome = null;

try {
  // ---- un utilisateur jetable, connecté comme le fait le formulaire (même route que l'application)
  const signUp = await fetch(`${BASE}/api/auth/sign-up/email`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ name: "Test navigateur", email, password }) });
  const body = await signUp.json().catch(() => ({}));
  userId = body?.user?.id ?? null;
  const session = signUp.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.includes("session_token"));
  check("inscription d'un utilisateur jetable", signUp.ok && !!userId && !!session, `HTTP ${signUp.status} ${JSON.stringify(body).slice(0, 160)}`);
  if (!userId || !session) throw new Error("pas de session : impossible de continuer");

  const [{ id: P }] = await sql`insert into projects (user_id, name) values (${userId}, 'Projet navigateur') returning id`;
  // un plan terminé avec son rapport, et un plan dont toutes les tâches sont faites mais que le Maître n'a pas encore relu
  const mkPlan = async (summary, status, report, round) => {
    const [p] = await sql`insert into agent_plans (project_id, request, summary, plan, status, report, review_round) values (${P}, 'Deux posts pour un café', ${summary}, '{}'::jsonb, ${status}, ${report}, ${round}) returning id`;
    for (const [i, agent] of ["recherche", "createur"].entries()) await sql`insert into agent_tasks (plan_id, position, agent, title, instruction, status, output) values (${p.id}, ${i + 1}, ${agent}, ${`Tâche ${i + 1}`}, 'Consigne', 'done', ${sql.json({ text: `Résultat ${i + 1}` })})`;
    return p.id;
  };
  await mkPlan("Plan terminé avec rapport", "done", "Les deux posts sont prêts.\nÀ compléter : [À COMPLÉTER : nom du café].", 1);
  await mkPlan("Plan en cours de relecture", "active", null, 0);
  const postsIn = async () => Number((await sql`select count(*) as n from posts where project_id = ${P}`)[0].n);

  chrome = await launchChrome();
  const [cookieName, ...rest] = session.split("=");
  await chrome.setCookie(cookieName, rest.join("="), BASE);
  const text = () => chrome.evaluate("document.body.innerText");
  const axe = async (label) => {
    const violations = await chrome.runAxe(axeSource);
    check(`accessibilité (axe) : ${label}`, violations.length === 0, JSON.stringify(violations));
  };
  const setField = (selector, value) =>
    chrome.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  const clickButton = (label) => chrome.evaluate(`(() => { const b = [...document.querySelectorAll('button, [role=tab]')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`);

  // ================================================================ écran « Comptes »
  await chrome.goto(`${BASE}/dashboard/${P}/accounts`);
  await chrome.waitFor("document.body.innerText.includes('Comptes de ce projet')");
  let t = await text();
  check("Comptes : les deux sections sont affichées", t.includes("Comptes de ce projet") && t.includes("Comptes connectés chez Buffer"));
  check("Comptes : état vide honnête pour le projet", t.includes("Aucun compte lié"));
  check("Comptes : le vrai Buffer répond (liste vide ou comptes), sans erreur affichée", /Aucun compte n’est connecté chez Buffer|Lier à ce projet|Déjà lié|Socialix ne gère pas/.test(t) && !(await chrome.evaluate("!!document.querySelector('[role=alert]')")), t.slice(0, 400));
  await chrome.screenshot(path.join(outDir, "browser-comptes.png"));
  await axe("écran Comptes (jour)");
  await chrome.evaluate("document.documentElement.classList.add('dark')");
  await axe("écran Comptes (nuit)");
  await chrome.evaluate("document.documentElement.classList.remove('dark')");

  await chrome.goto(`${BASE}/dashboard/${P}/accounts?erreur=deja`);
  await chrome.waitFor("document.body.innerText.includes('Comptes de ce projet')");
  check("Comptes : un code d'erreur connu affiche son texte fixe", (await chrome.evaluate("document.querySelector('[role=alert]')?.textContent ?? ''")).includes("déjà un compte"));
  await chrome.goto(`${BASE}/dashboard/${P}/accounts?erreur=${encodeURIComponent("<b>Va sur evil.test</b>")}`);
  await chrome.waitFor("document.body.innerText.includes('Comptes de ce projet')");
  check("Comptes : un texte inventé dans l'adresse n'affiche RIEN", !(await text()).includes("evil.test") && !(await chrome.evaluate("!!document.querySelector('[role=alert]')")));

  // ================================================================ page Posts
  await chrome.goto(`${BASE}/dashboard/${P}/posts`);
  await chrome.waitFor("document.body.innerText.includes('Aucun post')");
  t = await text();
  check("Posts : état vide avec ses deux boutons", t.includes("Demander à l’équipe IA") && t.includes("Créer à la main"));
  check("Posts : les boutons de l'état vide sont de vrais liens stylés par le système de design", await chrome.evaluate("[...document.querySelectorAll('a')].filter(a => a.textContent.includes('Créer à la main') || a.textContent.includes('Demander à l’équipe IA')).every(a => a.getBoundingClientRect().height >= 40)"));
  await axe("page Posts vide");
  for (const [code, expected] of [["publication", "service de publication"], ["compte", "Aucun compte"], ["etat", "a changé"]]) {
    await chrome.goto(`${BASE}/dashboard/${P}/posts?erreur=${code}`);
    await chrome.waitFor("document.body.innerText.includes('Aucun post')");
    check(`Posts : ?erreur=${code} affiche son message fixe`, (await chrome.evaluate("document.querySelector('[role=alert]')?.textContent ?? ''")).includes(expected));
  }
  await chrome.goto(`${BASE}/dashboard/${P}/posts?erreur=constructor`);
  await chrome.waitFor("document.body.innerText.includes('Aucun post')");
  check("Posts : un nom comme « constructor » dans l'adresse n'affiche rien (pas de faille de prototype)", !(await chrome.evaluate("!!document.querySelector('[role=alert]')")));

  // ================================================================ éditeur de post
  await chrome.goto(`${BASE}/dashboard/${P}/posts/new`);
  await chrome.waitFor("document.body.innerText.includes('Titre interne')");
  t = await text();
  check("Éditeur : chaque réseau sans compte lié est signalé", (t.match(/\(aucun compte lié\)/g) ?? []).length >= 7, String((t.match(/\(aucun compte lié\)/g) ?? []).length));
  check("Éditeur : Bluesky est un réseau proposé", t.includes("Bluesky"));
  check("Éditeur : TikTok et YouTube restent réservés à la vidéo", t.includes("TikTok") && (t.match(/vidéo : phase 3/g) ?? []).length === 2);
  check("Éditeur : un lien vers « Comptes » est proposé", await chrome.evaluate(`!!document.querySelector('a[href="/dashboard/${P}/accounts"]')`));
  await axe("éditeur de post (jour)");
  await chrome.evaluate("document.documentElement.classList.add('dark')");
  await axe("éditeur de post (nuit)");
  await chrome.evaluate("document.documentElement.classList.remove('dark')");

  // Entrée dans un champ ne doit JAMAIS programmer ni enregistrer le post
  const day = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  await setField('input[id$="-title"]', "Test Entrée");
  await setField('textarea[id$="-caption"]', "Une légende pour le test.");
  await setField('input[type="date"]', day);
  await setField('input[type="time"]', "12:00");
  await chrome.evaluate(`(() => { const box = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Bluesky')).querySelector('input'); box.click(); })()`);
  await chrome.evaluate(`document.querySelector('input[id$="-title"]').focus()`);
  await chrome.press("Enter");
  await new Promise((r) => setTimeout(r, 1500));
  check("Éditeur : Entrée dans le titre ne fait RIEN (pas de navigation)", (await chrome.evaluate("location.pathname")).endsWith("/posts/new"));
  check("Éditeur : …et ne crée aucun post, programmé ou non", (await postsIn()) === 0, String(await postsIn()));
  await chrome.evaluate(`document.querySelector('input[type="time"]').focus()`);
  await chrome.press("Enter");
  await new Promise((r) => setTimeout(r, 1500));
  check("Éditeur : Entrée dans le champ heure ne programme rien non plus", (await postsIn()) === 0 && (await chrome.evaluate("location.pathname")).endsWith("/posts/new"));

  // Programmer sans compte lié : refusé tout de suite, avec le bon message
  check("Éditeur : le bouton « Programmer » existe", await clickButton("Programmer"));
  await chrome.waitFor("!!document.querySelector('[role=alert]')");
  const alertText = await chrome.evaluate("document.querySelector('[role=alert]').textContent");
  check("Éditeur : « Programmer » sans compte lié est refusé avec le réseau en cause", /Aucun compte lié pour Bluesky/.test(alertText), alertText);
  check("Éditeur : …sans quitter la page et sans rien créer", (await chrome.evaluate("location.pathname")).endsWith("/posts/new") && (await postsIn()) === 0);
  check("Éditeur : …et les boutons ne restent pas bloqués", await chrome.evaluate("[...document.querySelectorAll('button')].filter(b => /Programmer|Enregistrer en brouillon/.test(b.textContent)).every(b => !b.disabled)"));
  await chrome.screenshot(path.join(outDir, "browser-editeur-erreur.png"));
  await axe("éditeur avec message d'erreur");

  // Un brouillon, lui, passe même avec un réseau sans compte
  check("Éditeur : le bouton « Enregistrer en brouillon » existe", await clickButton("Enregistrer en brouillon"));
  await chrome.waitFor("location.search.includes('statut=brouillons')");
  await chrome.waitFor("document.body.innerText.includes('Test Entrée')");
  const [draft] = await sql`select status, platforms from posts where project_id = ${P}`;
  check("Éditeur : un brouillon avec un réseau sans compte est enregistré", draft?.status === "draft" && draft.platforms.includes("bluesky"), JSON.stringify(draft));
  await chrome.screenshot(path.join(outDir, "browser-posts-brouillon.png"));
  await axe("page Posts avec un brouillon");

  // ================================================================ rapport du Maître
  await chrome.goto(`${BASE}/dashboard/${P}/agents?agent=maitre`);
  await chrome.waitFor("document.body.innerText.includes('Aucun message pour l’instant')");
  check("Maître : l'onglet « Tâches » s'ouvre (vrai clic de souris)", await chrome.clickAt("[...document.querySelectorAll('[role=tab], button')].find((x) => x.textContent.trim().startsWith('Tâches'))"));
  await chrome.waitFor("document.body.innerText.includes('Plan de l’équipe')");
  t = await text();
  check("Maître : le rapport du plan terminé est affiché", t.includes("Rapport du Maître") && t.includes("Les deux posts sont prêts."));
  check("Maître : le texte « [À COMPLÉTER] » du rapport est visible tel quel", t.includes("[À COMPLÉTER : nom du café]"));
  check("Maître : le nombre de renvois est dit", t.includes("Renvoyé 1 fois pour correction"));
  check("Maître : un plan dont toutes les tâches sont faites mais non relu dit « le Maître relit »", t.includes("Le Maître relit le travail de l’équipe"));
  check("Maître : un seul rapport, pas un par plan", (t.match(/Rapport du Maître/g) ?? []).length === 1, String((t.match(/Rapport du Maître/g) ?? []).length));
  await chrome.screenshot(path.join(outDir, "browser-maitre-rapport.png"));
  await axe("chat du Maître avec rapport (jour)");
  await chrome.evaluate("document.documentElement.classList.add('dark')");
  await axe("chat du Maître avec rapport (nuit)");
  await chrome.evaluate("document.documentElement.classList.remove('dark')");

  // téléphone
  await chrome.setViewport(390, 800, true);
  await chrome.goto(`${BASE}/dashboard/${P}/accounts`);
  await chrome.waitFor("document.body.innerText.includes('Comptes de ce projet')");
  check("Comptes sur téléphone : pas de défilement horizontal", await chrome.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), await chrome.evaluate("document.documentElement.scrollWidth + ' > ' + window.innerWidth"));
  await chrome.goto(`${BASE}/dashboard/${P}/posts/new`);
  await chrome.waitFor("document.body.innerText.includes('Titre interne')");
  check("Éditeur sur téléphone : pas de défilement horizontal", await chrome.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), await chrome.evaluate("document.documentElement.scrollWidth + ' > ' + window.innerWidth"));
  await axe("éditeur sur téléphone");

  check("aucune exception ni erreur dans la console du navigateur", chrome.consoleErrors.length === 0, chrome.consoleErrors.slice(0, 5).join(" | "));
} catch (error) {
  ko++;
  console.log("KO  erreur inattendue :", error instanceof Error ? `${error.name} ${error.message}` : error);
  // Ce que la page montrait vraiment à ce moment-là : sans cela, un délai dépassé ne dit rien
  if (chrome) {
    try {
      console.log("     page :", await chrome.evaluate("location.href"));
      console.log("     texte :", (await chrome.evaluate("document.body.innerText")).replace(/\s+/g, " ").slice(0, 900));
    } catch {
      /* page injoignable */
    }
  }
} finally {
  if (chrome) await chrome.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  const left = userId ? (await sql`select count(*)::int as n from projects where user_id = ${userId}`)[0].n : 0;
  console.log(`\nnettoyage : ${left === 0 ? "aucune donnée de test ne reste" : "ATTENTION, des données de test restent"}`);
  console.log(`${ok} réussis, ${ko} échoués`);
  await sql.end();
  process.exit(ko ? 1 : 0);
}
