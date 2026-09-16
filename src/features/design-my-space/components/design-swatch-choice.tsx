import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * One wall or floor finish: the colour, its name, and whether it is chosen.
 *
 * ── A swatch is never only a colour ─────────────────────────────────────
 * The name is always rendered beside it, and the accessibility label is the
 * name — not the hex. Someone who cannot distinguish Sage from Slate Blue, or
 * who is listening rather than looking, gets the same information either way.
 * The colour is decoration on top of a label, not the label itself.
 *
 * The swatch keeps a hairline border so pale finishes (Ivory, Linen White)
 * stay visible on the app's light themes.
 */

type Props = {
  /** The palette's own name. English — Studio Palette stores no translations. */
  label: string;
  /** `#RRGGBB`, straight from the palette. The one place business colour wins. */
  color: string;
  selected: boolean;
  onPress: () => void;
};

export default function DesignSwatchChoice({ label, color, selected, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign } = useDirection();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.option,
        { flexDirection: row },
        selected && styles.optionSelected,
        pressed && styles.optionPressed,
      ]}>
      <View style={[styles.swatch, { backgroundColor: color }]} />

      <Text style={[styles.label, { textAlign }]} numberOfLines={2}>
        {label}
      </Text>

      {selected ? <Ionicons name="checkmark-circle" size={22} color={theme.primaryInk} /> : null}
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
    minHeight: 56,
  },
  optionSelected: { borderColor: theme.primaryInk, backgroundColor: theme.marble },
  optionPressed: { backgroundColor: theme.marble },

  swatch: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    // Keeps a near-white finish from disappearing into a near-white card.
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
});
