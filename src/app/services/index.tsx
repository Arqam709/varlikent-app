import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { SERVICES, SERVICES_INTRO_KEY, serviceKey } from '@/features/services/services-data';

export default function ServicesScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, onwardIcon } = useDirection();
  const router = useRouter();

  /** Matches the detail screen: fall back to Home if opened without history. */
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/*
        A custom header, because the root Stack sets headerShown: false
        globally — so there is no navigation header to duplicate.
      */}
      <ScreenHeader title={t('services.title')} onBack={handleBack} />

      {/*
        ScrollView, not FlatList: four fixed sections of one structured
        document. Virtualisation would add machinery and force the sections
        into a data array for no benefit.
      */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <SectionHeader
            eyebrow={t('services.eyebrow')}
            title={t('services.title')}
            size="lg"
            rule
          />
          <Text style={styles.introText}>{t(SERVICES_INTRO_KEY)}</Text>
        </View>

        {SERVICES.map((service, index) => (
          /*
            Now interactive: every service has its own real route, so a button
            role here is truthful rather than decorative.
          */
          <Pressable
            key={service.id}
            onPress={() =>
              router.push({ pathname: '/services/[service]', params: { service: service.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={`${t(serviceKey(service, 'title'))}. ${t(serviceKey(service, 'short'))}`}
            style={({ pressed }) => [styles.service, pressed && styles.servicePressed]}>
            <View style={styles.serviceHeader}>
              {/* Numbered 01–04, padded so the column stays aligned. */}
              <Text style={styles.serviceNumber}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <View style={styles.serviceIcon}>
                <Ionicons name={service.icon} size={24} color={theme.primaryInk} />
              </View>
            </View>

            <Text style={styles.serviceTitle}>{t(serviceKey(service, 'title'))}</Text>
            <Text style={styles.serviceDescription}>{t(serviceKey(service, 'description'))}</Text>
            <Text style={styles.serviceShort}>{t(serviceKey(service, 'short'))}</Text>

            {/* One restrained affordance per card — no arrow noise elsewhere. */}
            <View style={[styles.serviceAction, { flexDirection: row }]}>
              <Text style={styles.serviceActionText}>{t('services.explore')}</Text>
              {/* Directional: 'onward' follows the script. */}
              <Ionicons name={onwardIcon} size={14} color={theme.primaryInk} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  scroll: { paddingBottom: Spacing.xxl },

  intro: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  introText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
  },

  service: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  serviceNumber: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    // Gold used once per section as a quiet editorial marker, nothing more.
    color: theme.accentText,
    letterSpacing: LetterSpacing.wide,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },
  serviceDescription: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.text,
    marginTop: Spacing.sm,
  },
  serviceShort: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },
  servicePressed: {
    borderColor: theme.brandGreen,
    backgroundColor: theme.marble,
  },
  serviceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  serviceActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.primaryInk,
  },
});
