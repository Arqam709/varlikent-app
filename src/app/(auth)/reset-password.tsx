import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import * as authApi from '@/features/auth/auth-api';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';

/**
 * RESET PASSWORD  →  route "/reset-password?token=..."
 *
 * Reached from the emailed link. In production that link is
 * `https://www.varlikent.com/reset-password?token=…`, which Android hands to
 * this screen once App Links are verified and falls back to the website
 * otherwise — so the same URL serves both, and the email never mentions the app.
 *
 * ── The token is a credential ────────────────────────────────────────────
 * It is the single thing standing between a stranger and this account, which is
 * why it is read from the route, spent on one request, and never written
 * anywhere: not to SecureStore, not to AsyncStorage, not into AuthContext, and
 * never to a log. It lives in a route param and a local variable, nothing more.
 *
 * ── No session results ───────────────────────────────────────────────────
 * The backend deliberately returns no JWT here, so a successful reset ends at
 * "sign in with your new password" rather than dropping the user into the app.
 * That also means this screen never touches AuthContext.
 */

/** Mirrors the backend's own rule in routes/auth.js. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Reads `?token=` safely.
 *
 * Expo Router types a param as `string | string[] | undefined`, because a URL
 * may legally repeat a key (`?token=a&token=b`). Taking the first entry and
 * trimming means a duplicated or padded param cannot reach the request as an
 * array or with stray whitespace.
 */
function readToken(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

export default function ResetPasswordScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = readToken(params.token);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /**
   * `replace`, not `push` — the same rule the other auth screens follow, so a
   * back gesture cannot return to a reset form whose token has been consumed.
   */
  const goToSignIn = () => router.replace('/login');

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const handleSubmit = async () => {
    if (submitting) return;

    /**
     * Only the two rules the client can genuinely enforce, both mirroring the
     * backend so the user gets an instant answer instead of a round trip. The
     * token itself is NOT validated locally — its format is an implementation
     * detail of the server, and guessing at it here would reject valid links.
     */
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      // Reused rather than duplicated: Register already owns this wording.
      setErrorMessage(t('register.passwordMismatch'));
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      // Exactly { token, password }. confirmPassword stays on the device.
      await authApi.resetPassword(token, password);

      /**
       * Cleared on success so a consumed token is not sitting in state behind
       * the confirmation panel.
       */
      setPassword('');
      setConfirmPassword('');
      setDone(true);
    } catch (error) {
      /**
       * `ApiError.message` already carries the backend's own wording, which is
       * written for users: an expired or already-used link gives "Reset link is
       * invalid or has expired." and a short password gives the length rule.
       * A network failure gives a connection message. Nothing here needs to
       * know which.
       */
      setErrorMessage(
        error instanceof ApiError ? error.message : t('common.somethingWentWrong')
      );
    } finally {
      setSubmitting(false);
    }
  };

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

          {done ? (
            /* ── Reset complete ──────────────────────────────────────── */
            <View style={styles.form}>
              <View style={styles.statusIcon}>
                <Ionicons name="checkmark-circle-outline" size={28} color={theme.success} />
              </View>

              <Text style={styles.title}>{t('auth.resetDoneTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.resetDoneBody')}</Text>

              <Button label={t('common.signIn')} variant="primary" onPress={goToSignIn} />
            </View>
          ) : !token ? (
            /*
              ── No token in the link ───────────────────────────────────
              Matches the website, which shows an "Invalid Link" panel rather
              than a form that could only fail. Nothing is sent.
            */
            <View style={styles.form}>
              <View style={styles.statusIcon}>
                <Ionicons name="alert-circle-outline" size={28} color={theme.danger} />
              </View>

              <Text style={styles.title}>{t('auth.resetInvalidTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.resetInvalidBody')}</Text>

              <Button
                label={t('auth.requestNewLink')}
                variant="primary"
                onPress={() => router.replace('/forgot-password')}
              />
            </View>
          ) : (
            /* ── The form ────────────────────────────────────────────── */
            <>
              <Text style={styles.title}>{t('auth.resetTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.resetSubtitle')}</Text>

              <View style={styles.form}>
                <TextField
                  label={t('auth.newPassword')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secure
                  autoComplete="new-password"
                  textContentType="newPassword"
                />

                <TextField
                  label={t('register.confirmPassword')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secure
                  autoComplete="new-password"
                  textContentType="newPassword"
                />

                {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

                <Button
                  label={t('auth.resetAction')}
                  variant="primary"
                  onPress={handleSubmit}
                  loading={submitting}
                  loadingLabel={t('auth.resetSaving')}
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
  form: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  /** Circular badge for the success and invalid-link panels. */
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
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
