import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountHeader, ScreenIntro, StatusMessage } from '@/components/account/settings-ui';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { hasLocalPassword, updatePassword } from '@/features/account/account-api';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { ApiError } from '@/services/api-client';

/** Mirrors the backend rule in routes/users.js. The server re-validates. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * PASSWORD & SECURITY.
 *
 * ── Why a Google/Microsoft account sees an explanation, not a form ──────
 * Reading the backend settles this rather than guessing. When someone signs in
 * with Google, `routes/auth.js` CREATES the user with
 * `password: Math.random().toString(36).slice(-12)`; the Microsoft path uses
 * `crypto.randomBytes(24).toString('hex')`. So a social account technically HAS
 * a password hash — but it is a random value the customer has never seen.
 *
 * `PUT /users/me/password` requires `currentPassword` and checks it with
 * `comparePassword`. A social customer therefore cannot possibly satisfy it:
 * the form would look completely normal and reject every attempt with "Current
 * password is incorrect", which reads as a bug in the app rather than as the
 * consequence of how they signed up.
 *
 * So the screen branches on `provider` and tells them the truth, pointing at the
 * two things that actually work: managing the password with their provider, or
 * using the existing forgot-password email flow to set a Varlikent one.
 */
export default function PasswordScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const canChangePassword = hasLocalPassword(user);
  const providerLabel = t(`accountInformation.providers.${user?.provider ?? 'local'}`);

  const handleSubmit = async () => {
    if (!token || saving) return;

    setError(null);
    setDone(false);

    if (!current || !next || !confirm) return setError(t('password.allRequired'));
    if (next.length < MIN_PASSWORD_LENGTH) return setError(t('password.tooShort'));
    if (next !== confirm) return setError(t('password.mismatch'));

    setSaving(true);
    try {
      await updatePassword(token, {
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });

      // Cleared only on success, so a rejected attempt leaves the typing intact.
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  /* ── Social account: explain rather than show a form that cannot work ── */
  if (!canChangePassword) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <AccountHeader title={t('password.title')} onBack={handleBack} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.notice,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Ionicons name="shield-checkmark-outline" size={22} color={theme.primary} />
            <Text
              style={[
                styles.noticeTitle,
                { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
              ]}>
              {t('password.socialTitle')}
            </Text>
            <Text
              style={[
                styles.noticeBody,
                { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
              ]}>
              {t('password.socialBody', { provider: providerLabel })}
            </Text>
          </View>

          <View
            style={[
              styles.notice,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Ionicons name="mail-outline" size={22} color={theme.accent} />
            <Text
              style={[
                styles.noticeTitle,
                { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
              ]}>
              {t('password.socialResetTitle')}
            </Text>
            <Text
              style={[
                styles.noticeBody,
                { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
              ]}>
              {t('password.socialResetBody')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── Local account: the real form ───────────────────────────────────── */
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AccountHeader title={t('password.title')} onBack={handleBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScreenIntro text={t('password.subtitle')} />

          <PasswordField
            label={t('password.current')}
            value={current}
            onChangeText={setCurrent}
            reveal={reveal}
            onToggleReveal={() => setReveal((value) => !value)}
            editable={!saving}
          />
          <PasswordField
            label={t('password.new')}
            value={next}
            onChangeText={setNext}
            reveal={reveal}
            onToggleReveal={() => setReveal((value) => !value)}
            editable={!saving}
            hint={t('password.minLength')}
          />
          <PasswordField
            label={t('password.confirm')}
            value={confirm}
            onChangeText={setConfirm}
            reveal={reveal}
            onToggleReveal={() => setReveal((value) => !value)}
            editable={!saving}
          />

          {error ? <StatusMessage tone="error" text={error} /> : null}
          {done ? <StatusMessage tone="success" text={t('password.updated')} /> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t('password.update')}
            accessibilityState={{ disabled: saving, busy: saving }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              saving && styles.buttonDisabled,
              pressed && !saving && { backgroundColor: theme.primaryPressed },
            ]}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.primaryText }]}>
                {t('password.update')}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  reveal,
  onToggleReveal,
  editable,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  reveal: boolean;
  onToggleReveal: () => void;
  editable: boolean;
  hint?: string;
}) {
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();

  return (
    <View style={styles.field}>
      <Text
        style={[
          styles.fieldLabel,
          { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
        ]}>
        {label}
      </Text>

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!reveal}
          editable={editable}
          accessibilityLabel={label}
          placeholder={t('password.placeholder')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: theme.text, textAlign: isRTL ? 'right' : 'left' }]}
        />
        <Pressable
          onPress={onToggleReveal}
          accessibilityRole="button"
          accessibilityLabel={reveal ? t('password.hide') : t('password.show')}
          hitSlop={10}
          style={styles.revealButton}>
          <Ionicons
            name={reveal ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.textMuted}
          />
        </Pressable>
      </View>

      {hint ? (
        <Text
          style={[
            styles.hint,
            { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
          ]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  field: { marginBottom: Spacing.md },
  fieldLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  inputRow: {
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    paddingVertical: Spacing.sm,
  },
  revealButton: { padding: Spacing.xs },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },

  button: {
    marginTop: Spacing.lg,
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
  },

  notice: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  noticeTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
  },
  noticeBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 20,
  },
});
