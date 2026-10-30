// Contrôle des posts (chapitre 13) sur la VRAIE base : lecture par état, compteurs, plafond de 500 posts sous concurrence, codes d'erreur
// des actions, limite d'envois d'images, délai total d'ImageKit. Sans navigateur, sans modèle, sans compte ImageKit.
// Usage : node scripts/check-posts.mjs        (DATABASE_URL dans .env.local)
// Crée un utilisateur jetable avec ses projets, puis supprime tout (cascade). Le vrai code TypeScript est testé.
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import postgres from "postgres";

import { createLoader } from "./lib/load-ts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });

const load = createLoader(root);
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false, onnotice: () => {} });
const Q = load("src/lib/post-queries.ts");
const Limit = load("src/lib/retouch-limit.ts");
const Kit = load("src/lib/imagekit.ts");
const Retouch = load("src/lib/retouch-rules.ts");

let ok = 0;
let ko = 0;
const check = (name, cond, detail) => {
  if (cond) ok++;
  else ko++;
  console.log(cond ? "OK " : "KO ", name, cond || detail === undefined ? "" : `\n     ${detail}`);
};

const uid = `posts-test-${Date.now()}`;
const other = `${uid}-autre`;
const draftInput = (title) => ({ title, caption: "Un texte.", hashtags: [], platforms: ["x"], imageUrl: null, day: "", time: "" });

