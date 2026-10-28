import type { Metadata } from "next";

import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Posts · Socialix" };

export default function PostsPage() {
  return (
    <>
      <PageHeader title="Posts" subtitle="Tous les posts de la campagne, à valider ou programmés." />
      <ComingSoon chapter="13" what="la liste des posts et leur éditeur" />
    </>
  );
}
