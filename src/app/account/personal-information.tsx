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
import { updateProfile } from '@/features/account/account-api';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { ApiError } from '@/services/api-client';

/** Deliberately permissive — the server is the real authority on deliverability. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PERSONAL INFORMATION — name and email.
 *
 * Writes through `PUT /users/me/profile`, the SAME endpoint the website's
 * Settings page uses, so a name changed here is the name the website shows.
 * There is one User document and one write path.
 */
export default function PersonalInformationScreen() {
  const router = useRouter();
  const { user, token, applyUser } = useAuth();
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const changed = trimmedName !== (user?.name ?? '') || trimmedEmail !== (user?.email ?? '');

  const handleSave = async () => {
    if (!token || saving) return;

    setError(null);
    setSaved(false);

    // Validated before the request so an obvious mistake costs no round trip —
    // the server re-validates regardless and stays authoritative.
    if (!trimmedName) return setError(t('personalInformation.nameRequired'));
    if (!trimmedEmail) return setError(t('personalInformation.emailRequired'));
    if (!EMAIL_PATTERN.test(trimmedEmail)) return setError(t('personalInformation.emailInvalid'));
    if (!changed) return setError(t('personalInformation.noChanges'));

    setSaving(true);
    try {
      const updated = await updateProfile(token, { name: trimmedName, email: trimmedEmail });
      // The endpoint returns the saved user, so state adopts the SERVER's
      // version rather than the text still sitting in the inputs — if the
      // backend normalised the email to lowercase, that is what is shown.
      applyUser(updated);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('common.somethingWentWrong')
      );
    } finally {
      setSaving(false);
    }
  };

  const canSave = changed && !saving;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AccountHeader title={t('personalInformation.title')} onBack={handleBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScreenIntro text={t('personalInformation.subtitle')} />

          <Field
            label={t('personalInformation.fullName')}
            value={name}
            onChangeText={(next) => {
              setName(next);
              setSaved(false);
            }}
            placeholder={t('personalInformation.fullNamePlaceholder')}
            autoCapitalize="words"
            textContentType="name"
            editable={!saving}
          />

          <Field
            label={t('personalInformation.email')}
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              setSaved(false);
            }}
            placeholder={t('personalInformation.emailPlaceholder')}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!saving}
          />

          {error ? <StatusMessage tone="error" text={error} /> : null}
          {saved ? <StatusMessage tone="success" text={t('personalInformation.saved')} /> : null}

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            accessibilityState={{ disabled: !canSave, busy: saving }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              !canSave && styles.buttonDisabled,
              pressed && canSave && { backgroundColor: theme.primaryPressed },
            ]}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.primaryText }]}>
                {t('common.save')}
              </Text>
            )}
          </Pressable>

          <Text
            style={[
              styles.hint,
              { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
            ]}>
            {t('personalInformation.subtitle')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A labelled text input. Shared by this screen and the password screen's shape. */
function Field({
  label,
  ...input
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <View style={styles.field}>
      <Text
        style={[
          styles.fieldLabel,
          { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
        ]}>
        {label}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
            textAlign: isRTL ? 'right' : 'left',
          },
        ]}
      />
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
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
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

  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    marginTop: Spacing.lg,
  },
});
