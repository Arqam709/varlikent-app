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
import { Colors, FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/services/api-client';

/**
 * REGISTER  →  route "/register"
 *
 * Same `(auth)` group as Login, so the group name is dropped from the URL.
 *
 * UI AND ROUTING ONLY. No API call, no token, no validation — the backend
 * enforces a 6-character minimum and the password match, and we will surface
 * those errors when the form is connected.
 *
 * Copy is taken verbatim from the website's locales/translations.js (`auth.*`).
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    /**
     * Minimal client-side checks only. Two of them mirror backend rules so the
     * user gets an instant answer instead of a round trip (6-char minimum,
     * required fields); the third — password confirmation — is purely a
     * client concern, because the backend never receives confirmPassword and
     * so cannot check it.
     *
     * Real validation still belongs to the backend, and its messages are shown
     * verbatim when they come back.
     */
    if (!trimmedName || !trimmedEmail || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      // Exactly { name, email, password } reaches the backend.
      // confirmPassword is deliberately NOT sent — the API does not accept it.
      await register(trimmedName, trimmedEmail, password);
      router.replace('/');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
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
            <Text style={styles.back}>← Back to Home</Text>
          </Pressable>

          <View style={styles.brand}>
            <VarlikentIcon width={26} height={24} />
            <Text style={styles.wordmark}>VARLIKENT</Text>
          </View>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Fill in your details to get started.</Text>

          <View style={styles.form}>
            <TextField
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              // Website's own placeholder — states the backend's 6-char minimum
              // without us implementing validation yet.
              placeholder="Min. 6 characters"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />

            <TextField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat password"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <Button
              label="Create Account"
              variant="primary"
              onPress={handleSubmit}
              loading={submitting}
              loadingLabel="Creating Account..."
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable
              onPress={() => router.replace('/login')}
              accessibilityRole="link"
              hitSlop={8}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.softWhite,
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
    color: Colors.textMuted,
    paddingVertical: Spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  wordmark: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.sm,
    color: Colors.charcoal,
    letterSpacing: 3,
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.xl,
    color: Colors.charcoal,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: Colors.danger,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing.lg,
  },
  footerText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  footerLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.brandGreen,
  },
});
