import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { SERVICES, SERVICES_INTRO_KEY, serviceKey } from '@/features/services/services-data';

export default function HomeServicesPreview() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{t('home.expertiseEyebrow')}</Text>
      <Text style={styles.heading}>{t('home.beyondRealEstate')}</Text>
      <Text style={styles.intro}>{t(SERVICES_INTRO_KEY)}</Text>

      <View style={styles.grid}>
        {SERVICES.map((service) => (
          <Pressable
            key={service.id}
            onPress={() =>
              router.push({ pathname: '/services/[service]', params: { service: service.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={`${t(serviceKey(service, 'title'))}. ${t(serviceKey(service, 'short'))}`}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
            <Ionicons name={service.icon} size={22} color={theme.primaryInk} />
            <Text style={styles.tileTitle}>{t(serviceKey(service, 'title'))}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.push('/services')}
        accessibilityRole="button"
        accessibilityLabel={t('home.viewAllServices')}
        style={({ pressed }) => [styles.viewAll, pressed && styles.viewAllPressed]}>
        <Text style={styles.viewAllText}>{t('home.viewAllServices')}</Text>
        <Ionicons name="arrow-forward" size={16} color={theme.primaryInk} />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.primaryInk,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginTop: Spacing.xs,
  },
  intro: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  /**
   * `48%` rather than a fixed width, so two tiles fit any phone with the gap
   * between them. flexWrap then breaks them into 2x2.
   */
  tile: {
    width: '48%',
    backgroundColor: theme.marble,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    minHeight: 96,
    justifyContent: 'center',
  },
  /**
   * Tiles became pressable once each service gained its own route. In Phase 3A
   * they were inert on purpose — four tiles all leading to the same page would
   * have looked specific while being generic.
   */
  tilePressed: {
    borderColor: theme.brandGreen,
    backgroundColor: theme.cardBg,
  },
  tileTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    color: theme.text,
  },

  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 48,
  },
  viewAllPressed: {
    borderColor: theme.brandGreen,
    backgroundColor: theme.marble,
  },
  viewAllText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.primaryInk,
  },
});
