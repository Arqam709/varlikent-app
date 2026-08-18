import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountHeader, ScreenIntro, SettingsSection } from '@/components/account/settings-ui';
import { FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage, type LanguageCode } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';

export default function AccountInformationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, isRTL, language } = useLanguage();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <AccountHeader title={t('accountInformation.title')} onBack={handleBack} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AccountHeader title={t('accountInformation.title')} onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenIntro text={t('accountInformation.subtitle')} />

        <SettingsSection title={t('accountInformation.title')}>
          <InfoRow
            label={t('accountInformation.role')}
            value={t(`accountInformation.roles.${user.role}`)}
          />
          <InfoRow
            label={t('accountInformation.signInMethod')}
            value={t(`accountInformation.providers.${user.provider}`)}
          />
          <InfoRow
            label={t('accountInformation.memberSince')}
            value={formatJoinDate(user.createdAt, language)}
          />
          <InfoRow
            label={t('accountInformation.status')}
            value={
              user.isActive ? t('accountInformation.active') : t('accountInformation.inactive')
            }
            tone={user.isActive ? 'positive' : 'negative'}
            isLast
          />
        </SettingsSection>

        <Text
          style={[
            styles.footnote,
            { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
          ]}>
          {user.email}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  tone,
  isLast = false,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  isLast?: boolean;
}) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  const valueColor =
    tone === 'positive' ? theme.success : tone === 'negative' ? theme.danger : theme.text;

  return (
    <View
      style={[
        styles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * "28 June 2026", localized.
 *
 * `Intl` is available in Hermes with full ICU on modern Expo, but a bad or
 * missing `createdAt` must never render "Invalid Date" on a settings screen, so
 * the value is validated first and falls back to an em dash.
 */
function formatJoinDate(iso: string, language: LanguageCode): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const locale = language === 'tr' ? 'tr-TR' : language === 'ar' ? 'ar' : 'en-GB';

  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  row: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
  },
  rowValue: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    flexShrink: 1,
    textAlign: 'right',
  },

  footnote: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    marginTop: Spacing.lg,
  },
});
