import { notFound } from "next/navigation";

import { PostEditor } from "@/components/posts/post-editor";
import { requireMyProject, verifySession } from "@/lib/dal";
import { utcToParisInput } from "@/lib/dates";
import { imagekitConfig } from "@/lib/imagekit";
import { getPostAs, readTeamImages } from "@/lib/post-queries";
import { avatarPropsFor } from "@/lib/project-avatar-props";

// Lit ce qu'il faut à l'éditeur de post (le post à modifier, les images de l'équipe, l'état de la retouche) AVANT de l'afficher.
// Le projet est vérifié d'abord (404 s'il n'est pas à la personne), puis le post dans CE projet (404 sinon : même écran dans les
// deux cas, on ne révèle pas qu'un post existe ailleurs).
export async function PostEditorLoader({ projectId, postId, focusDate }: { projectId: string; postId: string | null; focusDate: boolean }) {
  const { user } = await verifySession();
  const project = await requireMyProject(projectId);
  const post = postId ? await getPostAs(user.id, projectId, postId) : null;
  if (postId && !post) notFound();
  const teamImages = await readTeamImages(user.id, projectId);
  const when = post?.scheduledAt ? utcToParisInput(post.scheduledAt) : { day: "", time: "" };

  return (
    <PostEditor
      projectId={projectId}
      avatar={avatarPropsFor(project)}
      initial={{
        id: post?.id ?? null,
        title: post?.title ?? "",
        caption: post?.caption ?? "",
        hashtags: post?.hashtags ?? [],
        platforms: post?.platforms ?? [],
        imageUrl: post?.imageUrl ?? null,
        day: when.day,
        time: when.time,
        published: post?.status === "published",
      }}
      teamImages={teamImages}
      retouchConfigured={imagekitConfig() !== null}
      focusDate={focusDate}
    />
  );
}
