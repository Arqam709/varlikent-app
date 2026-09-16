import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * One material: its texture photograph if it has a usable one, its colour if
 * not, its name, and whether it is chosen.
 *
 * ── Multi-select ────────────────────────────────────────────────────────
 * Materials are the one step where several answers are valid — and where NO
 * answer is also valid. `checkbox` says exactly that to a screen reader, in
 * contrast to the `radio` used by every other step.
 *
 * ── Images never remove an option ───────────────────────────────────────
 * An admin can attach a texture URL to a material. If it fails to load, the
 * material falls back to its flat colour and stays selectable; losing a
 * material because its photograph 404'd would be a worse outcome than showing
 * it plainly. `expo-image` is already a dependency — no new image library.
 */

type Props = {
  /** The palette's own name. English — Studio Palette stores no translations. */
  name: string;
  color: string;
  /** '' when the material has no usable remote texture. */
  image?: string;
  selected: boolean;
  onPress: () => void;
};

export default function DesignMaterialChoice({ name, color, image, selected, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { row, textAlign } = useDirection();
  const [failed, setFailed] = useState(false);

  const showImage = !!image && !failed;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={name}
      style={({ pressed }) => [
        styles.option,
        { flexDirection: row },
        selected && styles.optionSelected,
        pressed && styles.optionPressed,
      ]}>
      {/* The colour sits underneath, so a slow image never shows a hole. */}
      <View style={[styles.thumb, { backgroundColor: color }]}>
        {showImage ? (
          <Image
            source={{ uri: image }}
            style={styles.thumbImage}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('designMySpace.materialImageA11y', { name })}
            onError={() => setFailed(true)}
          />
        ) : null}
      </View>

      <Text style={[styles.name, { textAlign }]} numberOfLines={2}>
        {name}
      </Text>

      <Ionicons
        name={selected ? 'checkbox' : 'square-outline'}
        size={22}
        color={selected ? theme.primaryInk : theme.textMuted}
      />
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

  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },

  name: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
});
