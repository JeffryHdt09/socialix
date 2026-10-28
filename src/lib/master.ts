import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { instructionsFor } from "@/lib/agent-instructions";
import { workersFor } from "@/lib/agents";
import { type ChatTurn, MAX_HISTORY, type ModelOptions, withModelFallback } from "@/lib/chat";
import { CHAT_MODELS, getModel } from "@/lib/models";
import { MAX_TASKS, type PlanDraft, planDraftSchema, type ValidPlan, validatePlan } from "@/lib/plan";

// Le Maître (chapitre 10). À chaque message, il choisit UNE des trois actions :
//   « answer » : répondre simplement ; « ask » : poser une question (la demande est trop floue) ; « plan » : produire un plan.
// Sa réponse passe par une SORTIE STRUCTURÉE (un objet qui suit un schéma), jamais du texte libre qu'on devrait deviner.
export const masterOutputSchema = z.object({
  action: z.enum(["answer", "ask", "plan"]).describe("answer = répondre ; ask = poser une question ; plan = produire un plan de tâches"),
  message: z.string().describe("Le texte que la personne lira, en français"),
  plan: planDraftSchema.nullable().describe("Le plan complet si action vaut plan, sinon null"),
});

// Combien de fois on laisse le Maître corriger un plan que validatePlan a refusé (en lui donnant la liste des défauts).
export const MAX_CORRECTIONS = 2;

// Le plan reste invalide malgré les corrections. Le texte des erreurs est gardé pour le journal du serveur, jamais montré tel quel.
export class MasterPlanError extends Error {
  constructor(readonly errors: string[]) {
    super("plan invalide");
  }
}

// Les consignes de planification, ajoutées à celles du rôle. La liste des agents est construite depuis les données (agents.ts) :
// ajouter un agent ne demande pas de réécrire ce texte.
const planningRules = (workers: string) => `Tu réponds UNIQUEMENT par un objet structuré avec trois champs : action, message, plan.

Choisis l'action :
- "answer" : question générale sur l'équipe ou sur son fonctionnement, ou échange qui ne demande aucun travail. plan vaut null.
- "ask" : la demande de travail est trop floue pour être planifiée, car il manque une information sans laquelle les agents ne peuvent pas travailler (le commerce ou la marque, le réseau, le nombre de posts, les dates). Pose UNE ou DEUX questions précises dans message, rien d'autre. Ne repose JAMAIS une question dont la réponse figure déjà dans la conversation. plan vaut null.
- "plan" : tu as assez d'informations. Mets le plan complet dans plan et, dans message, résume-le en deux ou trois phrases.

Règles du plan :
- Chaque tâche est confiée à UN agent, désigné par son identifiant exact, parmi :
${workers}
- Tu ne te confies jamais de tâche à toi-même.
- "key" : un nom court unique (t1, t2, t3…). "dependsOn" : les "key" des tâches à terminer avant celle-ci, [] sinon. N'ajoute une dépendance que si la tâche a vraiment besoin du résultat de l'autre ; les tâches indépendantes n'en ont pas.
- "instruction" doit se suffire à elle-même : l'agent ne voit PAS la conversation. Recopie tout le contexte utile (commerce, ton, réseau, nombre de posts, dates, contraintes).
- Fais simple : 1 à 6 tâches en général, ${MAX_TASKS} au maximum.
- N'invente pas de tâche qui demande une capacité que l'équipe n'a pas encore (chercher sur Internet, publier, programmer, générer une image, lire de vraies statistiques) : remplace-la par ce que l'agent sait faire (proposer des idées, rédiger, proposer un calendrier, expliquer des indicateurs).
- Les tâches sont enregistrées mais ne s'exécutent pas encore toutes seules (cela arrive plus tard). Dans message, ne dis donc JAMAIS que le travail est en cours ou terminé : dis que le plan est prêt.`;

export type MasterResult = {
  action: "answer" | "ask" | "plan";
  message: string;
  plan?: ValidPlan; // le plan validé et ordonné (seulement si action = plan)
  rawPlan?: PlanDraft; // le plan tel que le modèle l'a écrit, gardé en base pour l'audit
  model: string;
  corrections: number; // combien de fois le Maître a dû corriger son plan
};

// Fait répondre le Maître. Un plan refusé par validatePlan lui est renvoyé avec la liste des défauts, jusqu'à MAX_CORRECTIONS fois.
export async function runMaster(history: ChatTurn[], options: ModelOptions = {}): Promise<MasterResult> {
  const { models = CHAT_MODELS, modelFactory = getModel } = options;
  // Les agents que le Maître peut employer dépendent du projet : seulement ceux de ses équipes activées
  const team = workersFor(options.teams);
  const roster = team.map((a) => `- ${a.id} (${a.name}) : ${a.role}`).join("\n");
  const system = `${instructionsFor("maitre", options.teams)}\n\n${planningRules(roster)}`;
  let turns: ChatTurn[] = history.slice(-MAX_HISTORY);
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= MAX_CORRECTIONS; attempt++) {
    const { value: out, model } = await withModelFallback(models, async (name) => {
      const result = await generateText({ model: modelFactory(name), system, messages: turns, output: Output.object({ schema: masterOutputSchema }), maxRetries: 1, timeout: 45_000 });
      return result.output ?? null;
    });

    const message = out.message.trim();
    if (out.action !== "plan") {
      if (message.length > 0) return { action: out.action, message, model, corrections: attempt };
      lastErrors = ["Le message est vide : écris la réponse que la personne doit lire."];
    } else {
      const checked = out.plan === null ? { ok: false as const, errors: ['action vaut "plan" mais le champ plan est null.'] } : validatePlan(out.plan, team.map((a) => a.id));
      if (checked.ok && message.length > 0) return { action: "plan", message, plan: checked.plan, rawPlan: out.plan!, model, corrections: attempt };
      lastErrors = checked.ok ? ["Le message est vide : résume le plan pour la personne."] : checked.errors;
    }

    // On montre au Maître son propre résultat et la liste des défauts, puis il recommence (jamais montrée à la personne).
    turns = [
      ...turns,
      { role: "assistant", content: JSON.stringify(out) },
      { role: "user", content: `[Contrôle automatique] Ta réponse est refusée pour ces raisons :\n${lastErrors.map((e) => `- ${e}`).join("\n")}\nCorrige-la et réponds de nouveau avec l'objet structuré complet.` },
    ];
  }
  console.error("Maître : plan invalide après correction :", lastErrors.join(" | "));
  throw new MasterPlanError(lastErrors);
}
