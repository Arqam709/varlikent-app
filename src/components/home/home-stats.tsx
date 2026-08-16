import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Spacing } from '@/constants/theme';

/**
 * HOME STATS STRIP
 *
 * The four figures the website shows inside its hero. On mobile they sit
 * BELOW the hero instead: stacking them on top of the photograph would crowd
 * the headline and CTAs on a phone, and as a separate light band they also
 * bridge the dark hero into the light content that follows.
 *
 * Values are static brand/marketing figures copied from the website hero —
 * NOT live database counts. Nothing here calls the API.
 *
 * The website animates these with a CountUp on scroll. Deliberately not
 * reproduced yet: it needs scroll-position tracking to fire at the right
 * moment, and a number that animates every time you scroll past it gets
 * irritating fast. Final values render immediately.
 */

type Stat = {
  /** Displayed figure, e.g. "500+". */
  value: string;
  /** Displayed caption, e.g. "Properties". */
  label: string;
  /**
   * What a screen reader announces for the pair.
   *
   * Written out rather than derived, because "500+" is read as "500" (the
   * plus is dropped) and "98%" as "98 percent sign" by some engines. Spelling
   * it out keeps the meaning intact and costs one short string.
   */
  a11yLabel: string;
};

const STATS: Stat[] = [
  { value: '500+', label: 'Properties', a11yLabel: '500 plus properties' },
  { value: '10+', label: 'Years', a11yLabel: '10 plus years' },
  { value: '40+', label: 'Districts', a11yLabel: '40 plus districts' },
  { value: '98%', label: 'Satisfaction', a11yLabel: '98 percent satisfaction' },
];

export default function HomeStats() {
  return (
    <View style={styles.strip}>
      {STATS.map((stat) => (
        /**
         * `accessible` collapses the number and its caption into ONE
         * focusable element. Without it a screen reader stops on "500+" and
         * then separately on "Properties", which is two disconnected
         * fragments rather than one fact.
         */
        <View
          key={stat.label}
          style={styles.item}
          accessible
          accessibilityLabel={stat.a11yLabel}>
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    // Marble is a touch warmer than the page's softWhite, so the strip reads
    // as its own band without needing a card, shadow or border box.
    backgroundColor: Colors.marble,
    // Gold hairline on top only — the mobile stand-in for the website's
    // gold gradient section dividers, and it seals the hero's bottom edge.
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,163,90,0.35)',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  /**
   * `flex: 1` on every item divides the row into four equal columns whatever
   * the screen width — no hardcoded widths, and nothing to adjust per device.
   */
  item: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.charcoal,
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    /**
     * 10pt with restrained tracking is deliberate. "SATISFACTION" is the
     * widest label at twelve characters, and a quarter of a 360dp screen
     * leaves roughly 82dp — wider tracking would push that single word past
     * the column. It is allowed to wrap on unusually narrow devices rather
     * than being clipped.
     */
    fontSize: 10,
    letterSpacing: 0.6,
    lineHeight: 14,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
});
