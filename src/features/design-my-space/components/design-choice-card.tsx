import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * One single-select option: icon, label, a line of explanation, and a tick.
 *
 * Used for rooms, styles and lighting moods — the three app-owned
 * vocabularies. Palette colours get their own components, because a swatch is
 * a different thing from an icon.
 *
 * `radio` rather than `button`, because these live in a group where exactly
 * one choice is active; a screen reader then announces both the selection and
 * that selecting one deselects the rest.
 */

type Props = {
  /** Already translated. */
  label: string;
  /** Already translated. Optional second line. */
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
};

export default function DesignChoiceCard({ label, description, icon, selected, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign } = useDirection();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={description}
      style={({ pressed }) => [
        styles.card,
        { flexDirection: row },
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}>
      <View style={[styles.icon, selected && styles.iconSelected]}>
        <Ionicons name={icon} size={20} color={selected ? theme.primaryText : theme.primaryInk} />
      </View>

      <View style={styles.text}>
        <Text style={[styles.label, { textAlign }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { textAlign }]}>{description}</Text>
        ) : null}
      </View>

      {/*
        The tick repeats what the border and background already say. Selection
        is never carried by colour alone — it is shape, and it is announced.
      */}
      {selected ? <Ionicons name="checkmark-circle" size={22} color={theme.primaryInk} /> : null}
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
    // Comfortably above the 48dp minimum touch target.
    minHeight: 64,
  },
  cardSelected: { borderColor: theme.primaryInk, backgroundColor: theme.marble },
  cardPressed: { backgroundColor: theme.marble },

  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.marble,
  },
  iconSelected: { backgroundColor: theme.primary },

  text: { flex: 1 },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  description: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.textMuted,
    marginTop: 2,
  },
});
