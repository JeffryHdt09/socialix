import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PostEditorLoader } from "@/components/posts/post-editor-loader";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Nouveau post · Socialix" };

// Créer un post à la main (PAGES.md, fiche 7).
export default function NewPostPage({ params }: PageProps<"/dashboard/[projectId]/posts/new">) {
  return (
    <>
      <PageHeader title="Nouveau post" subtitle="Écris, choisis l’image et les réseaux, puis programme ou garde en brouillon." />
      <Suspense fallback={<EditorSkeleton />}>
        <Loader params={params} />
      </Suspense>
    </>
  );
}

async function Loader({ params }: Pick<PageProps<"/dashboard/[projectId]/posts/new">, "params">) {
  const { projectId } = await params;
  return <PostEditorLoader projectId={projectId} postId={null} focusDate={false} />;
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
