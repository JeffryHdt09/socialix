import type { Metadata } from "next";
import { Suspense } from "react";

import { linkAccountAction, unlinkAccountAction } from "@/app/dashboard/[projectId]/accounts/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { readProjectAccounts } from "@/lib/account-service";
import { publisher } from "@/lib/buffer";
import { requireMyProject, verifySession } from "@/lib/dal";
import { networkName } from "@/lib/post-rules";
import type { Channel } from "@/lib/publisher";

export const metadata: Metadata = { title: "Comptes · Socialix" };

// Pourquoi une liaison ou un retrait a échoué : l'adresse porte un CODE (?erreur=deja), jamais un texte. Un code inconnu n'affiche rien.
const ERRORS: Record<string, string> = {
  introuvable: "Ce compte est introuvable chez le service de publication, ou n’est pas lié à ce projet.",
  reseau: "Socialix ne gère pas encore ce réseau.",
  deconnecte: "Ce compte est déconnecté chez le service de publication : reconnecte-le d’abord, puis reviens ici.",
  verrouille: "Ce compte est verrouillé chez le service de publication (limite de ton offre).",
  deja: "Ce projet a déjà un compte pour ce réseau. Retire-le d’abord si tu veux en changer.",
  programmes: "Des posts programmés passent par ce compte. Déprogramme-les d’abord, puis retire le compte.",
  service: "Le service de publication ne répond pas. Réessaie dans un instant.",
};

// Les comptes d'un projet (PAGES.md) : lesquels des comptes connectés chez Buffer servent à CE projet. Les comptes eux-mêmes se
// connectent chez Buffer (Instagram, Page Facebook, X, LinkedIn, Bluesky…) : Socialix ne voit jamais un mot de passe de réseau social.
export default function AccountsPage({ params, searchParams }: PageProps<"/dashboard/[projectId]/accounts">) {
  return (
    <>
      <PageHeader title="Comptes" subtitle="Les réseaux sociaux que ce projet peut utiliser pour publier." />
      <Suspense fallback={<AccountsSkeleton />}>
        <AccountsContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function channelNote(channel: Channel, linkedPlatforms: Set<string>, linkedChannelIds: Set<string>): { usable: boolean; text: string | null } {
  if (linkedChannelIds.has(channel.id)) return { usable: false, text: "Déjà lié à ce projet." };
  if (!channel.platform) return { usable: false, text: "Socialix ne gère pas encore ce réseau." };
  if (channel.disconnected) return { usable: false, text: "Déconnecté chez Buffer : reconnecte-le là-bas d’abord." };
  if (channel.locked) return { usable: false, text: "Verrouillé chez Buffer (limite de ton offre)." };
  if (linkedPlatforms.has(channel.platform)) return { usable: false, text: `Ce projet a déjà un compte ${networkName(channel.platform)}.` };
  return { usable: true, text: null };
}

async function AccountsContent({ params, searchParams }: Pick<PageProps<"/dashboard/[projectId]/accounts">, "params" | "searchParams">) {
  const { projectId } = await params;
  const { erreur } = await searchParams;
  const { user } = await verifySession();
  await requireMyProject(projectId); // 404 si le projet n'est pas à la personne

  const linked = await readProjectAccounts(user.id, projectId);
  const listed = await publisher.listChannels();
  const message = typeof erreur === "string" && Object.hasOwn(ERRORS, erreur) ? ERRORS[erreur] : null;
  const linkedPlatforms = new Set<string>(linked.map((a) => a.platform));
  const linkedChannelIds = new Set(linked.map((a) => a.channelId));

  return (
    <div className="flex flex-col gap-8">
      {message && (
        <p role="alert" className="rounded-lg border border-destructive px-3 py-2 text-[14px] text-destructive">
          {message}
        </p>
      )}

      <section aria-labelledby="linked-title" className="flex flex-col gap-3">
        <h2 id="linked-title" className="text-[17px] font-semibold">
          Comptes de ce projet
        </h2>
        {linked.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-[15px] text-muted-foreground">
            Aucun compte lié. Tant qu’aucun compte n’est lié, un post ne peut pas être programmé : choisis-en un plus bas.
          </p>
        ) : (
          <ul className="grid gap-2">
            {linked.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{networkName(a.platform)}</p>
                  <p className="break-words text-[14px] text-muted-foreground">{a.name}</p>
                </div>
                <form action={unlinkAccountAction.bind(null, projectId, a.id)}>
                  <Button type="submit" variant="outline">
                    Retirer
                    <span className="sr-only"> le compte {networkName(a.platform)} {a.name}</span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="available-title" className="flex flex-col gap-3">
        <h2 id="available-title" className="text-[17px] font-semibold">
          Comptes connectés chez Buffer
        </h2>
        {!listed.ok ? (
          <p role="alert" className="rounded-lg border border-destructive px-3 py-2 text-[14px] text-destructive">
            {listed.message}
            {listed.detail ? ` (${listed.detail})` : ""}
          </p>
        ) : listed.channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-[15px]">
            <p className="font-semibold">Aucun compte n’est connecté chez Buffer.</p>
            <p className="mt-1 text-muted-foreground">
              Connecte tes comptes sur{" "}
              <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                publish.buffer.com<span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
              </a>
              , puis recharge cette page. Instagram demande un compte professionnel relié à une Page Facebook ; Facebook, une Page (pas un profil personnel).
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {listed.channels.map((c) => {
              const note = channelNote(c, linkedPlatforms, linkedChannelIds);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{c.platform ? networkName(c.platform) : c.service}</p>
                    <p className="break-words text-[14px] text-muted-foreground">{c.name}</p>
                    {note.text && <p className="mt-0.5 text-[13px] text-muted-foreground">{note.text}</p>}
                  </div>
                  {note.usable && (
                    <form action={linkAccountAction.bind(null, projectId, c.id)}>
                      <Button type="submit">
                        Lier à ce projet
                        <span className="sr-only"> : {c.platform ? networkName(c.platform) : c.service} {c.name}</span>
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-3">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
