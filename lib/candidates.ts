// Stable URLs avoid restarting activities on every update. Photo licenses: /credits.
export const portraits: Record<string, string> = {
  "Olivia Chow": "/candidates/olivia-chow.webp",
  "Brad Bradford": "/candidates/brad-bradford.webp",
  "David West": "/candidates/david-west.webp",
  "Domenic Bardari": "/candidates/domenic-bardari.webp",
  "Holo Devnani": "/candidates/holo-devnani.webp",
};
export const RICHMOND_HILL_CANDIDATES = [
  "Domenic Bardari",
  "Holo Devnani",
  "David West",
] as const;
export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}
