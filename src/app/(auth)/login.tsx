import { useRouter } from 'expo-router';
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

import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';
import Button from '@/components/ui/button';
import TextField from '@/components/ui/text-field';
import { FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/services/api-client';

/**
 * LOGIN  →  route "/login"
 *
 * Lives in the `(auth)` route group. The parentheses mark the folder as
 * organisational, so it is skipped when the URL is built: the segments are
 * `(auth)` + `login`, and only `login` survives.
 *
 * UI AND ROUTING ONLY. No API call, no token, no auth state — the Sign In
 * button deliberately has no `onPress` yet.
 *
 * Copy is taken verbatim from the website's locales/translations.js (`auth.*`).
 */
export default function LoginScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { login } = useAuth();

  /**
   * Controlled inputs. Same pattern as React on the web: state holds the
   * value, the input renders it, and typing calls the setter.
   */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /** Blocks duplicate submissions and drives the button's loading state. */
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Guard against a double tap racing past the disabled prop.
    if (submitting) return;

    // Trimmed because mobile keyboards love appending a space after
    // autocomplete, and the backend's isEmail() would reject it.
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage(t('auth.credentialsRequired'));
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      await login(trimmedEmail, password);
      /**
       * `replace`, not `push`: once signed in, the back gesture should not
       * return to the login form.
       */
      router.replace('/');
    } catch (error) {
      /**
       * `ApiError.message` is already normalised by the api client — a 401
       * gives "Invalid credentials", a validator failure gives the backend's
       * own field messages, and a network failure gives a connection message.
       * They are never collapsed into one generic string.
       */
      setErrorMessage(
        error instanceof ApiError ? error.message : t('common.somethingWentWrong')
      );
    } finally {
      // `finally` so the button always recovers, success or failure.
      setSubmitting(false);
    }
  };

  /**
   * `back()` pops one screen. But if this screen were opened directly (a deep
   * link, or later a redirect), there may be nothing beneath it — so fall back
   * to replacing with Home rather than popping into an empty stack.
   */
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/*
        The keyboard slides OVER the layout rather than reflowing it, so a
        focused field near the bottom would sit behind it. KeyboardAvoidingView
        pads its children by the keyboard height to keep them visible.

        iOS needs 'padding'. Android resizes the window itself (Expo's default
        soft-input mode), so passing a behavior there fights the OS.
      */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          // Lets a tap land on a button the first time while the keyboard is
          // open; otherwise the first tap is consumed by dismissing it.
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={handleBack} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.back}>← Back to Home</Text>
          </Pressable>

          <View style={styles.brand}>
            <VarlikentIcon width={26} height={24} />
            <Text style={styles.wordmark}>VARLIKENT</Text>
          </View>

          <Text style={styles.title}>{t('common.signIn')}</Text>
          <Text style={styles.subtitle}>{t('auth.welcomeBack')}</Text>

          <View style={styles.form}>
            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secure
              autoComplete="password"
              textContentType="password"
              // Visual only for this step — /forgot-password does not exist yet,
              // so it is plain Text rather than something that looks tappable.
              labelAccessory={<Text style={styles.forgot}>{t('auth.forgotPassword')}</Text>}
            />

            {/*
              One error slot for every failure kind. The message text is
              already specific — authentication, validation, connection and
              timeout each read differently.
            */}
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <Button
              label={t('common.signIn')}
              variant="primary"
              onPress={handleSubmit}
              loading={submitting}
              loadingLabel="Signing In..."
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            {/*
              `replace`, not `push`. Bouncing Login → Register → Login with push
              would stack a screen every time and make the back button walk
              through the whole history. replace keeps exactly one auth screen.
            */}
            <Pressable
              onPress={() => router.replace('/register')}
              accessibilityRole="link"
              hitSlop={8}>
              <Text style={styles.footerLink}>{t('auth.noAccount')}</Text>
            </Pressable>
          </View>
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
    color: theme.textMuted,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  forgot: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.primaryInk,
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
