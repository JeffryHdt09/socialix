import type { Metadata } from "next";

import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Comptes · Socialix" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Comptes" subtitle="Les réseaux sociaux connectés à cette campagne." />
      <ComingSoon chapter="14" what="la connexion au service de publication" />
    </>
  );
}
