import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { OfficeScene } from "@/components/office/office-scene";

export const metadata: Metadata = { title: "Vue d’ensemble · Socialix" };

// Étape 7.2 : seul le bureau est posé. Les cartes de chiffres et les listes arrivent à l'étape 7.3.
export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Vue d’ensemble" subtitle="Où en est la campagne et ce qui attend une décision." />
      <section aria-labelledby="bureau-titre" className="max-w-3xl">
        <h2 id="bureau-titre" className="mb-3 text-[13px] font-medium text-muted-foreground">
          Ton équipe
        </h2>
        <OfficeScene theme="auto" />
      </section>
    </>
  );
}
