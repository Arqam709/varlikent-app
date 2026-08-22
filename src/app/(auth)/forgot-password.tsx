import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import TextField from '@/components/ui/text-field';
import { FontFamily, FontSizes, Spacing } from '@/constants/theme';
import * as authApi from '@/features/auth/auth-api';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';


const RESEND_COOLDOWN = 60;

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestResetLink = async (trimmedEmail: string, resendFailureCopy: boolean) => {
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await authApi.forgotPassword(trimmedEmail);
      setSent(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : t(resendFailureCopy ? 'auth.resendFailed' : 'common.somethingWentWrong')
      );
    } finally {
      // In `finally` so the button always recovers, success or failure.
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage(t('auth.emailRequired'));
      return;
    }

    await requestResetLink(trimmedEmail, false);
  };

  const handleResend = async () => {
    if (submitting || cooldown > 0) return;

    await requestResetLink(email.trim(), true);
  };

  /** Matches Login: pop if there is history, otherwise fall back to Login. */
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const goToSignIn = () => router.replace('/login');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={handleBack} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.back}>← {t('auth.backToSignIn')}</Text>
          </Pressable>

          <View style={styles.brand}>
            <VarlikentIcon width={26} height={24} />
            <Text style={styles.wordmark}>VARLIKENT</Text>
          </View>

          {sent ? (
            /* ── Sent: the confirmation replaces the form ────────────────── */
            <View style={styles.form}>
              <View style={styles.sentIcon}>
                <Ionicons name="mail-outline" size={28} color={theme.primary} />
              </View>

              <Text style={styles.title}>{t('auth.checkInboxTitle')}</Text>


              <Text style={styles.subtitle}>
                {t('auth.sentMessage', { email: email.trim() })}
              </Text>

              <Text style={styles.note}>{t('auth.spamNote')}</Text>

              {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

              <Button
                label={
                  cooldown > 0
                    ? t('auth.resendCooldown', { seconds: String(cooldown) })
                    : t('auth.resendLink')
                }
                variant="secondary"
                onPress={handleResend}
                loading={submitting}
                loadingLabel={t('auth.sending')}
                disabled={cooldown > 0}
              />

              <Button label={t('common.signIn')} variant="primary" onPress={goToSignIn} />
            </View>
          ) : (
            /* ── Request form ───────────────────────────────────────────── */
            <>
              <Text style={styles.title}>{t('auth.forgotTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.forgotSubtitle')}</Text>

              <View style={styles.form}>
                <TextField
                  label={t('auth.email')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                />

                {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

                <Button
                  label={t('auth.sendResetLink')}
                  variant="primary"
                  onPress={handleSubmit}
                  loading={submitting}
                  loadingLabel={t('auth.sending')}
                />
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('auth.rememberedIt')} </Text>
                <Pressable onPress={goToSignIn} accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.footerLink}>{t('common.signIn')}</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.softWhite,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  back: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    paddingVertical: Spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  wordmark: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.sm,
    color: theme.text,
    letterSpacing: 3,
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.xl,
    color: theme.text,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: theme.textMuted,
    marginTop: Spacing.xs,
  },
  note: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.textMuted,
  },
  form: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  /** Circular badge behind the mail glyph, echoing the website's sent state. */
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.marble,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: theme.danger,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },
  footerLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: theme.primaryInk,
  },
});
