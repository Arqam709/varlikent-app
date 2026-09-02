import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';


type Props = {
  /** Already translated. The Cinzel line. */
  title: string;
  /** Already translated. The small tracked-out label above the title. */
  eyebrow?: string;
  /**
   * `md` — a section within a screen (FontSizes.lg). The default.
   * `lg` — a screen's own opening block (FontSizes.xl).
   */
  size?: 'md' | 'lg';
  /**
   * `brand` — primaryInk eyebrow. The default.
   * `muted` — for a sub-section beneath a heading that is already brand-coloured.
   */
  tone?: 'brand' | 'muted';
  /** Renders the 56dp gold hairline beneath the heading. */
  rule?: boolean;
  /** Layout only — padding and margins belong to the screen, not here. */
  style?: StyleProp<ViewStyle>;
};

export default function SectionHeader({
  title,
  eyebrow,
  size = 'md',
  tone = 'brand',
  rule = false,
  style,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { textAlign, isRTL } = useDirection();

  return (
    <View style={style}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, tone === 'muted' && styles.eyebrowMuted, { textAlign }]}>
          {eyebrow}
        </Text>
      ) : null}

      <Text style={[styles.title, size === 'lg' && styles.titleLarge, { textAlign }]}>
        {title}
      </Text>

      {/*
        Decorative only, and deliberately never an action — gold is the brand's
        ornament colour, green is the action colour (see constants/theme.ts).
        A bare View with no text is already invisible to a screen reader, so it
        needs no explicit accessibility treatment.
      */}
      {rule ? (
        <View style={[styles.rule, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.primaryInk,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  eyebrowMuted: {
    color: theme.textMuted,
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginTop: Spacing.xs,
  },
  titleLarge: {
    fontSize: FontSizes.xl,
  },
  /**
   * 56 x 1, the width every existing gold rule in the app already uses.
   * `marginVertical: md` matches the Services index, the one screen that
   * currently renders a rule directly under its heading.
   *
   * `alignSelf` is applied inline rather than here because it is the one
   * direction-dependent value: a fixed-width box in a column defaults to the
   * LEFT edge, so without it the rule stayed pinned left while its heading
   * moved right in Arabic and Urdu.
   */
  rule: {
    width: 56,
    height: 1,
    backgroundColor: theme.gold,
    marginVertical: Spacing.md,
  },
});
