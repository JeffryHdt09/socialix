import Link from "next/link";

import { Button } from "@/components/ui/button";
import { dayOfMonth, longDay, plural, shortWeekday } from "@/lib/dates";
import type { Overview, OverviewDay } from "@/lib/overview-queries";
import { cn } from "@/lib/utils";

// Les trois cartes de chiffres de la vue d'ensemble (PAGES.md, fiche 4) : de tailles et de styles DIFFÉRENTS exprès,
// pour que l'œil sache tout de suite laquelle compte le plus.
// Règle de la charte : jamais de zéro trompeur. Un projet sans aucun post affiche un tiret et une phrase qui dit
// ce qui apparaîtra ; un projet qui a des posts affiche le vrai chiffre, y compris 0.
// Les cartes sont des « groupes » étiquetés, pas des repères (<section>) : trois repères de plus, dont deux portant des noms
// proches des listes (« À valider »), alourdiraient la navigation au lecteur d'écran (axe : landmark-unique).
const BIG = "text-[64px] leading-none font-semibold tracking-tight tabular-nums";

// Un petit rectangle hachuré = « pas encore confirmé » (DESIGN.md : même sens partout).
const HATCH = { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, var(--border) 4px 5px)" };

// La bande des 7 jours : pour chaque jour, les posts programmés (plein) et ceux pas encore confirmés (hachurés).
function WeekStrip({ strip }: { strip: OverviewDay[] }) {
  return (
    <ol aria-label="Les 7 prochains jours" className="mt-5 grid grid-cols-7 gap-1.5">
      {strip.map((d, i) => (
        <li key={d.day} className={cn("flex flex-col items-center gap-1 rounded-md border px-0.5 py-2", i === 0 ? "border-foreground" : "border-border")}>
          {/* Le détail visuel est caché aux lecteurs d'écran, qui lisent la phrase complète à la place */}
          <span className="sr-only">
            {i === 0 ? "Aujourd’hui, " : ""}
            {longDay(d.day)} : {d.scheduled} {plural(d.scheduled, "programmé", "programmés")}
            {d.unconfirmed > 0 ? `, ${d.unconfirmed} pas encore ${plural(d.unconfirmed, "confirmé", "confirmés")}` : ""}.
          </span>
          <span aria-hidden="true" className="font-mono text-[11px] text-muted-foreground">
            {shortWeekday(d.day)}
          </span>
          <span aria-hidden="true" className="font-mono text-[13px] font-medium">
            {dayOfMonth(d.day)}
          </span>
          <span aria-hidden="true" className="flex min-h-6 flex-col items-center justify-center gap-1">
            {d.scheduled > 0 && (
              <span className="min-w-6 rounded-full bg-primary px-1.5 text-center font-mono text-[12px] leading-6 font-semibold text-primary-foreground">{d.scheduled}</span>
            )}
            {d.unconfirmed > 0 && (
              <span style={HATCH} className="min-w-6 rounded-full border border-dashed border-muted-foreground px-1.5 text-center font-mono text-[12px] leading-5 font-semibold">
                {d.unconfirmed}
              </span>
            )}
            {d.scheduled === 0 && d.unconfirmed === 0 && <span className="size-1 rounded-full bg-border" />}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ScheduledCard({ overview, className }: { overview: Overview; className?: string }) {
  const empty = overview.totalPosts === 0;
  const n = overview.scheduledNext7Days;
  return (
    <div role="group" aria-labelledby="carte-programmes" className={cn("rounded-xl border border-border bg-card p-6", className)}>
      <h2 id="carte-programmes" className="text-[13px] font-medium text-muted-foreground">
        Programmés cette semaine
      </h2>
      <p className="mt-3 text-[88px] leading-none font-semibold tracking-tight tabular-nums max-sm:text-[64px]">{empty ? "—" : n}</p>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {empty ? "Les posts programmés apparaîtront ici." : n === 0 ? "Rien de programmé ces 7 prochains jours." : `${plural(n, "post prévu", "posts prévus")} d’ici 7 jours.`}
      </p>
      <WeekStrip strip={overview.strip} />
      <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span aria-hidden="true" style={HATCH} className="inline-block h-3 w-5 rounded-full border border-dashed border-muted-foreground" />
        Hachuré : pas encore confirmé (brouillon ou à valider)
      </p>
    </div>
  );
}

// La carte « À valider » est la SEULE de la page en jaune « signal » : elle signale qu'il y a quelque chose à faire.
// Sans rien à relire, elle redevient une carte ordinaire : le jaune ne décore jamais.
export function ReviewCard({ overview, projectId }: { overview: Overview; projectId: string }) {
  const n = overview.toReviewCount;
  const active = n > 0;
  return (
    <div
      role="group"
      aria-labelledby="carte-valider"
      className={cn("flex flex-col rounded-xl p-6", active ? "bg-signal text-signal-foreground" : "border border-border bg-card")}
    >
      <h2 id="carte-valider" className={cn("text-[13px] font-medium", active ? "text-signal-foreground" : "text-muted-foreground")}>
        À valider
      </h2>
      <p className={cn("mt-3", BIG)}>{overview.totalPosts === 0 ? "—" : n}</p>
      <p className={cn("mt-2 text-[15px]", active ? "text-signal-foreground" : "text-muted-foreground")}>
        {overview.totalPosts === 0 ? "Les posts à relire apparaîtront ici." : active ? `${plural(n, "post attend", "posts attendent")} ta relecture.` : "Rien à relire."}
      </p>
      {active && (
        <Button asChild className="mt-5 self-start">
          <Link href={`/dashboard/${projectId}/posts?statut=a-valider`}>Relire maintenant</Link>
        </Button>
      )}
    </div>
  );
}

// Carte discrète (bordure en pointillés) : tant qu'il n'y a rien de publié, elle ne réclame pas l'attention.
export function PublishedCard({ overview }: { overview: Overview }) {
  const n = overview.published30Days;
  return (
    <div role="group" aria-labelledby="carte-publies" className={cn("rounded-xl border p-6", n > 0 ? "border-border bg-card" : "border-dashed border-border")}>
      <h2 id="carte-publies" className="text-[13px] font-medium text-muted-foreground">
        Publiés · 30 derniers jours
      </h2>
      <p className={cn("mt-3", BIG)}>{n > 0 ? n : "—"}</p>
      <p className="mt-2 text-[15px] text-muted-foreground">{n > 0 ? plural(n, "post publié", "posts publiés") + "." : "Les chiffres apparaîtront après la première publication."}</p>
    </div>
  );
}
