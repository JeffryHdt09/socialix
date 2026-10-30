// Contrôle de la publication (chapitre 14) sur la VRAIE base, avec un FAUX service de publication en mémoire (jamais Buffer, jamais de
// réseau, rien n'est publié). Comptes liés aux projets, programmation, reprogrammation, déprogrammation, suppression, et surtout
// ce qui se passe quand quelque chose casse AU MILIEU.
// Usage : node scripts/check-publishing.mjs        (DATABASE_URL dans .env.local, migration 0012 appliquée)
// Crée des utilisateurs jetables, puis supprime tout (cascade).
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import postgres from "postgres";

import { fakePublisher } from "./lib/fake-publisher.mjs";
import { createLoader } from "./lib/load-ts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const load = createLoader(root);
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false, onnotice: () => {} });
const Accounts = load("src/lib/account-service.ts");
const Pub = load("src/lib/publishing.ts");

let ok = 0;
let ko = 0;
const check = (name, cond, detail) => {
  if (cond) ok++;
  else ko++;
  console.log(cond ? "OK " : "KO ", name, cond || detail === undefined ? "" : `\n     ${detail}`);
};

const uid = `publishing-test-${Date.now()}`;
const other = `${uid}-autre`;
const day = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10); // dans 3 jours (heure de Paris)
const input = (over = {}) => ({ title: "Post de test", caption: "Bonjour le monde", hashtags: ["café", "lyon"], platforms: ["bluesky", "x"], imageUrl: null, day, time: "12:00", ...over });

