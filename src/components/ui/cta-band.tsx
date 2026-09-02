import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import Button from '@/components/ui/button';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';



type Props = {
  /** Already translated. The small tracked-out label above the heading. */
  eyebrow?: string;
  /** Already translated. The Cinzel line. */
  heading: string;
  /** Already translated. One or two lines explaining the offer. */
  body: string;
  /** Already translated. Set in caps by Button, so keep it short. */
  ctaLabel: string;
  onPress: () => void;
  /**
   * Announced after the label, e.g. naming the destination and what arriving
   * there will already have filled in.
   *
   * A hint rather than a replacement label: the label is the visible words,
   * which is what a screen-reader user hears others refer to, and overriding it
   * would make the two disagree.
   */
  accessibilityHint?: string;
  /** Layout only — padding and margins belong to the screen. */
  style?: StyleProp<ViewStyle>;
};

export default function CTABand({
  eyebrow,
  heading,
  body,
  ctaLabel,
  onPress,
  accessibilityHint,
  style,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();

  return (
    <View style={style}>
      
      <View style={styles.card}>
        <SectionHeader eyebrow={eyebrow} title={heading} />

        <Text style={[styles.body, { textAlign }]}>{body}</Text>

        <Button
          label={ctaLabel}
          variant="primary"
          onPress={onPress}
          accessibilityHint={accessibilityHint}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  card: {
    backgroundColor: theme.marble,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: Spacing.lg,
  },
});
