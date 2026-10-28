import type { Metadata } from "next";

import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Agents IA · Socialix" };

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agents IA" subtitle="Ton équipe d’agents et ses conversations." />
      <ComingSoon chapter="8 à 12" what="la barre des agents, le chat et les tâches" />
    </>
  );
}
