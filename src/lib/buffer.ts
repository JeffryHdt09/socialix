import "server-only";

import type { Platform } from "@/lib/post-rules";
import { type CancelResult, type Channel, type DeliveryState, failure, type Failure, type ListChannelsResult, type Publisher, type ScheduleResult, type StateResult } from "@/lib/publisher";

// L'adaptateur Buffer (chapitre 14). Buffer parle GraphQL : UNE adresse, des requêtes (lire) et des mutations (agir), et on lui dit
// exactement quels champs on veut en retour. Toutes les valeurs venues de l'utilisateur (texte du post, adresses d'images) passent en
// VARIABLES GraphQL, jamais collées dans le texte de la requête : un texte qui contiendrait des guillemets ou « } » ne peut pas
// la modifier (même idée qu'une requête SQL préparée).
//
// Les noms de champs et de valeurs viennent du schéma réel de l'API, lu par introspection le 30/10/2026 (PLAN.md, D5).

const ENDPOINT = "https://api.buffer.com";
const TIMEOUT_MS = 30_000;

// Notre réseau <-> le « service » de Buffer. X s'appelle « twitter » chez Buffer. Les services absents d'ici (Mastodon, Google
// Business, Substack, WhatsApp, Start Page) ne sont pas gérés par l'application : leur `platform` vaut null.
const SERVICE_OF: Record<Platform, string> = { instagram: "instagram", facebook: "facebook", linkedin: "linkedin", x: "twitter", tiktok: "tiktok", threads: "threads", pinterest: "pinterest", youtube: "youtube", bluesky: "bluesky" };
const PLATFORM_OF: Record<string, Platform> = Object.fromEntries(Object.entries(SERVICE_OF).map(([platform, service]) => [service, platform as Platform]));
export const platformOfService = (service: string): Platform | null => PLATFORM_OF[service] ?? null;

// Instagram et Facebook EXIGENT de dire quel genre de post c'est (champs obligatoires du schéma). Une image seule = un post classique,
// publié aussi dans le fil d'Instagram. TikTok et YouTube demandent une vidéo (phase 3) : pas de métadonnées pour l'instant.
function metadataFor(platform: Platform): Record<string, unknown> | undefined {
  if (platform === "instagram") return { instagram: { type: "post", shouldShareToFeed: true } };
  if (platform === "facebook") return { facebook: { type: "post" } };
  return undefined;
}

// Les états de Buffer (enum PostStatus du schéma) tels que nous les comprenons. Tout autre mot est « unknown », jamais un succès.
const STATES: Record<string, DeliveryState> = { draft: "draft", needs_approval: "needs_approval", scheduled: "scheduled", sending: "sending", sent: "sent", error: "error" };

type GraphQLResponse = { data?: Record<string, unknown> | null; errors?: { message?: string }[] };
type Deps = { apiKey?: string | null; fetch?: typeof fetch };

