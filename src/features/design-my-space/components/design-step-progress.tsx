import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import { useLanguage } from '@/features/localization/language-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * "Step 3 of 6", plus a segment for each step.
 *
 * Deliberately not a package: it is a row of Views and one line of text, and
 * the app has no progress component to reuse. Written so the Renovation
 * planner can use it unchanged — it knows nothing about design boards.
 *
 * Accessibility: the segments are decorative, so the whole row is one
 * `progressbar` node carrying the same sentence a sighted user reads. Progress
 * is never communicated by the bar alone.
 */

type Props = {
  /** 1-based, so it reads the way it is spoken. */
  current: number;
  total: number;
};

export default function DesignStepProgress({ current, total }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const { row, textAlign } = useDirection();

  // `t` interpolates strings; the numbers are for the accessibility value.
  const label = t('designMySpace.stepProgress', { current: String(current), total: String(total) });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: current, text: label }}>
      <Text style={[styles.label, { textAlign }]}>{label}</Text>

      {/* Follows reading order, so step one sits at the reading edge. */}
      <View style={[styles.track, { flexDirection: row }]} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, index) => (
          <View key={index} style={[styles.segment, index < current && styles.segmentDone]} />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textMuted,
  },
  track: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: theme.border,
  },
  segmentDone: { backgroundColor: theme.primaryInk },
});
