// Contrôle de l'interface « publicateur » et de l'adaptateur Buffer (chapitre 14), avec un FAUX serveur Buffer : ni réseau, ni clé, ni base.
// Usage : node scripts/check-publisher.mjs
// Vérifie ce qui est ENVOYÉ (texte en variable GraphQL, date, images, champs propres à Instagram et Facebook), la classification des
// erreurs, et que la clé ne sort jamais dans les journaux. Le vrai code TypeScript est testé.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLoader } from "./lib/load-ts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = createLoader(root);
const Buffer_ = load("src/lib/buffer.ts");
const Rules = load("src/lib/post-rules.ts");

let ok = 0;
let ko = 0;
const check = (name, cond, detail) => {
  if (cond) ok++;
  else ko++;
  console.log(cond ? "OK " : "KO ", name, cond || detail === undefined ? "" : `\n     ${detail}`);
};

const KEY = "secret-key-ABC123";
// Un faux Buffer : `replies` est une file de réponses ; chaque appel en consomme une et garde la requête reçue
function fake(...replies) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const r = replies.shift();
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error("plus de réponse prévue");
    const status = r.status ?? 200;
    return new Response(r.raw ?? JSON.stringify(r.json ?? { data: r.data }), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, publisher: Buffer_.createBufferPublisher({ apiKey: KEY, fetch: fetchFn }) };
}

// On écoute les journaux d'erreur : la clé et le texte du post ne doivent JAMAIS y figurer
const logged = [];
const realError = console.error;
console.error = (...args) => logged.push(args.map(String).join(" "));

const text = 'Le "café" du jour } { mutation { deletePost } \\ fin';
const base = { channelId: "ch1", platform: "bluesky", text, imageUrls: [], dueAt: new Date("2026-12-01T09:30:00.000Z") };

