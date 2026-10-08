import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { optionLabelKey, type RequestOption } from '@/features/service-requests/service-request-options';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

type Props = {
  options: readonly RequestOption[];
  /** The translation group: labels are `serviceRequests.options.<group>.<id>`. */
  group: string;
  selected: readonly string[];
  onToggle: (id: string) => void;
  /** Several may be chosen (checkboxes) rather than one (radio buttons). */
  multiple?: boolean;
};

/**
 * A two-column grid of tappable choices for the request forms.
 *
 * Compact tiles rather than Design My Space's full-width choice cards: these
 * lists run to eight options with no descriptions, and a grid keeps a whole
 * step on one screen. Same tokens as those cards — marble fill and a brand
 * border when selected — so the two read as one design language.
 */
export default function ChoiceGrid({ options, group, selected, onToggle, multiple = false }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { row, textAlign } = useDirection();

  return (
    <View style={[styles.grid, { flexDirection: row }]}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <Pressable
            key={option.id}
            onPress={() => onToggle(option.id)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={multiple ? { checked: isSelected } : { selected: isSelected }}
            accessibilityLabel={t(optionLabelKey(group, option.id))}
            style={({ pressed }) => [
              styles.tile,
              { flexDirection: row },
              isSelected && styles.tileSelected,
              pressed && !isSelected && styles.tilePressed,
            ]}>
            <Ionicons
              name={isSelected && multiple ? 'checkmark-circle' : option.icon}
              size={20}
              color={isSelected ? theme.primaryInk : theme.textMuted}
            />
            <Text style={[styles.label, isSelected && styles.labelSelected, { textAlign }]}>
              {t(optionLabelKey(group, option.id))}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    /** `48%` so two fit any width with the gap between; long German labels wrap. */
    tile: {
      width: '48%',
      minHeight: 52,
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    tileSelected: { borderColor: theme.primaryInk, backgroundColor: theme.marble },
    tilePressed: { backgroundColor: theme.marble },
    label: {
      flex: 1,
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      color: theme.text,
    },
    labelSelected: { fontFamily: FontFamily.bodySemiBold },
  });
