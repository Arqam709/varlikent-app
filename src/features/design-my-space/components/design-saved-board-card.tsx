import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import {
  DESIGN_ROOMS,
  DESIGN_STYLES,
  designOptionLabelKey,
} from '@/features/design-my-space/design-options';
import type { DesignBoard } from '@/features/design-my-space/design-board';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * One saved board in the Saved Designs list: room, style, the two finishes,
 * and a delete control.
 *
 * The card itself opens the board — the whole row is the target, rather than a
 * small "Open" link — and delete is a separate, clearly labelled control so
 * the destructive action can never be hit by aiming at the card.
 */

type Props = {
  board: DesignBoard;
  onOpen: () => void;
  onDelete: () => void;
};

export default function DesignSavedBoardCard({ board, onOpen, onDelete }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { row, textAlign, forwardIcon } = useDirection();

  const room = t(designOptionLabelKey(DESIGN_ROOMS, board.room));
  const style = t(designOptionLabelKey(DESIGN_STYLES, board.style));

  return (
    <View style={[styles.card, { flexDirection: row }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('designMySpace.openA11y', { name: room })}
        style={({ pressed }) => [styles.main, { flexDirection: row }, pressed && styles.pressed]}>
        <View style={styles.text}>
          <Text style={[styles.title, { textAlign }]}>{room}</Text>
          <Text style={[styles.subtitle, { textAlign }]}>{style}</Text>

          <View style={[styles.finishes, { flexDirection: row }]}>
            <View style={[styles.swatch, { backgroundColor: board.wall.color }]} />
            <View style={[styles.swatch, { backgroundColor: board.floor.color }]} />
            <Text style={[styles.finishText, { textAlign }]} numberOfLines={1}>
              {`${board.wall.label} · ${board.floor.label}`}
            </Text>
          </View>
        </View>

        <Ionicons name={forwardIcon} size={18} color={theme.textMuted} />
      </Pressable>

      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={t('designMySpace.deleteA11y', { name: room })}
        hitSlop={8}
        style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
        <Ionicons name="trash-outline" size={20} color={theme.danger} />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    minHeight: 72,
  },
  pressed: { backgroundColor: theme.marble },
  text: { flex: 1, gap: 2 },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.primaryInk,
  },
  finishes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  finishText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
  delete: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
});
