import type { City, SourceValidators } from "./types";
import { fetchToronto } from "./toronto";
import { fetchRichmondHill } from "./richmond-hill";

export function fetchResults(city: City, validators: SourceValidators = {}) {
  return city === "toronto"
    ? fetchToronto(validators)
    : fetchRichmondHill(validators);
}