try {
  await sql`insert into "user" (id, name, email) values (${uid}, 'Test publication', ${`${uid}@example.invalid`}), (${other}, 'Autre', ${`${other}@example.invalid`})`;
  const [{ id: P }] = await sql`insert into projects (user_id, name) values (${uid}, 'Projet publication') returning id`;
  const [{ id: P2 }] = await sql`insert into projects (user_id, name) values (${uid}, 'Second projet') returning id`;
  const rowsOf = (postId) => sql`select id, status, external_id, social_account_id from post_deliveries where post_id = ${postId}`;
  const postOf = async (postId) => (await sql`select status, caption, scheduled_at from posts where id = ${postId}`)[0];
  const insertPost = async (projectId, status, caption = "Texte", platforms = ["bluesky"], at = new Date(Date.now() + 3 * 86400_000)) =>
    (await sql`insert into posts (project_id, title, caption, platforms, status, scheduled_at, created_by) values (${projectId}, 'Titre', ${caption}, ${platforms}, ${status}, ${at}, 'agent') returning id`)[0].id;

  // ======================================================== COMPTES
  let { s, pub } = fakePublisher();
  let r = await Accounts.linkAccountAs(uid, P, "b1", pub);
  check("lier Bluesky : accepté", r.ok);
  let linked = await Accounts.readProjectAccounts(uid, P);
  check("le compte lié est lu avec SON réseau (donné par le service)", linked.length === 1 && linked[0].platform === "bluesky" && linked[0].name === "moi.bsky.social" && linked[0].channelId === "b1", JSON.stringify(linked));
  check("lier le même compte deux fois : sans effet", (await Accounts.linkAccountAs(uid, P, "b1", pub)).ok && (await Accounts.readProjectAccounts(uid, P)).length === 1);
  r = await Accounts.linkAccountAs(uid, P, "b2", pub);
  check("un 2e compte pour le même réseau : refusé « deja »", !r.ok && r.code === "deja", JSON.stringify(r));
  for (const [channel, code] of [["inconnu", "introuvable"], ["m1", "reseau"], ["f1", "deconnecte"], ["l1", "verrouille"]]) {
    r = await Accounts.linkAccountAs(uid, P, channel, pub);
    check(`lier « ${channel} » : refusé « ${code} »`, !r.ok && r.code === code, JSON.stringify(r));
  }
  s.failList = true;
  r = await Accounts.linkAccountAs(uid, P, "x1", pub);
  check("service en panne : refusé « service », rien n'est lié", !r.ok && r.code === "service" && (await Accounts.readProjectAccounts(uid, P)).length === 1, JSON.stringify(r));
  s.failList = false;
  r = await Accounts.linkAccountAs(other, P, "x1", pub);
  check("le projet d'un autre : refusé « introuvable »", !r.ok && r.code === "introuvable" && (await Accounts.readProjectAccounts(other, P)).length === 0);
  check("le même compte peut servir un AUTRE projet", (await Accounts.linkAccountAs(uid, P2, "b1", pub)).ok);
  const race = await Promise.all([Accounts.linkAccountAs(uid, P, "i1", pub), Accounts.linkAccountAs(uid, P, "i2", pub)]);
  check("deux liaisons simultanées pour Instagram : une seule passe", race.filter((x) => x.ok).length === 1 && race.filter((x) => !x.ok && x.code === "deja").length === 1, JSON.stringify(race));
  check("…et la base n'a qu'un compte Instagram", (await Accounts.readProjectAccounts(uid, P)).filter((a) => a.platform === "instagram").length === 1);
  await Accounts.linkAccountAs(uid, P, "x1", pub);
  const accountId = (platform) => sql`select id from social_accounts where project_id = ${P} and platform = ${platform}`.then((x) => x[0].id);

  // ======================================================== PROGRAMMER
  ({ s, pub } = fakePublisher());
  let saved = await Pub.savePostAndPublish(uid, P, null, input(), "schedule", pub);
  check("programmer Bluesky + X : accepté", saved.ok && saved.status === "scheduled", JSON.stringify(saved));
  const postA = saved.id;
  let del = await rowsOf(postA);
  check("deux envois enregistrés chez nous, deux posts chez le service", del.length === 2 && s.live.size === 2 && del.every((d) => d.status === "scheduled"));
  const sentPayloads = [...s.live.values()];
  check("le texte envoyé = légende + hashtags", sentPayloads.every((p) => p.text === "Bonjour le monde\n\n#café #lyon"), JSON.stringify(sentPayloads.map((p) => p.text)));
  check("chaque réseau part sur SON compte", sentPayloads.find((p) => p.platform === "bluesky").channelId === "b1" && sentPayloads.find((p) => p.platform === "x").channelId === "x1");
  check("à la date choisie, jamais « tout de suite »", sentPayloads.every((p) => p.dueAt instanceof Date && p.dueAt.getTime() > Date.now() + 2 * 86400_000));

  // un réseau sans compte
  ({ s, pub } = fakePublisher());
  saved = await Pub.savePostAndPublish(uid, P2, null, input({ platforms: ["x"] }), "schedule", pub);
  check("réseau sans compte lié : refusé, message clair", !saved.ok && /Aucun compte X/.test(saved.error ?? "") && /brouillon/.test(saved.error ?? ""), JSON.stringify(saved));
  const [orphanDraft] = await sql`select id, status, caption from posts where project_id = ${P2} order by created_at desc limit 1`;
  check("…le post est enregistré en BROUILLON (ce qui a été écrit n'est pas perdu), rien chez le service", orphanDraft.status === "draft" && orphanDraft.caption === "Bonjour le monde" && s.live.size === 0 && s.scheduleCalls === 0);

  // un des deux réseaux refusé : retour en arrière
  ({ s, pub } = fakePublisher());
  s.failSchedule.add("x");
  saved = await Pub.savePostAndPublish(uid, P, null, input({ title: "Course" }), "schedule", pub);
  const [failedPost] = await sql`select id, status from posts where project_id = ${P} and title = 'Course'`;
  check("X refusé après Bluesky accepté : échec annoncé avec le réseau en cause", !saved.ok && /^X : /.test(saved.error ?? "") && /refusé par le test/.test(saved.error ?? ""), JSON.stringify(saved));
  check("…Bluesky est ANNULÉ chez le service (tout ou rien), aucune trace chez nous", s.live.size === 0 && (await rowsOf(failedPost.id)).length === 0);
  check("…le post revient en brouillon", failedPost.status === "draft");

  // retour en arrière impossible
  ({ s, pub } = fakePublisher());
  s.failSchedule.add("x");
  s.failCancel = true;
  saved = await Pub.savePostAndPublish(uid, P, null, input({ title: "Orphelin" }), "schedule", pub);
  const [orph] = await sql`select id from posts where project_id = ${P} and title = 'Orphelin'`;
  check("annulation du retour en arrière impossible : on le DIT", !saved.ok && /Attention : 1 envoi/.test(saved.error ?? ""), JSON.stringify(saved));
  check("…et la trace est GARDÉE chez nous pour le retrouver", (await rowsOf(orph.id)).length === 1 && s.live.size === 1);
  await sql`delete from post_deliveries where post_id = ${orph.id}`;

  // ======================================================== REPROGRAMMER
  ({ s, pub } = fakePublisher());
  saved = await Pub.savePostAndPublish(uid, P, null, input({ title: "Modifié" }), "schedule", pub);
  const postB = saved.id;
  const before = (await rowsOf(postB)).map((d) => d.external_id).sort();
  saved = await Pub.savePostAndPublish(uid, P, postB, input({ title: "Modifié", caption: "Nouveau texte" }), "schedule", pub);
  const after = await rowsOf(postB);
  check("reprogrammer : toujours 2 envois, 2 posts chez le service", saved.ok && after.length === 2 && s.live.size === 2);
  check("…ce sont de NOUVEAUX envois (l'ancienne version est partie)", after.every((d) => !before.includes(d.external_id)));
  check("…avec le NOUVEAU texte, jamais l'ancien", [...s.live.values()].every((p) => p.text.startsWith("Nouveau texte")));

  // validation qui échoue : rien ne doit être annulé chez le service
  const cancelsBefore = s.cancelCalls;
  saved = await Pub.savePostAndPublish(uid, P, postB, input({ title: "Modifié", caption: "" }), "schedule", pub);
  check("sauvegarde invalide d'un post programmé : refusée", !saved.ok && !!saved.errors?.caption, JSON.stringify(saved));
  check("…le service n'a PAS été touché (le post part toujours, avec son ancien texte)", s.cancelCalls === cancelsBefore && s.live.size === 2 && [...s.live.values()].every((p) => p.text.startsWith("Nouveau texte")));
  check("…notre base non plus : toujours programmé", (await postOf(postB)).status === "scheduled" && (await rowsOf(postB)).length === 2);

  // annulation impossible pendant la reprogrammation
  s.failCancel = true;
  saved = await Pub.savePostAndPublish(uid, P, postB, input({ title: "Modifié", caption: "Autre texte" }), "schedule", pub);
  check("annulation impossible : « Rien n'a été modifié »", !saved.ok && /Rien n’a été modifié/.test(saved.error ?? ""), JSON.stringify(saved));
  check("…le post garde son ancien texte, ses envois, son état", (await postOf(postB)).caption === "Nouveau texte" && (await postOf(postB)).status === "scheduled" && (await rowsOf(postB)).length === 2 && s.live.size === 2);
  s.failCancel = false;

  // repasser en brouillon : doit retirer chez le service
  saved = await Pub.savePostAndPublish(uid, P, postB, input({ title: "Modifié", caption: "Nouveau texte" }), "draft", pub);
  check("« Enregistrer en brouillon » d'un post programmé : retiré chez le service", saved.ok && saved.status === "draft" && s.live.size === 0 && (await rowsOf(postB)).length === 0 && (await postOf(postB)).status === "draft");

  // ======================================================== VALIDER (post produit par l'équipe)
  ({ s, pub } = fakePublisher());
  const review = await insertPost(P, "to_review", "Proposé par l'équipe", ["bluesky"]);
  let v = await Pub.validateAndPublish(uid, P, review, pub);
  check("valider un post à valider : programmé ET envoyé", v.ok && (await postOf(review)).status === "scheduled" && s.live.size === 1 && (await rowsOf(review)).length === 1, JSON.stringify(v));
  const review2 = await insertPost(P, "to_review", "Proposé encore", ["bluesky"]);
  s.failSchedule.add("bluesky");
  v = await Pub.validateAndPublish(uid, P, review2, pub);
  check("valider alors que le service refuse : échec, code « publication »", !v.ok && v.code === "publication", JSON.stringify(v));
  check("…le post redevient « à valider » (il n'est pas perdu), aucune trace", (await postOf(review2)).status === "to_review" && (await rowsOf(review2)).length === 0);
  const review3 = await insertPost(P2, "to_review", "Sans compte", ["x"]);
  v = await Pub.validateAndPublish(uid, P2, review3, pub);
  check("valider sans compte lié : code « compte », post toujours « à valider »", !v.ok && v.code === "compte" && (await postOf(review3)).status === "to_review", JSON.stringify(v));

  // ======================================================== DÉPROGRAMMER / SUPPRIMER
  s.failSchedule.clear();
  const u = (await Pub.savePostAndPublish(uid, P, null, input({ title: "À déprogrammer" }), "schedule", pub)).id;
  s.failCancel = true;
  v = await Pub.unscheduleAndCancel(uid, P, u, pub);
  check("déprogrammer alors que l'annulation échoue : refusé, le post RESTE programmé", !v.ok && v.code === "publication" && (await postOf(u)).status === "scheduled" && (await rowsOf(u)).length === 2, JSON.stringify(v));
  v = await Pub.deleteAndCancel(uid, P, u, pub);
  check("supprimer alors que l'annulation échoue : refusé, le post existe encore", !v.ok && v.code === "publication" && !!(await postOf(u)), JSON.stringify(v));
  s.failCancel = false;
  const liveBefore = s.live.size;
  v = await Pub.unscheduleAndCancel(uid, P, u, pub);
  check("déprogrammer : retiré chez le service, redevient brouillon", v.ok && (await postOf(u)).status === "draft" && (await rowsOf(u)).length === 0 && s.live.size === liveBefore - 2);
  const liveBeforeD2 = s.live.size;
  const d2 = (await Pub.savePostAndPublish(uid, P, null, input({ title: "À supprimer" }), "schedule", pub)).id;
  check("(préparation) le post à supprimer a bien 2 envois chez le service", s.live.size === liveBeforeD2 + 2 && (await rowsOf(d2)).length === 2);
  v = await Pub.deleteAndCancel(uid, P, d2, pub);
  check("supprimer : le post disparaît chez nous ET ses 2 envois chez le service", v.ok && !(await postOf(d2)) && s.live.size === liveBeforeD2, JSON.stringify([v, s.live.size, liveBeforeD2]));

  // ======================================================== ISOLATION ET GARDE-FOUS
  const mine = (await Pub.savePostAndPublish(uid, P, null, input({ title: "Privé" }), "schedule", pub)).id;
  const callsBefore = s.cancelCalls;
  const stranger = await Pub.cancelPostDeliveries(other, P, mine, pub);
  check("le projet d'un autre ne peut rien annuler (ni appeler le service)", stranger.ok && stranger.cancelled === 0 && s.cancelCalls === callsBefore && (await rowsOf(mine)).length === 2);
  const strangerSend = await Pub.sendScheduledPost(other, P, mine, pub);
  check("…ni envoyer", !strangerSend.ok && strangerSend.code === "etat");

  const published = await insertPost(P, "published", "Déjà publié", ["bluesky"], new Date(Date.now() - 86400_000));
  const cancelsPub = s.cancelCalls;
  saved = await Pub.savePostAndPublish(uid, P, published, input({ title: "Titre", caption: "Je modifie un post publié" }), "schedule", pub);
  check("modifier un post publié : refusé, le service n'est pas appelé", !saved.ok && s.cancelCalls === cancelsPub && (await postOf(published)).caption === "Déjà publié", JSON.stringify(saved));

  const long = await insertPost(P, "scheduled", "a".repeat(295), ["bluesky"]);
  await sql`update posts set hashtags = ARRAY['lyon','café'] where id = ${long}`;
  const tooLong = await Pub.sendScheduledPost(uid, P, long, pub);
  check("légende + hashtags au-delà de la limite du réseau : refusé avant d'appeler le service", !tooLong.ok && tooLong.code === "texte" && /300/.test(tooLong.message), JSON.stringify(tooLong));
  const draftSend = await Pub.sendScheduledPost(uid, P, u, pub);
  check("envoyer un post qui n'est pas programmé : refusé", !draftSend.ok && draftSend.code === "etat");

  // ======================================================== RETIRER UN COMPTE
  const bluesky = await accountId("bluesky");
  r = await Accounts.unlinkAccountAs(uid, P, bluesky);
  check("retirer un compte qui porte des posts programmés : refusé « programmes »", !r.ok && r.code === "programmes", JSON.stringify(r));
  await Pub.deleteAndCancel(uid, P, mine, pub);
  for (const [id] of await sql`select id from posts where project_id = ${P} and status = 'scheduled'`.then((x) => x.map((y) => [y.id]))) await Pub.unscheduleAndCancel(uid, P, id, pub);
  // un envoi « publié » (historique) ne doit pas bloquer le retrait
  const hist = await insertPost(P, "published", "Historique", ["bluesky"], new Date(Date.now() - 86400_000));
  await sql`insert into post_deliveries (post_id, social_account_id, external_id, status) values (${hist}, ${bluesky}, 'ext-hist', 'sent')`;
  r = await Accounts.unlinkAccountAs(uid, P, bluesky);
  check("retirer un compte sans post programmé (historique seulement) : accepté", r.ok, JSON.stringify(r));
  check("…son historique part avec lui, le post publié reste", (await rowsOf(hist)).length === 0 && !!(await postOf(hist)));
  r = await Accounts.unlinkAccountAs(other, P, await accountId("x"));
  check("retirer le compte d'un autre projet : refusé", !r.ok && r.code === "introuvable");

  // ======================================================== SUPPRESSION D'UN PROJET
  // Un projet avec un compte, un post et un envoi : la suppression du projet doit tout emporter sans erreur de clé étrangère
  await Accounts.linkAccountAs(uid, P2, "x1", pub);
  const p2Post = await insertPost(P2, "scheduled", "Dans le projet condamné", ["x"]);
  await sql`insert into post_deliveries (post_id, social_account_id, external_id, status) select ${p2Post}, id, 'ext-p2', 'scheduled' from social_accounts where project_id = ${P2} and platform = 'x'`;
  check("(préparation) le second projet a un compte, un post et un envoi", (await rowsOf(p2Post)).length === 1);
  await sql`delete from projects where id = ${P2}`;
  const gone = await sql`select (select count(*) from social_accounts where project_id = ${P2})::int as a, (select count(*) from posts where project_id = ${P2})::int as p, (select count(*) from post_deliveries where post_id = ${p2Post})::int as d`;
  check("supprimer un projet : comptes, posts et envois partent avec lui, sans erreur", gone[0].a === 0 && gone[0].p === 0 && gone[0].d === 0, JSON.stringify(gone[0]));
} catch (error) {
  ko++;
  console.log("KO  erreur inattendue :", error instanceof Error ? `${error.name} ${error.message}` : error);
} finally {
  await sql`delete from "user" where id in (${uid}, ${other})`;
  const [left] = await sql`select (select count(*) from projects where user_id in (${uid}, ${other}))::int as p, (select count(*) from social_accounts a join projects p on p.id = a.project_id where p.user_id in (${uid}, ${other}))::int as a`;
  console.log(`\nnettoyage : ${left.p === 0 && left.a === 0 ? "aucune donnée de test ne reste" : "ATTENTION, des données de test restent"}`);
  console.log(`${ok} réussis, ${ko} échoués`);
  await sql.end();
  process.exit(ko ? 1 : 0);
}
