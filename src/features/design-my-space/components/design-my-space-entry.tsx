import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * THE DOOR INTO DESIGN MY SPACE, on the Interior Design service page.
 *
 * ── Why it is here and nowhere else ─────────────────────────────────────
 * The service page explains what Varlikent does. This is the one thing on it
 * the USER does — so it is offered in context, at the point of interest,
 * rather than as a tab that would ask everyone to care about interior design
 * before they have read anything.
 *
 * Which service shows it is data, not a condition written into the screen:
 * `feature: 'design-my-space'` on the Interior Design entry in services-data.
 *
 * ── The copy is the app's own ───────────────────────────────────────────
 * Every string here is `t()`, never Page Content. This is a mobile feature the
 * website does not have, so describing it is not admin-managed content, and
 * putting it in the CMS would mean a website admin could rename or empty a
 * button that only exists in the app.
 */

export default function DesignMySpaceEntry() {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { row, textAlign, onwardIcon } = useDirection();
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => router.push('/design-my-space')}
        accessibilityRole="button"
        accessibilityLabel={t('designMySpace.entryCta')}
        accessibilityHint={t('designMySpace.entryA11y')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={[styles.head, { flexDirection: row }]}>
          <View style={styles.icon}>
            <Ionicons name="color-palette-outline" size={22} color={theme.primaryText} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.eyebrow, { textAlign }]}>{t('designMySpace.entryEyebrow')}</Text>
            <Text style={[styles.title, { textAlign }]}>{t('designMySpace.title')}</Text>
          </View>
        </View>

        <Text style={[styles.body, { textAlign }]}>{t('designMySpace.entryBody')}</Text>

        <View style={[styles.cta, { flexDirection: row }]}>
          <Text style={styles.ctaLabel}>{t('designMySpace.entryCta')}</Text>
          <Ionicons name={onwardIcon} size={16} color={theme.primaryInk} />
        </View>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  /** Sits directly under the hero, so it takes the tighter gap, not a section's. */
  wrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  card: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.primaryInk,
    backgroundColor: theme.marble,
  },
  pressed: { backgroundColor: theme.cardBg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
  },
  text: { flex: 1 },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    color: theme.primaryInk,
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginTop: 2,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    // The whole card is the touch target; this only keeps the action line from
    // crowding the description when German or Russian wraps it.
    minHeight: 32,
  },
  ctaLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.primaryInk,
  },
});
