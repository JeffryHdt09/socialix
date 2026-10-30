// Contrôle de la revue du Maître sur la VRAIE base, avec un FAUX modèle (src/lib/review-service.ts), sans Inngest ni quota.
// Usage : node scripts/check-review-flow.mjs        (DATABASE_URL dans .env.local ; les migrations 0011 et suivantes appliquées)
// Crée un utilisateur jetable, son projet et ses plans, puis supprime tout (cascade). Le vrai code TypeScript est testé.
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import postgres from "postgres";
import ts from "typescript";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });

const cache = new Map();
function resolveSource(base) {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (fs.existsSync(candidate)) return candidate;
  throw new Error(`Module introuvable : ${base}`);
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const m = new Module(file);
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m.require = (req) => {
    if (req === "server-only") return {};
    if (req.startsWith("@/")) return load(resolveSource(path.join(root, "src", req.slice(2))));
    if (req.startsWith(".")) return load(resolveSource(path.resolve(path.dirname(file), req)));
    return Module.prototype.require.call(m, req);
  };
  cache.set(file, m);
  m._compile(js, file);
  return m.exports;
}

const sql = postgres(process.env.DATABASE_URL, { max: 2, prepare: false, onnotice: () => {} });
const S = load(path.join(root, "src/lib/review-service.ts"));
const Chat = load(path.join(root, "src/lib/chat.ts"));
const Runner = load(path.join(root, "src/lib/task-runner.ts"));

let ok = 0;
let ko = 0;
const check = (name, cond, detail) => {
  if (cond) ok++;
  else ko++;
  console.log(cond ? "OK " : "KO ", name, cond || detail === undefined ? "" : `\n     ${detail}`);
};

const USAGE = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
// Un faux modèle qui répond chaque objet de `replies` à son tour (le dernier se répète). Un Error est LEVÉ au lieu d'être renvoyé.
function fakeModel(...replies) {
  let i = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const r = replies[Math.min(i++, replies.length - 1)];
      if (r instanceof Error) throw r;
      if (typeof r === "function") return r();
      return { content: [{ type: "text", text: JSON.stringify(r) }], finishReason: { unified: "stop", raw: "stop" }, usage: USAGE, warnings: [] };
    },
  });
  return { model, options: { models: ["faux"], modelFactory: () => model } };
}
const quotaError = () => new APICallError({ message: "quota", url: "http://faux", requestBodyValues: {}, statusCode: 429, isRetryable: false });
const downError = () => new APICallError({ message: "panne", url: "http://faux", requestBodyValues: {}, statusCode: 500, isRetryable: false });

const uid = `review-test-${Date.now()}`;
let projectId;
async function plan(specs, extra = {}) {
  const [p] = await sql`insert into agent_plans (project_id, request, summary, plan, status) values (${projectId}, '2 posts pour un café', 'Plan de test', '{}'::jsonb, ${extra.status ?? "active"}) returning id`;
  if (extra.sql) await extra.sql(p.id);
  const ids = [];
  for (const [i, s] of specs.entries()) {
    const [t] = await sql`insert into agent_tasks (plan_id, position, agent, title, instruction, status, output) values (${p.id}, ${i + 1}, ${s.agent ?? "createur"}, ${`Tâche ${i + 1}`}, ${`Consigne ${i + 1}`}, ${s.status ?? "done"}, ${s.status === "failed" || s.status === "cancelled" ? null : sql.json({ text: `Résultat ${i + 1}` })}) returning id`;
    ids.push(t.id);
  }
  for (const [i, s] of specs.entries()) for (const dep of s.dependsOn ?? []) await sql`insert into agent_task_dependencies (task_id, depends_on_task_id) values (${ids[i]}, ${ids[dep - 1]})`;
  return { planId: p.id, taskIds: ids };
}
const planRow = async (id) => (await sql`select status, report, review_round, review_failures, review_started_at from agent_plans where id = ${id}`)[0];
const taskRow = async (id) => (await sql`select status, instruction, attempts from agent_tasks where id = ${id}`)[0];
const complete = (report = "Tout est prêt.") => ({ decision: "complete", report, redo: [] });

