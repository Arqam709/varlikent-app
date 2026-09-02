import { useMemo } from 'react';

import { useLanguage } from './language-context';

/**
 * THE DIRECTION-DEPENDENT VALUES THIS APP ACTUALLY REPEATS.
 *
 * ── Why this exists ─────────────────────────────────────────────────────
 * Native layout direction is pinned LTR (`I18nManager.allowRTL(false)` in
 * language-context.tsx), which is a deliberate choice: it means switching
 * language never needs a restart. The cost is that RTL is not automatic —
 * every row, every text block and every directional icon has to state its own
 * direction. Counted across `src/` before this hook existed:
 *
 *     flexDirection: isRTL ? 'row-reverse' : 'row'      29 occurrences
 *     textAlign:     isRTL ? 'right' : 'left'           36 occurrences
 *     isRTL ? 'chevron-forward' : 'chevron-back'         9 occurrences
 *     isRTL ? 'chevron-back' : 'chevron-forward'         2 occurrences
 *     isRTL ? 'arrow-back' : 'arrow-forward'             2 occurrences
 *
 * Every one of those is the same decision written out again, and every one is
 * a place a future screen can silently forget Arabic and Urdu. This hook is
 * the decision made once.
 *
 * ── What it deliberately is NOT ─────────────────────────────────────────
 * Not a layout system. It returns VALUES, not styles and not components, so a
 * screen still writes its own StyleSheet and still reads plainly:
 *
 *     const { row, textAlign } = useDirection();
 *     <View style={[styles.card, { flexDirection: row }]}>
 *
 * There is no `rowReverse`, no `start`/`end` padding helper and no writing
 * direction — nothing in the app repeats those, and adding them would be
 * inventing an abstraction rather than extracting one.
 *
 * `useLanguage()` remains the single source of truth for direction; `isRTL` is
 * re-exported here only so a caller never needs both hooks for one row.
 */

/** The three directional icon meanings the app actually uses. */
type BackIcon = 'chevron-back' | 'chevron-forward';
type ForwardIcon = 'chevron-forward' | 'chevron-back';
type OnwardIcon = 'arrow-forward' | 'arrow-back';

export type Direction = {
  /** True for Arabic and Urdu. Straight from the language registry. */
  isRTL: boolean;
  /** For `flexDirection` on a row that should follow reading order. */
  row: 'row' | 'row-reverse';
  /** For `textAlign` on text that should start at the reading edge. */
  textAlign: 'left' | 'right';
  /**
   * The chevron on a BACK control — it points back the way you came, which is
   * the trailing edge in Arabic.
   */
  backIcon: BackIcon;
  /**
   * The disclosure chevron on a navigating row — it points the way navigation
   * actually goes, which is left in Arabic.
   */
  forwardIcon: ForwardIcon;
  /** The "continue / read on" arrow, e.g. beside an Explore link. */
  onwardIcon: OnwardIcon;
};

/**
 * Reads the active language's direction and returns the values that depend on
 * it.
 *
 * Memoised on `isRTL` alone, so the returned object keeps a stable identity
 * between renders and can be destructured into a dependency array without
 * causing an effect to re-run on every keystroke.
 */
export function useDirection(): Direction {
  const { isRTL } = useLanguage();

  return useMemo<Direction>(
    () => ({
      isRTL,
      row: isRTL ? 'row-reverse' : 'row',
      textAlign: isRTL ? 'right' : 'left',
      backIcon: isRTL ? 'chevron-forward' : 'chevron-back',
      forwardIcon: isRTL ? 'chevron-back' : 'chevron-forward',
      onwardIcon: isRTL ? 'arrow-back' : 'arrow-forward',
    }),
    [isRTL]
  );
}
