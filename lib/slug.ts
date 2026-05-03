/**
 * slug — lower-cased, hyphen-separated, ASCII-only. Used for anchor IDs on
 * Experience and Projects entries so individual cards are deep-linkable
 * (e.g. /#exp-avx-aircraft-company, /#proj-rot-dot).
 */
export function slug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
