import type { Metadata } from "next";

import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Vue d’ensemble · Socialix" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Vue d’ensemble" subtitle="Où en est la campagne et ce qui attend une décision." />
      <ComingSoon chapter="7" what="le bureau des agents et l’état de la campagne" />
    </>
  );
}