try {
  await sql`insert into "user" (id, name, email) values (${uid}, 'Test posts', ${`${uid}@example.invalid`}), (${other}, 'Autre', ${`${other}@example.invalid`})`;
  const [{ id: projectId }] = await sql`insert into projects (user_id, name) values (${uid}, 'Projet posts') returning id`;
  const [{ id: foreignId }] = await sql`insert into projects (user_id, name) values (${other}, 'Projet d''un autre') returning id`;
  const row = (status, title, at = null) => sql`insert into posts (project_id, title, caption, status, scheduled_at, created_by) values (${projectId}, ${title}, 'texte', ${status}, ${at}, 'user')`;

  // --- compteurs et lecture par état
  await row("draft", "Brouillon ancien");
  await new Promise((r) => setTimeout(r, 20));
  await row("draft", "Brouillon récent");
  await row("to_review", "À valider");
  await row("scheduled", "Programmé tard", new Date(Date.now() + 5 * 86400_000));
  await row("scheduled", "Programmé tôt", new Date(Date.now() + 1 * 86400_000));
  await row("published", "Publié", new Date(Date.now() - 86400_000));
  const counts = await Q.readPostCounts(uid, projectId);
  check("compteurs : un nombre par état", JSON.stringify(counts) === JSON.stringify({ draft: 2, to_review: 1, scheduled: 2, published: 1, failed: 0 }), JSON.stringify(counts));
  const drafts = await Q.readProjectPosts(uid, projectId, "draft");
  check("lecture d'un onglet : seulement cet état, du plus récent au plus ancien", drafts.length === 2 && drafts.every((p) => p.status === "draft") && drafts[0].title === "Brouillon récent", JSON.stringify(drafts.map((p) => p.title)));
  const scheduled = await Q.readProjectPosts(uid, projectId, "scheduled");
  check("programmés : dans l'ordre où ils partiront", JSON.stringify(scheduled.map((p) => p.title)) === JSON.stringify(["Programmé tôt", "Programmé tard"]), JSON.stringify(scheduled.map((p) => p.title)));
  const strangerCounts = await Q.readPostCounts(other, projectId);
  const strangerPosts = await Q.readProjectPosts(other, projectId, "draft");
  check("le projet d'un autre : compteurs à zéro et aucun post", Object.values(strangerCounts).every((n) => n === 0) && strangerPosts.length === 0);
  check("un projet inexistant : compteurs à zéro", Object.values(await Q.readPostCounts(uid, foreignId)).every((n) => n === 0));

  // --- codes d'erreur des actions
  const [draftRow] = await sql`select id from posts where project_id = ${projectId} and status = 'draft' limit 1`;
  const [pubRow] = await sql`select id from posts where project_id = ${projectId} and status = 'published' limit 1`;
  const missing = "00000000-0000-4000-8000-000000000000";
  let r = await Q.validatePostAs(uid, projectId, draftRow.id);
  check("valider un brouillon : refusé, code « etat »", !r.ok && r.code === "etat", JSON.stringify(r));
  r = await Q.validatePostAs(uid, projectId, missing);
  check("valider un post inexistant : refusé, code « introuvable »", !r.ok && r.code === "introuvable", JSON.stringify(r));
  r = await Q.unschedulePostAs(uid, projectId, draftRow.id);
  check("déprogrammer un brouillon : refusé, code « etat »", !r.ok && r.code === "etat", JSON.stringify(r));
  r = await Q.deletePostAs(uid, projectId, pubRow.id);
  check("supprimer un post publié : refusé, code « etat »", !r.ok && r.code === "etat", JSON.stringify(r));
  r = await Q.duplicatePostAs(uid, projectId, missing);
  check("dupliquer un post inexistant : refusé, code « introuvable »", !r.ok && r.code === "introuvable", JSON.stringify(r));

  // --- plafond de 500 posts, sous concurrence (verrou partagé par la création et la copie)
  const have = Number((await sql`select count(*) as n from posts where project_id = ${projectId}`)[0].n);
  await sql`insert into posts (project_id, title, caption, status, created_by) select ${projectId}, 'Rempli ' || g, 'x', 'draft', 'user' from generate_series(1, ${Q.MAX_POSTS_PER_PROJECT - 2 - have}) g`;
  const racers = await Promise.all(Array.from({ length: 5 }, (_, i) => Q.savePostAs(uid, projectId, null, draftInput(`Course ${i}`), "draft")));
  const made = racers.filter((x) => x.ok).length;
  const total = Number((await sql`select count(*) as n from posts where project_id = ${projectId}`)[0].n);
  check("5 créations simultanées pour 2 places : exactement 2 passent", made === 2 && total === Q.MAX_POSTS_PER_PROJECT, `créés ${made}, total ${total}`);
  check("les refusées parlent de la limite", racers.filter((x) => !x.ok).every((x) => /limite/.test(x.error ?? "")));
  r = await Q.duplicatePostAs(uid, projectId, draftRow.id);
  check("dupliquer au plafond : refusé, code « limite »", !r.ok && r.code === "limite", JSON.stringify(r));
  const totalAfter = Number((await sql`select count(*) as n from posts where project_id = ${projectId}`)[0].n);
  check("rien n'a dépassé le plafond", totalAfter === Q.MAX_POSTS_PER_PROJECT, String(totalAfter));

  // --- limite d'envois d'images (30 par 10 minutes et par personne), indépendante de celle des retouches
  Limit.resetRetouchLimit();
  const t0 = 1_000_000;
  const allowed = Array.from({ length: 31 }, () => Limit.allowUpload("u1", t0)).filter(Boolean).length;
  check("30 envois acceptés, le 31e refusé", allowed === 30, String(allowed));
  check("une autre personne n'est pas touchée", Limit.allowUpload("u2", t0));
  check("après la fenêtre de 10 minutes, c'est de nouveau permis", Limit.allowUpload("u1", t0 + 10 * 60_000 + 1));
  check("les retouches ont leur propre compteur", Limit.allowRetouch("u1", t0));

  // --- ImageKit : délai total
  const config = { endpoint: "https://ik.example.invalid/x", privateKey: "faux" };
  let clock = 0;
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push(`${init?.method ?? "GET"} ${String(url).includes("upload") ? "upload" : String(url).includes("/v1/files/") ? "delete" : "transform"}`);
    if (String(url).includes("upload")) return new Response(JSON.stringify({ fileId: "f1", filePath: "/socialix-tmp/a.png" }), { status: 200, headers: { "content-type": "application/json" } });
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return new Response("<html>en préparation</html>", { status: 200, headers: { "content-type": "text/html", "is-intermediate-response": "true" } });
  };
  const slow = await Kit.retouchImage("https://stockage.example.invalid/a.png", Retouch.EMPTY_SPEC, { config, fetch: fakeFetch, sleep: async (ms) => { clock += ms; }, now: () => { clock += 100_000; return clock; } });
  const transforms = calls.filter((c) => c.endsWith("transform")).length;
  check("ImageKit qui répond toujours « en préparation » : on abandonne au délai total (« trop_long »)", !slow.ok && slow.reason === "trop_long", JSON.stringify(slow));
  check("…après moins de 8 essais (le délai total, pas le compte d'essais, a arrêté)", transforms >= 1 && transforms < 8, `essais : ${transforms}`);
  check("…et le fichier de passage est quand même supprimé d'ImageKit", calls.includes("DELETE delete"), JSON.stringify(calls));
  calls.length = 0;
  const fast = await Kit.retouchImage("https://stockage.example.invalid/a.png", Retouch.EMPTY_SPEC, { config, fetch: fakeFetch, sleep: async () => {}, now: () => 0 });
  check("horloge arrêtée : les 8 essais habituels sont conservés", !fast.ok && fast.reason === "trop_long" && calls.filter((c) => c.endsWith("transform")).length === 8, JSON.stringify(calls));
} catch (error) {
  ko++;
  console.log("KO  erreur inattendue :", error instanceof Error ? `${error.name} ${error.message}` : error);
} finally {
  await sql`delete from "user" where id in (${uid}, ${other})`; // cascade : projets et posts
  const [left] = await sql`select count(*)::int as n from projects where user_id in (${uid}, ${other})`;
  console.log(`\nnettoyage : ${left.n === 0 ? "aucune donnée de test ne reste" : "ATTENTION, des données de test restent"}`);
  console.log(`${ok} réussis, ${ko} échoués`);
  await sql.end();
  process.exit(ko ? 1 : 0);
}
