// Contrôle d'un logo de campagne, d'après les OCTETS reçus et non d'après ce que le navigateur annonce.
// Un fichier nommé « logo.png » avec le type « image/png » peut contenir autre chose : seul son contenu compte.
// Fichier volontairement sans dépendance, pour pouvoir le tester seul.

export const LOGO_MAX_BYTES = 3 * 1024 * 1024;
export const LOGO_ERROR = "3 Mo maximum, PNG, JPG ou WebP.";

// Formats acceptés. Le SVG est refusé exprès : c'est du texte qui peut contenir du code (XSS).
export const LOGO_FORMATS = {
  png: { contentType: "image/png", extension: "png" },
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  webp: { contentType: "image/webp", extension: "webp" },
} as const;
export type LogoFormat = keyof typeof LOGO_FORMATS;

export type LogoCheck =
  | { ok: true; format: LogoFormat; contentType: string; extension: string }
  | { ok: false; error: string };

const startsWith = (bytes: Uint8Array, offset: number, expected: readonly number[]) =>
  bytes.length >= offset + expected.length && expected.every((value, i) => bytes[offset + i] === value);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

// Reconnaît le format par sa « signature » : les premiers octets d'un vrai fichier image.
export function detectLogoFormat(bytes: Uint8Array): LogoFormat | null {
  // PNG : signature de 8 octets, puis le bloc IHDR (longueur 13) qui doit venir en premier.
  if (
    startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    startsWith(bytes, 8, [0x00, 0x00, 0x00, 0x0d, ...ascii("IHDR")])
  ) {
    return "png";
  }
  // JPEG : commence par FF D8 FF.
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return "jpeg";
  // WebP : « RIFF », 4 octets de taille, « WEBP », puis un bloc VP8 / VP8L / VP8X.
  if (
    startsWith(bytes, 0, ascii("RIFF")) &&
    startsWith(bytes, 8, ascii("WEBP")) &&
    (startsWith(bytes, 12, ascii("VP8 ")) || startsWith(bytes, 12, ascii("VP8L")) || startsWith(bytes, 12, ascii("VP8X")))
  ) {
    return "webp";
  }
  return null;
}

export function checkLogoBytes(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return { ok: false, error: LOGO_ERROR };
  const format = detectLogoFormat(bytes);
  if (!format) return { ok: false, error: LOGO_ERROR };
  return { ok: true, format, ...LOGO_FORMATS[format] };
}