export function createBufferPublisher(deps: Deps = {}): Publisher {
  const apiKey = (deps.apiKey === undefined ? process.env.BUFFER_API_KEY : deps.apiKey)?.trim() || null;
  const doFetch = deps.fetch ?? fetch;

  // Un appel GraphQL. Renvoie les données, ou un échec déjà classé. Ne journalise JAMAIS le texte d'une erreur (il peut contenir du
  // texte du post) ni la clé : seulement le statut HTTP.
  async function call(query: string, variables: Record<string, unknown>): Promise<{ ok: true; data: Record<string, unknown> } | Failure> {
    if (!apiKey) return failure("not_configured");
    let res: Response;
    try {
      res = await doFetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      console.error("Buffer : l'appel a échoué", error instanceof Error ? error.name : "?");
      return failure("unavailable");
    }
    if (res.status === 401 || res.status === 403) return failure("auth");
    if (res.status === 429) return failure("limit");
    if (res.status >= 500) {
      console.error("Buffer : réponse", res.status);
      return failure("unavailable");
    }
    let json: GraphQLResponse;
    try {
      json = (await res.json()) as GraphQLResponse;
    } catch {
      console.error("Buffer : réponse illisible", res.status);
      return failure("unavailable");
    }
    // Des erreurs GraphQL sans données : la requête elle-même a été refusée (champ inconnu, variable invalide, jeton refusé…)
    if (!json.data) {
      const first = json.errors?.[0]?.message ?? "";
      console.error("Buffer : requête refusée", res.status, json.errors?.length ?? 0, "erreur(s)");
      // « Post not found for id: … » : ce que Buffer répond pour un post supprimé (constaté au premier essai réel, après une annulation)
      if (/not found/i.test(first)) return failure("not_found", first);
      return /unauthori|authenticat|token|api key/i.test(first) ? failure("auth") : failure("invalid", first);
    }
    return { ok: true, data: json.data };
  }

  // Un résultat de mutation est une UNION : soit le succès, soit un type d'erreur. `__typename` dit lequel, `message` l'explique.
  const classify = (result: { __typename?: string; message?: string } | null | undefined): Failure => {
    const type = result?.__typename ?? "";
    const detail = result?.message;
    if (type === "LimitReachedError" || type === "PostLimitReachedError") return failure("limit", detail);
    if (type === "UnauthorizedError") return failure("auth", detail);
    if (type === "NotFoundError" || type === "PostChannelNotFoundError") return failure("not_found", detail);
    if (type === "InvalidInputError" || type === "PostInvalidInputError" || type === "PostNotDeletableError" || type === "ChannelRefreshRequired") return failure("invalid", detail);
    return failure("unavailable", detail);
  };

  return {
    name: "buffer",

    async listChannels(): Promise<ListChannelsResult> {
      const orgs = await call("query Organizations { account { organizations { id name } } }", {});
      if (!orgs.ok) return orgs;
      const organizations = (orgs.data.account as { organizations?: { id: string }[] } | null)?.organizations ?? [];
      const channels: Channel[] = [];
      for (const org of organizations) {
        const res = await call("query Channels($input: ChannelsInput!) { channels(input: $input) { id name service isDisconnected isLocked } }", { input: { organizationId: org.id } });
        if (!res.ok) return res;
        for (const c of (res.data.channels as { id: string; name: string; service: string; isDisconnected: boolean; isLocked: boolean }[] | null) ?? []) {
          channels.push({ id: c.id, name: c.name, service: c.service, platform: platformOfService(c.service), disconnected: c.isDisconnected, locked: c.isLocked });
        }
      }
      return { ok: true, channels };
    },

    async schedule(payload): Promise<ScheduleResult> {
      const res = await call(
        `mutation SchedulePost($input: CreatePostInput!) {
          createPost(input: $input) {
            __typename
            ... on PostActionSuccess { post { id dueAt } }
            ... on MutationError { message }
          }
        }`,
        {
          input: {
            channelId: payload.channelId,
            text: payload.text,
            // customScheduled + dueAt : à CETTE date précise, jamais « tout de suite » ni « prochain créneau »
            mode: "customScheduled",
            dueAt: payload.dueAt.toISOString(),
            // automatic : Buffer publie lui-même (l'autre valeur, « notification », ne fait que rappeler à la personne de publier)
            schedulingType: "automatic",
            needsApproval: false,
            assets: payload.imageUrls.map((url) => ({ image: { url } })),
            ...(metadataFor(payload.platform) ? { metadata: metadataFor(payload.platform) } : {}),
          },
        },
      );
      if (!res.ok) return res;
      const out = res.data.createPost as { __typename?: string; message?: string; post?: { id?: string; dueAt?: string | null } } | null;
      if (out?.__typename === "PostActionSuccess" && typeof out.post?.id === "string") return { ok: true, externalId: out.post.id, dueAt: out.post.dueAt ? new Date(out.post.dueAt) : null };
      return classify(out);
    },

    async cancel(externalId): Promise<CancelResult> {
      const res = await call(
        `mutation DeletePost($input: DeletePostInput!) {
          deletePost(input: $input) {
            __typename
            ... on DeletePostSuccess { id }
            ... on MutationError { message }
          }
        }`,
        { input: { id: externalId } },
      );
      if (!res.ok) return res;
      const out = res.data.deletePost as { __typename?: string; message?: string } | null;
      if (out?.__typename === "DeletePostSuccess") return { ok: true, alreadyGone: false };
      // Déjà disparu chez Buffer : le but (« ce post ne partira pas ») est atteint
      if (out?.__typename === "NotFoundError") return { ok: true, alreadyGone: true };
      return classify(out);
    },

    async state(externalId): Promise<StateResult> {
      const res = await call("query PostState($input: PostInput!) { post(input: $input) { id status sentAt externalLink error { message } } }", { input: { id: externalId } });
      if (!res.ok) return res;
      const post = res.data.post as { status?: string; sentAt?: string | null; externalLink?: string | null; error?: { message?: string } | null } | null;
      if (!post) return failure("not_found");
      return { ok: true, state: STATES[post.status ?? ""] ?? "unknown", sentAt: post.sentAt ? new Date(post.sentAt) : null, link: post.externalLink ?? null, error: post.error?.message ?? null };
    },
  };
}

// Le publicateur de l'application : Buffer (décision D5). Un seul endroit à changer pour en choisir un autre.
export const publisher: Publisher = createBufferPublisher();
