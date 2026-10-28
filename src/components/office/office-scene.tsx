import Image from "next/image";
import Link from "next/link";

import { DOT, StatusDot } from "@/components/agents/status-dot";
import { pixelFont } from "@/components/office/pixel-font";
import { AGENTS, type AgentId, type AgentStatus, STATUS_LABEL } from "@/lib/agents";
import { cn } from "@/lib/utils";

import atelier from "../../../public/office/atelier.json";

const BG_SIZES = "(min-width: 1024px) 50vw, 100vw";

type Props = {
  // « jour » / « nuit » : décor fixe. « auto » : suit le thème de l'utilisateur (les deux images sont dans la page,
  // le CSS affiche la bonne : pas d'erreur d'hydratation, pas d'image qui saute).
  theme: "jour" | "nuit" | "auto";
  // L'état de chaque agent ; ceux qu'on ne précise pas sont au repos.
  statuses?: Partial<Record<AgentId, AgentStatus>>;
  // Décoratif (page de connexion) : une simple image, sans étiquettes ni liste.
  decorative?: boolean;
  // Si fourni, chaque agent devient un lien vers cette adresse (chapitre 8 : ouvre sa conversation). Sans lui, la scène
  // reste une simple image que les lecteurs d'écran remplacent par la liste.
  agentHref?: (id: AgentId) => string;
  className?: string;
};

