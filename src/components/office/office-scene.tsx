import Image from "next/image";

import { pixelFont } from "@/components/office/pixel-font";
import { AGENTS, type AgentId, type AgentStatus, STATUS_LABEL } from "@/lib/agents";
import { cn } from "@/lib/utils";

import atelier from "../../../public/office/atelier.json";

// Pastille d'état (DESIGN.md) : gris = au repos, jaune « signal » qui respire = en cours, vert = terminé, rouge = bloqué.
// La couleur n'est jamais seule : le texte de l'état est toujours donné (liste ci-dessous et pour les lecteurs d'écran).
const DOT: Record<AgentStatus, string> = {
  idle: "bg-inactive",
  working: "bg-signal motion-safe:animate-pulse",
  done: "bg-success",
  blocked: "bg-destructive",
};

const BG_SIZES = "(min-width: 1024px) 50vw, 100vw";

type Props = {
  // « jour » / « nuit » : décor fixe. « auto » : suit le thème de l'utilisateur (les deux images sont dans la page,
  // le CSS affiche la bonne : pas d'erreur d'hydratation, pas d'image qui saute).
  theme: "jour" | "nuit" | "auto";
  // L'état de chaque agent ; ceux qu'on ne précise pas sont au repos.
  statuses?: Partial<Record<AgentId, AgentStatus>>;
  // Décoratif (page de connexion) : une simple image, sans étiquettes ni liste.
  decorative?: boolean;
  className?: string;
};

// Le bureau isométrique avec les agents à leur poste. Positions lues dans atelier.json, en % de l'image :
// elles restent justes quelle que soit la taille de l'écran.
export function OfficeScene({ theme, statuses = {}, decorative = false, className }: Props) {
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
        aria-hidden={decorative ? undefined : true}
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
                <span
                  className={cn(
                    pixelFont.className,
                    "hidden items-center gap-1.5 rounded-full border border-nuit-secondaire/40 bg-nuit-fond px-2 py-1 text-[13px] leading-none font-semibold whitespace-nowrap text-nuit-encre lowercase [font-variant-ligatures:none] @lg:flex @2xl:text-[14px]",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", DOT[status])} />
                  {agent.name}
                </span>
              )}
              <Image
                // « working » est l'image animée (deux images alternées en CSS, qui respecte prefers-reduced-motion)
                src={`/agents/${agent.id}-${status === "working" ? "working" : "idle"}.svg`}
                alt=""
                width={32}
                height={32}
                unoptimized
                className={cn("block h-auto w-full [image-rendering:pixelated]", dim)}
              />
            </div>
          );
        })}
      </div>

      {!decorative && (
        // La liste des agents et de leur état : lue par les lecteurs d'écran, et VISIBLE quand la scène est trop étroite
        // pour afficher les étiquettes (sous 32 rem, soit 512 px, de large). @lg:sr-only la cache à l'œil au-delà, sans la retirer. Le seuil a été mesuré : à 448 px, les
        // étiquettes « planificateur » et « analytique » se recouvraient.
        <ul aria-label="L’équipe d’agents" className="mt-3 grid gap-1.5 text-[14px] @lg:sr-only">
          {AGENTS.map((agent) => {
            const status = statuses[agent.id] ?? "idle";
            return (
              <li key={agent.id} className="flex items-center gap-2">
                <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", DOT[status])} />
                <span>
                  <span className="font-semibold">{agent.name}</span> : {STATUS_LABEL[status].toLowerCase()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
