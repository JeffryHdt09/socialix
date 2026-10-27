import Image from "next/image";

import atelier from "../../../public/office/atelier.json";

// Le bureau isométrique avec les agents à leur poste.
// Positions lues dans atelier.json, en % de l'image : elles restent justes quelle que soit la taille.
export function OfficeScene({ theme, state = "idle" }: { theme: "jour" | "nuit"; state?: "idle" | "working" }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ aspectRatio: atelier.aspectRatio }}
      role="img"
      aria-label={`Le bureau des agents, ${theme === "nuit" ? "de nuit" : "de jour"}, avec ${atelier.seats.length} agents à leur poste`}
    >
      <Image
        src={atelier.background[theme]}
        alt=""
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover [image-rendering:pixelated]"
        priority
      />
      {atelier.seats.map((seat) => (
        <div
          key={seat.agent}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${seat.x}%`, top: `${seat.y}%`, width: `${seat.width}%` }}
        >
          <Image
            src={`/agents/${seat.agent}-${state}.svg`}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="block h-auto w-full [image-rendering:pixelated]"
          />
        </div>
      ))}
    </div>
  );
}
