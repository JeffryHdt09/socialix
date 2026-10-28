import type { Metadata } from "next";

import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Analytique · Socialix" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytique" subtitle="Ce qui a été publié et comment ça a marché." />
      <ComingSoon chapter="16" what="les statistiques de publication" />
    </>
  );
}
