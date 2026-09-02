import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

type Props = {
  /** Already translated. Truncated to one line rather than wrapping the row. */
  title: string;
  
  onBack: () => void;
  
  subtitle?: string;
  
  right?: ReactNode;

  titleFont?: 'body' | 'heading';
};

export default function ScreenHeader({
  title,
  onBack,
  subtitle,
  right,
  titleFont = 'body',
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { row, textAlign, backIcon } = useDirection();

  return (
    <View style={[styles.header, { flexDirection: row }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={10}
        style={styles.backButton}>
        {/* Directional: back points the way you came, which flips in Arabic. */}
        <Ionicons name={backIcon} size={22} color={theme.text} />
      </Pressable>

     
      <View style={styles.headerText}>
        <Text style={[styles.title, titleFont === 'heading' && styles.titleHeading, { textAlign }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { textAlign }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  /**
   * Values carried over unchanged from the nine implementations this replaces,
   * all of which already agreed on them exactly.
   */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { padding: Spacing.xs },
  headerText: { flex: 1 },
  title: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  /** Cinzel, for the account section. See the `titleFont` note above. */
  titleHeading: {
    fontFamily: FontFamily.headingSemiBold,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
});
