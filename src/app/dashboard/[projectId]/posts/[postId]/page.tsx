import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PostEditorLoader } from "@/components/posts/post-editor-loader";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Modifier le post · Socialix" };

// Modifier un post (PAGES.md, fiche 7). `?programmer=1` : arrivé par « Valider » sur un post incomplet, la date prend le focus.
export default function EditPostPage({ params, searchParams }: PageProps<"/dashboard/[projectId]/posts/[postId]">) {
  return (
    <>
      <PageHeader title="Modifier le post" subtitle="Change ce que tu veux, puis programme ou garde en brouillon." />
      <Suspense fallback={<EditorSkeleton />}>
        <Loader params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Loader({ params, searchParams }: Pick<PageProps<"/dashboard/[projectId]/posts/[postId]">, "params" | "searchParams">) {
  const { projectId, postId } = await params;
  const { programmer } = await searchParams;
  return <PostEditorLoader projectId={projectId} postId={postId} focusDate={programmer === "1"} />;
}

function EditorSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <div className="grid gap-4">
        <Skeleton className="h-11 rounded-md" />
        <Skeleton className="h-44 rounded-md" />
        <Skeleton className="h-11 rounded-md" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
