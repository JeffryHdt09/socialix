import type { Metadata } from "next";

import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Réglages · Socialix" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Réglages" subtitle="Le projet et ses connexions." />
      <ComingSoon chapter="14" what="la clé du service de publication, puis le reste des réglages" />
    </>
  );
}