// Le bureau isométrique avec les agents à leur poste. Positions lues dans atelier.json, en % de l'image :
// elles restent justes quelle que soit la taille de l'écran.
export function OfficeScene({ theme, statuses = {}, decorative = false, agentHref, className }: Props) {
  // Léger assombrissement des personnages la nuit, pour qu'ils baignent dans la lumière de la pièce (DESIGN.md).
  const dim = theme === "nuit" ? "brightness-[.82]" : theme === "auto" ? "dark:brightness-[.82]" : "";
  const bgClass = "object-cover [image-rendering:pixelated]";

  return (
    // @container : la taille des éléments dépend de la largeur de CE bloc (colonne de la page, carte…), pas de l'écran.
    <div className={cn("@container", className)}>
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: atelier.aspectRatio }}
        role={decorative ? "img" : undefined}
        aria-label={decorative ? `Le bureau des agents, ${theme === "nuit" ? "de nuit" : "de jour"}, avec ${atelier.seats.length} agents à leur poste` : undefined}
        // Informatif : l'image et les étiquettes sont cachées aux lecteurs d'écran, la liste ci-dessous les remplace.
        // Interactif : les étiquettes sont de vrais liens, la scène ne peut donc plus être cachée (un lien focalisable ne doit
        // jamais être dans une zone aria-hidden).
        aria-hidden={decorative || agentHref ? undefined : true}
      >
        {/* loading="eager" : une image paresseuse dans une zone cachée (l'autre thème) ne se chargerait qu'à l'affichage.
            unoptimized : c'est de l'art en pixels calé sur une grille (47 Ko). L'optimiseur de Next le réduirait à une
            largeur qui n'est pas un multiple entier (640 px pour 1376), ce qui floute la grille, et ajouterait un
            aller-retour au serveur : le décor arrivait après les personnages sur téléphone. Servi tel quel, le navigateur
            l'agrandit proprement (image-rendering: pixelated). */}
        {(theme === "jour" || theme === "auto") && (
          <Image src={atelier.background.jour} alt="" fill sizes={BG_SIZES} loading="eager" unoptimized className={cn(bgClass, theme === "auto" && "dark:hidden")} />
        )}
        {(theme === "nuit" || theme === "auto") && (
          <Image src={atelier.background.nuit} alt="" fill sizes={BG_SIZES} loading="eager" unoptimized className={cn(bgClass, theme === "auto" && "hidden dark:block")} />
        )}

        {atelier.seats.map((seat) => {
          const agent = AGENTS.find((a) => a.id === seat.agent);
          if (!agent) return null; // un poste sans agent déclaré dans agents.ts n'est pas dessiné
          const status = statuses[agent.id] ?? "idle";
          return (
            <div
              key={seat.agent}
              data-agent={agent.id}
              className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1"
              style={{ left: `${seat.x}%`, top: `${seat.y}%`, width: `${seat.width}%` }}
            >
              {!decorative && (
                // Étiquette : masquée quand la scène est trop étroite (les noms se chevaucheraient) ; la liste visible en
                // dessous prend alors le relais. Fond toujours sombre pour rester lisible sur le décor de jour comme de nuit.
                // MINUSCULES et SANS LIGATURES, mesuré sur capture : en capitales, la police pixel dessine le C comme un O
                // (« REOHEROHE ») à toutes les tailles de 11 à 18 px ; et sa ligature « fi » se dessine comme un « A »
                // (« planiAcateur »). Limite connue : son « î » perd l'accent (« maitre »).
                <PillWrapper
                  href={agentHref?.(agent.id)}
                  agentId={agent.id}
                  label={`${agent.name} : ${STATUS_LABEL[status].toLowerCase()}. Ouvrir la conversation`}
                  className={cn(
                    pixelFont.className,
                    "hidden items-center gap-1.5 rounded-full border border-nuit-secondaire/40 bg-nuit-fond px-2 py-1 text-[13px] leading-none font-semibold whitespace-nowrap text-nuit-encre lowercase [font-variant-ligatures:none] @lg:flex @2xl:text-[14px]",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", DOT[status])} />
                  {agent.name}
                </PillWrapper>
              )}
              <CharacterWrapper href={agentHref?.(agent.id)}>
              <Image
                // « working » est l'image animée (deux images alternées en CSS, qui respecte prefers-reduced-motion)
                src={`/agents/${agent.id}-${status === "working" ? "working" : "idle"}.svg`}
                alt=""
                width={32}
                height={32}
                unoptimized
                className={cn("block h-auto w-full [image-rendering:pixelated]", dim)}
              />
              </CharacterWrapper>
            </div>
          );
        })}
      </div>

      {!decorative && (
        // La liste des agents et de leur état : lue par les lecteurs d'écran, et VISIBLE quand la scène est trop étroite
        // pour afficher les étiquettes (sous 32 rem, soit 512 px, de large). @lg:sr-only la cache à l'œil au-delà, sans la retirer. Le seuil a été mesuré : à 448 px, les
        // étiquettes « planificateur » et « analytique » se recouvraient.
        <ul aria-label="L’équipe d’agents" className={cn("mt-3 grid gap-1.5 text-[14px]", agentHref ? "@lg:hidden" : "@lg:sr-only")}>
          {AGENTS.map((agent) => {
            const status = statuses[agent.id] ?? "idle";
            return (
              <li key={agent.id}>
                {agentHref ? (
                  <Link
                    href={agentHref(agent.id)}
                    scroll={false}
                    data-agent-link={agent.id}
                    className="flex min-h-11 items-center gap-2 rounded-md px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    <StatusDot status={status} />
                    <span>
                      <span className="font-semibold">{agent.name}</span> : {STATUS_LABEL[status].toLowerCase()}
                      <span className="sr-only">. Ouvrir la conversation</span>
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2">
                    <StatusDot status={status} />
                    <span>
                      <span className="font-semibold">{agent.name}</span> : {STATUS_LABEL[status].toLowerCase()}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// L'étiquette d'un agent : un simple bloc, ou un lien quand la scène est interactive. Elle passe AU-DESSUS des personnages
// (z-20) : les étiquettes larges (« planificateur », « analytique ») recouvrent les personnages voisins, et un clic sur une
// étiquette doit toujours ouvrir l'agent qu'elle nomme (mesuré : sinon, le centre de Recherche ouvrait Planificateur).
function PillWrapper({ href, agentId, label, className, children }: { href?: string; agentId: AgentId; label: string; className: string; children: React.ReactNode }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link
      href={href}
      scroll={false}
      data-agent-link={agentId}
      aria-label={label}
      className={cn(className, "relative z-20 min-h-7 focus-visible:ring-2 focus-visible:ring-nuit-encre focus-visible:ring-offset-2 focus-visible:ring-offset-nuit-fond focus-visible:outline-none")}
    >
      {children}
    </Link>
  );
}

// Le personnage lui-même : cliquable à la souris, mais PAS pour le clavier ni les lecteurs d'écran (l'étiquette est déjà le
// lien : deux liens vers la même page pour chaque agent seraient un doublon). aria-hidden + tabIndex -1 : zone de confort
// pour la souris seulement. Sous 512 px, où l'étiquette est cachée, le personnage reste un raccourci pour le doigt
// et la liste en dessous fournit les vrais liens.
function CharacterWrapper({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} scroll={false} tabIndex={-1} aria-hidden="true" className="relative z-10 block w-full">
      {children}
    </Link>
  );
}
