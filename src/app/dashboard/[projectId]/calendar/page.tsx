import type { Metadata } from "next";

import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Calendrier · Socialix" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendrier" subtitle="Ce qui est programmé, jour par jour." />
      <ComingSoon chapter="15" what="le calendrier des publications" />
    </>
  );
}
