import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountHeader, ScreenIntro, StatusMessage } from '@/components/account/settings-ui';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { SUPPORT_EMAIL } from '@/features/account/account-api';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();

  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const handleContactSupport = async () => {
    setError(null);

    const subject = encodeURIComponent(t('deleteAccount.emailSubject'));
    // The account's own email, so support can identify the request without a
    // back-and-forth. Nothing else is included.
    const body = encodeURIComponent(`Account: ${user?.email ?? ''}`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('no mail client');
      await Linking.openURL(url);
    } catch {
      // A device with no mail client configured must still be told the address,
      // rather than having the button silently do nothing.
      setError(t('deleteAccount.cannotOpenMail', { email: SUPPORT_EMAIL }));
    }
  };

  const consequences = [
    t('deleteAccount.consequenceProfile'),
    t('deleteAccount.consequenceMessages'),
    t('deleteAccount.consequenceAlerts'),
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AccountHeader title={t('deleteAccount.title')} onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.warning,
            { backgroundColor: theme.surface, borderColor: theme.danger },
          ]}>
          <Ionicons name="warning-outline" size={24} color={theme.danger} />
          <Text
            style={[
              styles.warningTitle,
              { color: theme.danger, textAlign: isRTL ? 'right' : 'left' },
            ]}>
            {t('deleteAccount.heading')}
          </Text>
          <Text
            style={[
              styles.warningBody,
              { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
            ]}>
            {t('deleteAccount.body')}
          </Text>
        </View>

        <View style={styles.consequences}>
          {consequences.map((line) => (
            <View
              key={line}
              style={[
                styles.consequenceRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}>
              <Ionicons name="close-circle-outline" size={18} color={theme.textMuted} />
              <Text
                style={[
                  styles.consequenceText,
                  { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
                ]}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.supportCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Text
            style={[
              styles.supportTitle,
              { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
            ]}>
            {t('deleteAccount.supportHeading')}
          </Text>
          <ScreenIntro text={t('deleteAccount.supportBody')} />

          <Pressable
            onPress={handleContactSupport}
            accessibilityRole="button"
            accessibilityLabel={`${t('deleteAccount.contactSupport')}, ${SUPPORT_EMAIL}`}
            style={({ pressed }) => [
              styles.dangerButton,
              { borderColor: theme.danger },
              pressed && { backgroundColor: theme.marble },
            ]}>
            <Ionicons name="mail-outline" size={18} color={theme.danger} />
            <Text style={[styles.dangerButtonText, { color: theme.danger }]}>
              {t('deleteAccount.contactSupport')}
            </Text>
          </Pressable>

          <Text style={[styles.email, { color: theme.textMuted }]}>{SUPPORT_EMAIL}</Text>

          {error ? <StatusMessage tone="error" text={error} /> : null}
        </View>

        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          style={({ pressed }) => [
            styles.cancelButton,
            { borderColor: theme.border },
            pressed && { backgroundColor: theme.marble },
          ]}>
          <Text style={[styles.cancelText, { color: theme.text }]}>{t('common.cancel')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  warning: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  warningTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
  },
  warningBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },

  consequences: { gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.lg },
  consequenceRow: { alignItems: 'flex-start', gap: Spacing.sm },
  consequenceText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },

  supportCard: {
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  supportTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  dangerButtonText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
  },
  email: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  cancelButton: {
    marginTop: Spacing.lg,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
  },
});
