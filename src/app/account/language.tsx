import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AccountHeader,
  ScreenIntro,
  SelectionIndicator,
  SettingsSection,
} from '@/components/account/settings-ui';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { LANGUAGES, useLanguage, type LanguageCode } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';

/**
 * LANGUAGE — English, Türkçe, العربية.
 *
 * The same three languages the website offers. Each option is labelled in its
 * OWN language, which is the standard for a language picker: a customer who has
 * accidentally landed in a language they cannot read still needs to find their
 * way back, and "Turkish" is no help to someone looking for "Türkçe".
 */
export default function LanguageScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, language, setLanguage, isRTL, needsRestartForRTL } = useLanguage();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const handleSelect = (code: LanguageCode) => {
    if (code === language) return;
    // Awaiting is unnecessary: the UI updates from state immediately and the
    // write is fire-and-forget by design (see preferences-storage).
    void setLanguage(code);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AccountHeader title={t('language.title')} onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenIntro text={t('language.subtitle')} />

        <SettingsSection title={t('language.title')}>
          {LANGUAGES.map((entry, index) => {
            const selected = entry.code === language;

            return (
              <Pressable
                key={entry.code}
                onPress={() => handleSelect(entry.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={entry.englishLabel}
                style={({ pressed }) => [
                  styles.row,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  index < LANGUAGES.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                  pressed && { backgroundColor: theme.marble },
                ]}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: theme.text,
                      textAlign: isRTL ? 'right' : 'left',
                      // Arabic script needs a little more room vertically.
                      fontFamily: entry.code === 'ar' ? FontFamily.body : FontFamily.body,
                    },
                  ]}>
                  {entry.label}
                </Text>
                <SelectionIndicator selected={selected} />
              </Pressable>
            );
          })}
        </SettingsSection>

        {/*
          Told plainly rather than hidden.
          React Native resolves layout direction natively when the view hierarchy
          is built, so a full mirror of the navigator's own gestures and
          transition animations only lands after a reload. Everything our styles
          control — text alignment, row direction, chevron direction — has
          already flipped by the time this notice appears, so the app is usable
          immediately; this explains the remaining difference instead of leaving
          the customer wondering.
        */}
        {needsRestartForRTL ? (
          <View
            style={[
              styles.notice,
              { backgroundColor: theme.surface, borderColor: theme.accent },
            ]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.accent} />
            <View style={styles.noticeText}>
              <Text
                style={[
                  styles.noticeTitle,
                  { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
                ]}>
                {t('language.restartTitle')}
              </Text>
              <Text
                style={[
                  styles.noticeBody,
                  { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
                ]}>
                {t('language.restartBody')}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  row: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 56,
  },
  label: {
    flex: 1,
    fontSize: FontSizes.md,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  noticeText: { flex: 1, gap: 2 },
  noticeTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
  },
  noticeBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 20,
  },
});
