import { Fragment } from "react";

// Met en forme la réponse d'un agent. Les modèles répondent en Markdown (**gras**, listes à puces) : afficher le texte brut
// montrerait des astérisques. On ne gère volontairement que le strict nécessaire (paragraphes, gras, puces, titres simples)
// et on construit des ÉLÉMENTS React, jamais du HTML : une réponse ne peut donc pas injecter de code dans la page.

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
        part.length > 4 && part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

const BULLET = /^\s*[*-]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

export function FormattedText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length > 0) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="ml-5 list-disc space-y-1">
          {bullets.map((b, i) => (
            <li key={i}>
              <Inline text={b} />
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const line of text.split("\n")) {
    const bullet = BULLET.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim() === "") continue;
    const heading = HEADING.exec(line);
    blocks.push(
      <p key={`p${blocks.length}`} className={heading ? "font-semibold" : undefined}>
        <Inline text={heading ? heading[1] : line} />
      </p>,
    );
  }
  flush();
  return <div className="space-y-2 break-words">{blocks}</div>;
}
