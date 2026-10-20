// Stable URLs avoid restarting activities on every update. Photo licenses: /credits.
export const portraits: Record<string, string> = {
  "Olivia Chow": "/candidates/olivia-chow.webp",
  "Brad Bradford": "/candidates/brad-bradford.webp",
  "David West": "/candidates/david-west.webp",
  "Domenic Bardari": "/candidates/domenic-bardari.webp",
  "Holo Devnani": "/candidates/holo-devnani.webp",
};
// Fallback roster from the official mayor / ward 0 feed, checked October 20, 2026.
// https://mediaresults.toronto.ca/results/unofficialresult.json
// A saved feed snapshot takes precedence in the dialog.
export const TORONTO_CANDIDATES = [
  "Imad Abdulkadir",
  "Bahira Abdulsalam",
  "Chris Alexander",
  "Jamie Atkinson",
  "Brad Bradford",
  "Darrell Brown",
  "Brian Buffey",
  "Braeden Chow",
  "Olivia Chow",
  "Logan Choy",
  "Kevin Clarke",
  "Paul Collins",
  "Alex Cruze",
  "Roberto Curto",
  "Laura Dean",
  "Habiba Desai",
  "Cory Deville",
  "Wincess Dorville",
  "Laura Ellis",
  "Martin Fraser",
  "Alton Frederick",
  "Edward Gong",
  "Faizan Haider",
  "Thomas Hall",
  "Peter Handjis",
  "Jack Hartley",
  "Heather He",
  "Mohamad Kaaki",
  "Georgios Kalkounis",
  "Isidoros Kyrlangitses",
  "Michael Lamoureux",
  "Rick Lee",
  "Reagan Levermany",
  "Eddie Mayanja",
  "Sarah McVie",
  "Francis Mercieca",
  "Joseph Osuji",
  "Odessa Paloma Parker",
  "Gus Prokos",
  "Faisal Razi",
  "Amy Rosen",
  "Lyall Sanders",
  "Naomi Sayers",
  "Robert Shusterman",
  "Sandeep Srivastava",
  "Weizhen Tang",
  "Joshua Thompson",
  "Kuo Yu Tong",
  "Jeffery Tunney",
  "Jack Weenen",
  "Henoke Yohannes",
  "Leila Yohannes",
  "Mostafa Zandkarimi",
] as const;
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