try {
  // ---------------------------------------------------------------- comptes
  let f = fake({ data: { account: { organizations: [{ id: "org1", name: "Mon organisation" }] } } }, { data: { channels: [
    { id: "a", name: "moi.bsky.social", service: "bluesky", isDisconnected: false, isLocked: false },
    { id: "b", name: "@moi", service: "twitter", isDisconnected: false, isLocked: false },
    { id: "c", name: "Ma Page", service: "facebook", isDisconnected: true, isLocked: false },
    { id: "d", name: "mastodon", service: "mastodon", isDisconnected: false, isLocked: true },
  ] } });
  let r = await f.publisher.listChannels();
  check("comptes : 4 canaux lus", r.ok && r.channels.length === 4);
  check("comptes : X s'appelle « twitter » chez Buffer et « x » chez nous", r.ok && r.channels.find((c) => c.id === "b").platform === "x");
  check("comptes : un réseau non géré (Mastodon) a platform = null", r.ok && r.channels.find((c) => c.id === "d").platform === null);
  check("comptes : déconnecté et verrouillé sont conservés", r.ok && r.channels.find((c) => c.id === "c").disconnected === true && r.channels.find((c) => c.id === "d").locked === true);
  check("comptes : la clé voyage dans l'en-tête Authorization (Bearer)", f.calls[0].headers.authorization === `Bearer ${KEY}`);
  check("comptes : l'organisation est passée en variable", f.calls[1].body.variables.input.organizationId === "org1");

  // ---------------------------------------------------------------- programmer
  const okReply = { data: { createPost: { __typename: "PostActionSuccess", post: { id: "post-1", dueAt: "2026-12-01T09:30:00.000Z" } } } };
  f = fake(okReply);
  r = await f.publisher.schedule(base);
  const sent = f.calls[0].body;
  check("programmer : succès, identifiant rendu", r.ok && r.externalId === "post-1" && r.dueAt.toISOString() === "2026-12-01T09:30:00.000Z");
  check("programmer : le texte voyage en VARIABLE, intact, jamais collé dans la requête", sent.variables.input.text === text && !sent.query.includes("mutation { deletePost }") && !sent.query.includes("café"));
  check("programmer : à l'heure précise, publié par Buffer lui-même", sent.variables.input.mode === "customScheduled" && sent.variables.input.dueAt === "2026-12-01T09:30:00.000Z" && sent.variables.input.schedulingType === "automatic");
  check("programmer : jamais en validation ni tout de suite", sent.variables.input.needsApproval === false && sent.variables.input.mode !== "shareNow");
  check("programmer : Bluesky n'envoie pas de métadonnées", !("metadata" in sent.variables.input));

  f = fake(okReply);
  await f.publisher.schedule({ ...base, platform: "instagram", imageUrls: ["https://exemple.test/a.jpg", "https://exemple.test/b.png"] });
  const ig = f.calls[0].body.variables.input;
  check("Instagram : les images partent en liste d'assets (adresse publique)", JSON.stringify(ig.assets) === JSON.stringify([{ image: { url: "https://exemple.test/a.jpg" } }, { image: { url: "https://exemple.test/b.png" } }]));
  check("Instagram : type de post et partage au fil exigés par le schéma", JSON.stringify(ig.metadata) === JSON.stringify({ instagram: { type: "post", shouldShareToFeed: true } }));
  f = fake(okReply);
  await f.publisher.schedule({ ...base, platform: "facebook" });
  check("Facebook : type de post exigé par le schéma", JSON.stringify(f.calls[0].body.variables.input.metadata) === JSON.stringify({ facebook: { type: "post" } }));
  f = fake(okReply);
  await f.publisher.schedule({ ...base, platform: "x" });
  check("X : aucune métadonnée", !("metadata" in f.calls[0].body.variables.input));

  // erreurs d'une mutation (union)
  const errReply = (type, message = "détail du service") => ({ data: { createPost: { __typename: type, message } } });
  for (const [type, reason] of [["LimitReachedError", "limit"], ["PostLimitReachedError", "limit"], ["UnauthorizedError", "auth"], ["InvalidInputError", "invalid"], ["PostInvalidInputError", "invalid"], ["PostChannelNotFoundError", "not_found"], ["ChannelRefreshRequired", "invalid"], ["UnexpectedError", "unavailable"], ["RestProxyError", "unavailable"]]) {
    r = await fake(errReply(type)).publisher.schedule(base);
    check(`programmer : ${type} -> « ${reason} »`, !r.ok && r.reason === reason && r.detail === "détail du service", JSON.stringify(r));
  }
  check("programmer : le message d'erreur est un texte FIXE en français, le détail à part", (await fake(errReply("InvalidInputError", "image too big")).publisher.schedule(base)).message === "Le service de publication a refusé ce post.");
  r = await fake({ data: { createPost: { __typename: "PostActionSuccess", post: {} } } }).publisher.schedule(base);
  check("programmer : un « succès » sans identifiant n'est PAS un succès", !r.ok);

  // ---------------------------------------------------------------- annuler
  f = fake({ data: { deletePost: { __typename: "DeletePostSuccess", id: "post-1" } } });
  r = await f.publisher.cancel("post-1");
  check("annuler : succès", r.ok && r.alreadyGone === false && f.calls[0].body.variables.input.id === "post-1");
  r = await fake({ data: { deletePost: { __typename: "NotFoundError", message: "x" } } }).publisher.cancel("post-1");
  check("annuler : déjà disparu = succès (idempotent)", r.ok && r.alreadyGone === true);
  r = await fake({ data: { deletePost: { __typename: "PostNotDeletableError", message: "already sent" } } }).publisher.cancel("post-1");
  check("annuler : déjà envoyé = échec « invalid » (on ne prétend pas l'avoir retiré)", !r.ok && r.reason === "invalid");

  // ---------------------------------------------------------------- état
  for (const [status, state] of [["scheduled", "scheduled"], ["sending", "sending"], ["sent", "sent"], ["error", "error"], ["draft", "draft"], ["needs_approval", "needs_approval"], ["nouveau_mot", "unknown"]]) {
    r = await fake({ data: { post: { id: "p", status, sentAt: null, externalLink: null, error: null } } }).publisher.state("p");
    check(`état : « ${status} » -> ${state}`, r.ok && r.state === state, JSON.stringify(r));
  }
  r = await fake({ data: { post: { id: "p", status: "sent", sentAt: "2026-12-01T09:31:00.000Z", externalLink: "https://bsky.app/x", error: null } } }).publisher.state("p");
  check("état : date d'envoi et lien lus", r.ok && r.sentAt.toISOString() === "2026-12-01T09:31:00.000Z" && r.link === "https://bsky.app/x");
  r = await fake({ data: { post: { id: "p", status: "error", sentAt: null, externalLink: null, error: { message: "Instagram: media rejected" } } } }).publisher.state("p");
  check("état : message d'erreur du réseau conservé", r.ok && r.state === "error" && r.error === "Instagram: media rejected");
  r = await fake({ json: { data: null, errors: [{ message: "Post not found for id: 6ae4e91810a950f1373c535b" }] } }).publisher.state("p");
  check("état : « Post not found » de Buffer (post supprimé, constaté en vrai) -> « not_found »", !r.ok && r.reason === "not_found", JSON.stringify(r));
  r = await fake({ data: { post: null } }).publisher.state("p");
  check("état : post introuvable -> « not_found »", !r.ok && r.reason === "not_found");

  // ---------------------------------------------------------------- pannes
  for (const [label, reply, reason] of [["HTTP 401", { status: 401, json: {} }, "auth"], ["HTTP 403", { status: 403, json: {} }, "auth"], ["HTTP 429", { status: 429, json: {} }, "limit"], ["HTTP 500", { status: 500, json: {} }, "unavailable"], ["HTTP 503", { status: 503, json: {} }, "unavailable"], ["réseau coupé", new Error(`connexion ${KEY}`), "unavailable"], ["réponse non JSON", { raw: "<html>oups</html>" }, "unavailable"], ["erreurs GraphQL sans données", { json: { errors: [{ message: "Cannot query field x" }] } }, "invalid"], ["jeton refusé (GraphQL)", { json: { errors: [{ message: "Unauthorized: invalid token" }] } }, "auth"]]) {
    r = await fake(reply).publisher.schedule(base);
    check(`panne : ${label} -> « ${reason} »`, !r.ok && r.reason === reason, JSON.stringify(r));
  }
  const noKey = Buffer_.createBufferPublisher({ apiKey: "   ", fetch: async () => { throw new Error("ne doit pas être appelé"); } });
  r = await noKey.schedule(base);
  check("sans clé : « not_configured », aucun appel réseau", !r.ok && r.reason === "not_configured");
  check("sans clé : valable aussi pour lister, annuler, lire l'état", [(await noKey.listChannels()).reason, (await noKey.cancel("x")).reason, (await noKey.state("x")).reason].every((x) => x === "not_configured"));

  // ---------------------------------------------------------------- journaux
  check("journaux : la clé n'apparaît jamais", !logged.some((l) => l.includes(KEY)), logged.join(" | "));
  check("journaux : ni le texte du post", !logged.some((l) => l.includes("café")));
  check("journaux : quelque chose est bien journalisé pour les pannes (statut seulement)", logged.some((l) => /Buffer/.test(l)));

  // ---------------------------------------------------------------- règles de posts : hashtags et Bluesky
  check("texte : légende, ligne vide, hashtags", Rules.buildPostText("Bonjour", ["café", "lyon"]) === "Bonjour\n\n#café #lyon");
  check("texte : sans hashtag, la légende seule", Rules.buildPostText("  Bonjour  ", []) === "Bonjour");
  check("texte : hashtags seuls", Rules.buildPostText("", ["café"]) === "#café");
  // Constaté au premier essai réel : l'agent met les hashtags dans le texte ET dans la liste
  check("texte : un hashtag déjà dans la légende n'est pas ajouté une 2e fois (sans tenir compte des majuscules)", Rules.buildPostText("Bonjour #Café", ["café", "lyon"]) === "Bonjour #Café\n\n#lyon");
  check("texte : tous déjà présents -> rien n'est ajouté", Rules.buildPostText("Vive #Lyon et #Café", ["lyon", "café"]) === "Vive #Lyon et #Café");
  const realCaption = "Commerçants et indépendants : vos réseaux vous prennent du temps ?\n\nAvec Socialix, une équipe d’agents IA prépare vos posts. Vous gardez le contrôle : rien n'est publié sans votre validation ! Simple, clair et sans stress. ✨\n\n#Socialix #ReseauxSociaux #Independants #PetitsCommerces";
  const realLen = Rules.buildPostText(realCaption, ["socialix", "reseauxsociaux", "independants", "petitscommerces"]).length;
  check("le cas réel de l'essai : 283 signes, plus 340", realLen === realCaption.length && realLen < 300, String(realLen));
  check("longueurs par réseau calculées par le programme", JSON.stringify(Rules.textLengths("abc", ["x"], ["bluesky", "x"])) === JSON.stringify([{ platform: "bluesky", length: 7, limit: 300 }, { platform: "x", length: 7, limit: 280 }]));
  check("Bluesky est un réseau reconnu, limité à 300 signes", Rules.isPlatform("bluesky") && Rules.CAPTION_LIMITS.bluesky === 300);
  const now = new Date("2026-11-01T10:00:00Z");
  const later = new Date("2026-11-02T10:00:00Z");
  const near = (caption, hashtags) => Rules.scheduleErrors({ caption, hashtags, platforms: ["x"], imageUrl: null, scheduledAt: later }, now);
  check("limite : 270 signes de légende passent sur X…", !near("a".repeat(270), []).caption);
  check("limite : …mais plus avec 2 hashtags (hashtags compris)", /hashtags compris/.test(near("a".repeat(270), ["café", "lyon"]).caption ?? ""), JSON.stringify(near("a".repeat(270), ["café", "lyon"])));
  check("limite : sans hashtags fournis, comportement inchangé", !Rules.scheduleErrors({ caption: "a".repeat(270), platforms: ["x"], imageUrl: null, scheduledAt: later }, now).caption);
  const full = Rules.validatePost({ title: "t", caption: "a".repeat(270), hashtags: ["café", "lyon"], platforms: ["x"], imageUrl: null, day: "2026-11-02", time: "12:00" }, "schedule", now);
  check("limite : validatePost refuse aussi (même règle côté serveur)", !full.ok && !!full.errors.caption);
} finally {
  console.error = realError;
}
console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