try {
  await sql`insert into "user" (id, name, email) values (${uid}, 'Test revue', ${`${uid}@example.invalid`})`;
  [{ id: projectId }] = await sql`insert into projects (user_id, name) values (${uid}, 'Projet de test') returning id`;

  // 1. Conclure
  Chat.clearModelCooldowns();
  let { planId, taskIds } = await plan([{}, { dependsOn: [1] }]);
  let f = fakeModel(complete("Les deux posts sont prêts."));
  let res = await S.executeReview(planId, f.options);
  let row = await planRow(planId);
  check("conclure : issue « concluded », plan terminé, rapport enregistré", res.outcome === "concluded" && row.status === "done" && row.report === "Les deux posts sont prêts.", JSON.stringify([res.outcome, row]));
  check("conclure : le modèle a reçu les résultats des tâches", f.model.doGenerateCalls.length === 1 && JSON.stringify(f.model.doGenerateCalls[0].prompt).includes("Résultat 1"));
  res = await S.executeReview(planId, f.options);
  check("un plan conclu ne se relit pas (skipped, modèle non rappelé)", res.outcome === "skipped" && f.model.doGenerateCalls.length === 1);

  // 2. Renvoyer, puis conclure au tour suivant
  ({ planId, taskIds } = await plan([{}, { dependsOn: [1] }, { status: "failed" }]));
  f = fakeModel({ decision: "redo", report: "Je renvoie la 1.", redo: [{ position: 1, feedback: "Le nom du café est inventé." }] }, complete("Corrigé."));
  res = await S.executeReview(planId, f.options);
  row = await planRow(planId);
  let t1 = await taskRow(taskIds[0]);
  let t2 = await taskRow(taskIds[1]);
  let t3 = await taskRow(taskIds[2]);
  check("renvoyer : issue « redo », plan toujours actif, tour 1, pas de rapport", res.outcome === "redo" && row.status === "active" && row.review_round === 1 && row.report === null && row.review_started_at === null, JSON.stringify([res.outcome, row]));
  check("renvoyer : la tâche 1 repart avec le retour dans sa consigne", t1.status === "pending" && t1.instruction.includes("Le nom du café est inventé.") && t1.instruction.startsWith("Consigne 1"), JSON.stringify(t1));
  check("renvoyer : la tâche 2 (qui en dépend) repart aussi, sans retour", t2.status === "pending" && t2.instruction === "Consigne 2", JSON.stringify(t2));
  check("renvoyer : la tâche 3 (en échec) n'est pas touchée", t3.status === "failed");
  check("renvoyer : seule la tâche 1 est prête à repartir (la 2 attend la 1)", JSON.stringify(res.readyTaskIds) === JSON.stringify([taskIds[0]]), JSON.stringify(res.readyTaskIds));
  const [comm] = await sql`select from_agent, to_agent, message from agent_communications where task_id = ${taskIds[0]}`;
  check("renvoyer : le retour est enregistré dans les échanges (Maître vers l'agent)", comm && comm.from_agent === "maitre" && comm.message === "Le nom du café est inventé.", JSON.stringify(comm));
  res = await S.executeReview(planId, f.options);
  check("pendant que les tâches tournent, pas de revue (skipped)", res.outcome === "skipped" && f.model.doGenerateCalls.length === 1);
  await sql`update agent_tasks set status = 'done' where plan_id = ${planId} and status = 'pending'`; // les agents ont refait leur travail
  res = await S.executeReview(planId, f.options);
  row = await planRow(planId);
  check("2e revue : conclue au tour suivant", res.outcome === "concluded" && row.status === "done" && row.report === "Corrigé.", JSON.stringify([res.outcome, row]));

  // 3. Deux revues en même temps : une seule passe
  ({ planId } = await plan([{}]));
  f = fakeModel(async () => { await new Promise((r) => setTimeout(r, 300)); return { content: [{ type: "text", text: JSON.stringify(complete()) }], finishReason: { unified: "stop", raw: "stop" }, usage: USAGE, warnings: [] }; });
  const both = await Promise.all([S.executeReview(planId, f.options), S.executeReview(planId, f.options)]);
  check("deux revues simultanées : une seule passe, le modèle n'est appelé qu'une fois", f.model.doGenerateCalls.length === 1 && both.filter((r) => r.outcome === "concluded").length === 1 && both.filter((r) => r.outcome === "skipped").length === 1, JSON.stringify(both.map((r) => r.outcome)));

  // 4. Plan annulé pendant la revue : rien n'est écrasé
  ({ planId } = await plan([{}]));
  f = fakeModel(async () => { await sql`update agent_plans set status = 'cancelled' where id = ${planId}`; return { content: [{ type: "text", text: JSON.stringify(complete()) }], finishReason: { unified: "stop", raw: "stop" }, usage: USAGE, warnings: [] }; });
  res = await S.executeReview(planId, f.options);
  row = await planRow(planId);
  check("annulé pendant la revue : le rapport n'écrase pas l'annulation", res.outcome === "skipped" && row.status === "cancelled" && row.report === null, JSON.stringify([res.outcome, row]));

  // 5. Rien à relire : pas d'appel au modèle
  ({ planId } = await plan([{ status: "failed" }, { status: "cancelled" }]));
  f = fakeModel(complete());
  res = await S.executeReview(planId, f.options);
  row = await planRow(planId);
  check("aucune tâche réussie : conclu sans appeler le modèle", res.outcome === "concluded" && f.model.doGenerateCalls.length === 0 && row.status === "done" && /rien à relire/.test(row.report), JSON.stringify([res.outcome, row.report]));

  // 6. Quota épuisé : remis à plus tard, sans compter d'échec
  Chat.clearModelCooldowns();
  ({ planId } = await plan([{}]));
  f = fakeModel(quotaError());
  res = await S.executeReview(planId, f.options);
  row = await planRow(planId);
  check("quota épuisé : remis à plus tard, aucun échec compté, plan actif et libre", res.outcome === "deferred" && row.status === "active" && row.review_failures === 0 && row.review_started_at === null && row.report === null, JSON.stringify([res.outcome, row]));

  // 7. Modèle en panne : 3 échecs, puis conclusion sans relecture
  Chat.clearModelCooldowns();
  ({ planId } = await plan([{}]));
  f = fakeModel(downError());
  const outcomes = [];
  for (let i = 0; i < 3; i++) { Chat.clearModelCooldowns(); outcomes.push((await S.executeReview(planId, f.options)).outcome); }
  row = await planRow(planId);
  check("panne : deux reports puis conclusion sans relecture au 3e échec", JSON.stringify(outcomes) === '["deferred","deferred","fallback"]' && row.status === "done" && /n'a pas pu relire/.test(row.report), JSON.stringify([outcomes, row]));

  // 8. Réponse invalide corrigée par le Maître (le contrôle renvoie les défauts)
  ({ planId } = await plan([{}]));
  f = fakeModel({ decision: "redo", report: "x", redo: [{ position: 9, feedback: "a" }] }, complete("Finalement bon."));
  res = await S.executeReview(planId, f.options);
  row = await planRow(planId);
  check("réponse refusée puis corrigée : le Maître reçoit les défauts et conclut", res.outcome === "concluded" && f.model.doGenerateCalls.length === 2 && row.report === "Finalement bon.", JSON.stringify([res.outcome, f.model.doGenerateCalls.length]));
  check("le message de correction cite le défaut (tâche inexistante)", JSON.stringify(f.model.doGenerateCalls[1].prompt).includes("n'existe pas dans ce plan"));

  // 9. Réservation périmée reprise, réservation récente respectée
  ({ planId } = await plan([{}], { sql: async (id) => { await sql`update agent_plans set review_started_at = now() - interval '1 minute' where id = ${id}`; } }));
  f = fakeModel(complete());
  res = await S.executeReview(planId, f.options);
  check("revue en cours depuis 1 minute : on ne la double pas", res.outcome === "skipped" && f.model.doGenerateCalls.length === 0);
  await sql`update agent_plans set review_started_at = now() - interval '11 minutes' where id = ${planId}`;
  res = await S.executeReview(planId, f.options);
  check("revue abandonnée depuis 11 minutes : reprise", res.outcome === "concluded");

  // 10. L'exécuteur ne ferme plus le plan : il signale qu'il attend la revue (changement du chapitre 13b)
  Chat.clearModelCooldowns();
  ({ planId, taskIds } = await plan([{ status: "pending" }, { status: "pending", dependsOn: [1] }]));
  f = fakeModel("Voici le texte du post.");
  const first = await Runner.executeTask(taskIds[0], f.options);
  check("1re tâche terminée, la 2e reste ouverte : pas de revue demandée", first.outcome === "done" && first.reviewPlanId === undefined && JSON.stringify(first.readyTaskIds) === JSON.stringify([taskIds[1]]), JSON.stringify(first));
  const last = await Runner.executeTask(taskIds[1], f.options);
  row = await planRow(planId);
  check("dernière tâche terminée : revue demandée pour ce plan", last.outcome === "done" && last.reviewPlanId === planId, JSON.stringify(last));
  check("dernière tâche terminée : le plan reste ACTIF (seule la revue le termine)", row.status === "active" && row.report === null, JSON.stringify(row));
  res = await S.executeReview(planId, fakeModel(complete("Bilan.")).options);
  row = await planRow(planId);
  check("la revue qui suit termine le plan", res.outcome === "concluded" && row.status === "done" && row.report === "Bilan.");

  // 11. Le balayage trouve les bons plans
  const a = await plan([{}]); // à relire
  const b = await plan([{}, { status: "pending", dependsOn: [1] }]); // tâche ouverte
  const c = await plan([{}], { status: "cancelled" }); // annulé
  const d = await plan([]); // sans tâche
  const found = await S.findPlansToReview(200);
  check("balayage : trouve le plan à relire", found.includes(a.planId));
  check("balayage : ignore plan avec tâche ouverte, plan annulé, plan sans tâche", !found.includes(b.planId) && !found.includes(c.planId) && !found.includes(d.planId));
} catch (error) {
  ko++;
  console.log("KO  erreur inattendue :", error instanceof Error ? `${error.name} ${error.message}` : error);
} finally {
  await sql`delete from "user" where id = ${uid}`; // cascade : projet, plans, tâches, échanges
  const [left] = await sql`select count(*)::int as n from projects where user_id = ${uid}`;
  console.log(`\nnettoyage : ${left.n === 0 ? "aucune donnée de test ne reste" : "ATTENTION, des données de test restent"}`);
  console.log(`${ok} réussis, ${ko} échoués`);
  await sql.end();
  process.exit(ko ? 1 : 0);
}
