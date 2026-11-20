import type { Block, Locale, Partner } from "./api/types";

/**
 * Read together (02-ux-concept 4.2): which second language to show, and how two renderings of the same document are
 * lined up block by block. Layout only: nothing here creates or changes wording.
 */

/**
 * The second language, in the spec's order: the OTHER member's language if it differs from the page locale; else the
 * viewer's own member language if it differs; else none (the page then offers "Add a language"). A missing language
 * (an older API) is never guessed.
 */
export function secondLocale(input: { pageLocale: Locale; partners: readonly Partner[]; viewerPersonId: string | null }): Locale | null {
  const other = input.partners.find((p) => p.person_id !== input.viewerPersonId)?.language;
  if (other !== undefined && other !== input.pageLocale) return other;
  const own = input.partners.find((p) => p.person_id === input.viewerPersonId)?.language;
  if (own !== undefined && own !== input.pageLocale) return own;
  return null;
}

export interface BlockPair {
  primary: Block;
  secondary: Block;
}

export interface PairedBlocks {
  /** Blocks that line up one for one: same position, same kind. */
  pairs: BlockPair[];
  /** True when every block of both lists was paired. */
  aligned: boolean;
  /** Where pairing stopped: each language's remaining blocks, each shown in full (never guessed into pairs). */
  restPrimary: Block[];
  restSecondary: Block[];
}

/**
 * Pairs `primary[i]` with `secondary[i]` while the kinds match. At the first position where the kinds differ or one
 * list ends, pairing stops and the remainder of each list is returned as is, so the page can show "not aligned" and
 * stack the rest. Both renderings come from the same templates, so this is the normal path; the stop is the safe
 * fallback (a missing template in one language, a localised extra block) and never a guess.
 */
export function pairBlocks(primary: readonly Block[], secondary: readonly Block[]): PairedBlocks {
  const pairs: BlockPair[] = [];
  const limit = Math.min(primary.length, secondary.length);
  let index = 0;
  while (index < limit) {
    const a = primary[index];
    const b = secondary[index];
    if (a === undefined || b === undefined || a.kind !== b.kind) break;
    pairs.push({ primary: a, secondary: b });
    index += 1;
  }
  const restPrimary = primary.slice(index);
  const restSecondary = secondary.slice(index);
  return { pairs, aligned: restPrimary.length === 0 && restSecondary.length === 0, restPrimary, restSecondary };
}
