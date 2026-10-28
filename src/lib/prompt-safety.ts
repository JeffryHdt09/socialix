// Filtre contre l'injection de consignes (idée reprise d'Hermes Agent). Il sert pour tout texte qui va ENTRER dans le prompt
// d'un agent sans avoir été écrit par nous : mémoire de projet, page web lue par le Chercheur, contenu d'un fichier.
// Fonction pure (aucun accès réseau ni base) : elle se teste seule.
//
// Honnêteté : c'est un garde-fou par motifs, pas une preuve. Il attrape les attaques courantes, pas les tournures inédites.
// Il s'ajoute aux vraies protections (outils autorisés par agent, confirmation avant action visible) et ne les remplace pas.

export type ScanResult = { safe: true } | { safe: false; reasons: string[] };

// Caractères invisibles : ils permettent de cacher une consigne que la personne ne voit pas à l'écran
// (espaces de largeur nulle, marques de sens d'écriture, séparateurs invisibles, « tags » Unicode).
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]|[\u{E0000}-\u{E007F}]/u;

const RULES: { reason: string; pattern: RegExp }[] = [
  { reason: "demande d'ignorer les consignes précédentes", pattern: /\b(ignore|ignorez|oublie|oubliez|disregard|forget)\b[^.\n]{0,40}\b(instructions?|consignes?|r[èe]gles?|rules?|prompts?)\b/i },
  { reason: "tentative de changer le rôle de l'agent", pattern: /\b(tu es (maintenant|d[ée]sormais)|you are now|act as if you (have|had) no|fais semblant d'[êe]tre)\b/i },
  { reason: "demande de révéler les consignes internes", pattern: /\b(r[ée]v[èe]le|affiche|montre|donne|repeat|reveal|show|print)\b[^.\n]{0,40}\b(system prompt|prompt syst[èe]me|consignes? (internes?|syst[èe]me)|instructions? (internes?|syst[èe]me))\b/i },
  { reason: "fausse balise de rôle système", pattern: /(^|\n)\s*(system|assistant)\s*:|<\s*\/?\s*(system|instructions?)\s*>|\[\s*(INST|SYSTEM)\s*\]/i },
  { reason: "demande d'envoyer des identifiants ou des secrets", pattern: /\b(envoie|envoyez|exfiltre|transmets|send|post|upload|leak)\b[^.\n]{0,60}\b(mots? de passe|password|api[_ -]?key|cl[ée]s? (api|secr[èe]te)|token|secret|cookie|\.env)\b/i },
  { reason: "commande réseau cachée dans le texte", pattern: /\b(curl|wget)\b[^\n]{0,80}https?:\/\//i },
];

export function scanForInjection(text: string): ScanResult {
  const reasons: string[] = [];
  if (INVISIBLE.test(text)) reasons.push("caractères invisibles");
  for (const { reason, pattern } of RULES) if (pattern.test(text)) reasons.push(reason);
  return reasons.length === 0 ? { safe: true } : { safe: false, reasons };
}
