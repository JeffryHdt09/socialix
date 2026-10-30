// Contrôle de la synchronisation de la publication (chapitre 14.4) sur la VRAIE base, avec un FAUX service de publication : ce que le
// service dit avoir fait d'un post (envoyé, refusé, bloqué), et le rattrapage de ce qu'une panne a laissé de travers.
// Usage : node scripts/check-delivery-sync.mjs        (DATABASE_URL dans .env.local, migration 0012 appliquée)
// Crée un utilisateur jetable, puis supprime tout (cascade). Rien n'est publié nulle part.
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
const Sync = load("src/lib/delivery-sync.ts");

let ok = 0;
let ko = 0;
const check = (name, cond, detail) => {
  if (cond) ok++;
  else ko++;
  console.log(cond ? "OK " : "KO ", name, cond || detail === undefined ? "" : `\n     ${detail}`);
};

const uid = `sync-test-${Date.now()}`;
const HOUR = 3_600_000;
const input = (over = {}) => ({ title: "Post de test", caption: "Bonjour", hashtags: [], platforms: ["bluesky"], imageUrl: null, day: new Date(Date.now() + 3 * 24 * HOUR).toISOString().slice(0, 10), time: "12:00", ...over });

try {
  await sql`insert into "user" (id, name, email) values (${uid}, 'Test sync', ${`${uid}@example.invalid`})`;
  const [{ id: P }] = await sql`insert into projects (user_id, name) values (${uid}, 'Projet sync') returning id`;
  const { s, pub } = fakePublisher();
  await Accounts.linkAccountAs(uid, P, "b1", pub);
  await Accounts.linkAccountAs(uid, P, "x1", pub);

  const postOf = async (id) => (await sql`select status from posts where id = ${id}`)[0]?.status;
  const rows = (id) => sql`select status, error, link, sent_at, external_id from post_deliveries where post_id = ${id} order by external_id`;
  // Programme un post pour de vrai (par notre service, chez le faux Buffer), puis fait « arriver l'heure prévue »
  const scheduled = async (platforms = ["bluesky"], hoursAgo = 1) => {
    const r = await Pub.savePostAndPublish(uid, P, null, input({ title: `Post ${Math.random()}`, platforms }), "schedule", pub);
    if (!r.ok) throw new Error(`programmation impossible : ${JSON.stringify(r)}`);
    const past = new Date(Date.now() - hoursAgo * HOUR);
    await sql`update post_deliveries set due_at = ${past} where post_id = ${r.id}`;
    await sql`update posts set scheduled_at = ${past} where id = ${r.id}`;
    return r.id;
  };
  const externalIds = async (id) => (await rows(id)).map((r) => r.external_id);

  // ---- un post parti
  let id = await scheduled();
  let [ext] = await externalIds(id);
  s.states.set(ext, { state: "sent", sentAt: new Date(Date.now() - 30 * 60_000), link: "https://bsky.app/profile/moi/post/1", error: null });
  let rep = await Sync.syncDeliveries(pub);
  let [d] = await rows(id);
  check("post parti : l'envoi devient « sent », avec son lien", d.status === "sent" && d.link === "https://bsky.app/profile/moi/post/1" && d.sent_at !== null, JSON.stringify(d));
  check("post parti : le post devient « publié »", (await postOf(id)) === "published" && rep.sent >= 1 && rep.postsPublished >= 1, JSON.stringify(rep));
  const again = await Sync.syncDeliveries(pub);
  check("deuxième passage : rien ne change (idempotent)", again.sent === 0 && again.failed === 0 && again.postsPublished === 0 && (await postOf(id)) === "published", JSON.stringify(again));

  // ---- le réseau refuse
  id = await scheduled();
  [ext] = await externalIds(id);
  s.states.set(ext, { state: "error", sentAt: null, link: null, error: "Instagram: l'image est trop grande" });
  await Sync.syncDeliveries(pub);
  [d] = await rows(id);
  check("le réseau refuse : envoi « failed » avec la raison du réseau", d.status === "failed" && d.error === "Instagram: l'image est trop grande", JSON.stringify(d));
  check("…et le post passe en « échec »", (await postOf(id)) === "failed");

  // ---- deux réseaux, un seul part
  id = await scheduled(["bluesky", "x"]);
  const [e1, e2] = await externalIds(id);
  s.states.set(e1, { state: "sent", sentAt: new Date(), link: null, error: null });
  s.states.set(e2, { state: "error", sentAt: null, link: null, error: "X : compte suspendu" });
  await Sync.syncDeliveries(pub);
  check("deux réseaux, un parti et un refusé : le post est « en échec » (pas « publié »)", (await postOf(id)) === "failed");
  check("…chaque envoi garde SON sort", (await rows(id)).map((r) => r.status).sort().join() === "failed,sent");

  // ---- en attente chez le service : on attend
  id = await scheduled(["bluesky"], 1);
  [ext] = await externalIds(id);
  s.states.set(ext, { state: "sending", sentAt: null, link: null, error: null });
  await Sync.syncDeliveries(pub);
  check("en cours d'envoi 1 h après l'heure prévue : on attend, rien ne change", (await postOf(id)) === "scheduled" && (await rows(id))[0].status === "scheduled");
  await sql`update post_deliveries set due_at = ${new Date(Date.now() - 7 * HOUR)} where post_id = ${id}`;
  await Sync.syncDeliveries(pub);
  check("toujours en attente 7 h après : « échec », avec une raison honnête", (await postOf(id)) === "failed" && /plus de 6 h/.test((await rows(id))[0].error ?? ""), JSON.stringify(await rows(id)));

  // ---- états qui ne sont pas une réussite
  for (const state of ["draft", "needs_approval", "unknown"]) {
    id = await scheduled();
    [ext] = await externalIds(id);
    s.states.set(ext, { state, sentAt: null, link: null, error: null });
    await Sync.syncDeliveries(pub);
    check(`état « ${state} » chez le service : jamais pris pour une réussite`, (await postOf(id)) === "failed" && (await rows(id))[0].status === "failed", String(await postOf(id)));
  }

  // ---- le service ne répond pas / ne connaît plus le post
  id = await scheduled();
  [ext] = await externalIds(id);
  s.failState.set(ext, { ok: false, reason: "unavailable", message: "Le service de publication ne répond pas. Réessaie dans un instant." });
  rep = await Sync.syncDeliveries(pub);
  check("service en panne : rien ne change, compté comme « injoignable »", (await postOf(id)) === "scheduled" && rep.unreachable >= 1 && (await rows(id))[0].status === "scheduled", JSON.stringify(rep));
  s.failState.set(ext, { ok: false, reason: "not_found", message: "Ce post n’existe plus chez le service de publication." });
  await Sync.syncDeliveries(pub);
  check("le service ne connaît plus le post : « échec »", (await postOf(id)) === "failed" && /n’existe plus/.test((await rows(id))[0].error ?? ""));

  // ---- pas encore l'heure : on ne dérange pas le service
  const futureId = (await Pub.savePostAndPublish(uid, P, null, input({ title: "Futur" }), "schedule", pub)).id;
  const calledFor = [];
  const origState = pub.state;
  pub.state = async (x) => { calledFor.push(x); return origState(x); };
  await Sync.syncDeliveries(pub);
  pub.state = origState;
  check("envoi prévu dans 3 jours : le service n'est jamais interrogé pour lui", !calledFor.includes((await externalIds(futureId))[0]), JSON.stringify(calledFor));
  check("…et il reste programmé", (await postOf(futureId)) === "scheduled");

  // ================================================== RATTRAPAGE
  const old = new Date(Date.now() - 30 * 60_000); // « plus vieux que le délai de grâce »
  const lonely = async (at, updatedAt, platforms = ["bluesky"]) => {
    const [r] = await sql`insert into posts (project_id, title, caption, platforms, status, scheduled_at, created_by, updated_at) values (${P}, 'Seul', 'Texte', ${platforms}, 'scheduled', ${at}, 'user', ${updatedAt}) returning id`;
    return r.id;
  };

  // programmé chez nous, aucun envoi, date future : on le renvoie
  const liveBefore = s.live.size;
  id = await lonely(new Date(Date.now() + 2 * 24 * HOUR), old);
  rep = await Sync.syncDeliveries(pub);
  check("programmé sans aucun envoi, date future : renvoyé au service", (await postOf(id)) === "scheduled" && (await rows(id)).length === 1 && s.live.size === liveBefore + 1 && rep.resent >= 1, JSON.stringify(rep));

  // récent : une opération est peut-être en cours, on n'y touche pas
  const callsBefore = s.scheduleCalls;
  id = await lonely(new Date(Date.now() + 2 * 24 * HOUR), new Date());
  await Sync.syncDeliveries(pub);
  check("programmé sans envoi mais MODIFIÉ à l'instant : on n'y touche pas (pas d'envoi en double)", (await postOf(id)) === "scheduled" && (await rows(id)).length === 0 && s.scheduleCalls === callsBefore);

  // date passée : ne partira jamais
  id = await lonely(new Date(Date.now() - 2 * HOUR), old);
  await Sync.syncDeliveries(pub);
  check("programmé sans envoi, date déjà passée : « échec » (il ne partira jamais, la personne doit le savoir)", (await postOf(id)) === "failed");

  // le service refuse au rattrapage
  s.failSchedule.add("bluesky");
  id = await lonely(new Date(Date.now() + 2 * 24 * HOUR), old);
  await Sync.syncDeliveries(pub);
  check("le service refuse au rattrapage : le post passe en « échec » plutôt que de rester faussement programmé", (await postOf(id)) === "failed" && (await rows(id)).length === 0);
  s.failSchedule.clear();

  // envoi orphelin : post repassé en brouillon alors que l'envoi existe encore chez le service
  const orphanPost = (await Pub.savePostAndPublish(uid, P, null, input({ title: "Orphelin" }), "schedule", pub)).id;
  const [orphanExt] = await externalIds(orphanPost);
  await sql`update posts set status = 'draft' where id = ${orphanPost}`; // l'annulation avait échoué, le post est redevenu brouillon
  const callsCancel = s.cancelCalls;
  await Sync.syncDeliveries(pub); // trop récent : délai de grâce
  check("envoi orphelin tout récent : on attend (une opération est peut-être en cours)", s.cancelCalls === callsCancel && s.live.has(orphanExt));
  await sql`update post_deliveries set created_at = ${old} where post_id = ${orphanPost}`;
  s.failCancel = true;
  await Sync.syncDeliveries(pub);
  check("envoi orphelin, annulation impossible : la trace est gardée pour réessayer", (await rows(orphanPost)).length === 1 && s.live.has(orphanExt));
  s.failCancel = false;
  rep = await Sync.syncDeliveries(pub);
  check("envoi orphelin, service de retour : annulé chez le service ET effacé chez nous", !s.live.has(orphanExt) && (await rows(orphanPost)).length === 0 && rep.orphansCancelled >= 1, JSON.stringify(rep));
  check("…le post, lui, reste un brouillon intact", (await postOf(orphanPost)) === "draft");

  // ---- deux synchronisations en même temps
  id = await scheduled();
  [ext] = await externalIds(id);
  s.states.set(ext, { state: "sent", sentAt: new Date(), link: null, error: null });
  const both = await Promise.all([Sync.syncDeliveries(pub), Sync.syncDeliveries(pub)]);
  check("deux synchronisations simultanées : le post est publié, une seule fois", (await postOf(id)) === "published" && (await rows(id)).length === 1 && both.reduce((n, r) => n + r.sent, 0) === 1, JSON.stringify(both));

  // ---- isolation : un post qui n'est plus « programmé » n'est pas touché par la lecture d'état
  id = await scheduled();
  [ext] = await externalIds(id);
  s.states.set(ext, { state: "sent", sentAt: new Date(), link: null, error: null });
  await sql`update posts set status = 'draft' where id = ${id}`;
  await sql`update post_deliveries set created_at = now() where post_id = ${id}`;
  await Sync.syncDeliveries(pub);
  check("un post repassé en brouillon n'est pas marqué « publié » par la synchronisation", (await postOf(id)) === "draft");
} catch (error) {
  ko++;
  console.log("KO  erreur inattendue :", error instanceof Error ? `${error.name} ${error.message}` : error);
} finally {
  await sql`delete from "user" where id = ${uid}`;
  const [left] = await sql`select count(*)::int as n from projects where user_id = ${uid}`;
  console.log(`\nnettoyage : ${left.n === 0 ? "aucune donnée de test ne reste" : "ATTENTION, des données de test restent"}`);
  console.log(`${ok} réussis, ${ko} échoués`);
  await sql.end();
  process.exit(ko ? 1 : 0);
}
