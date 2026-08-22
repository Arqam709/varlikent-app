import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { GoogleSignInFailure } from '@/features/auth/google-signin';
import { useLanguage } from '@/features/localization/language-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { useTheme } from '@/features/theme/theme-context';
import { ApiError } from '@/services/api-client';

/**
 * "OR / Continue with Google" — shared by Login and Register.
 *
 * One component rather than two copies because the two screens are deliberate
 * mirror images, and because Google authentication genuinely IS the same action
 * on both: the backend's resolveGoogleUser() finds, links or creates as
 * appropriate, so there is no sign-up variant to write.
 *
 * Navigation stays with the caller via `onSuccess`, so each screen keeps
 * whatever post-authentication behaviour it already had for email/password
 * rather than inheriting a destination invented here.
 */

type Props = {
  /** True while the screen's own email/password submit is in flight. */
  disabled?: boolean;
  /** Called with a translated message, or null to clear the screen's error. */
  onError: (message: string | null) => void;
  /** Called after the Varlikent session has been applied. */
  onSuccess: () => void;
};

export default function GoogleSignInSection({ disabled = false, onError, onSuccess }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { loginWithGoogle } = useAuth();

  /**
   * Google gets its own busy flag rather than sharing the password form's.
   * Sharing one would either leave the Sign In button spinning during a Google
   * sign-in, or leave the Google button idle-looking during a password login.
   */
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy || disabled) return;

    onError(null);
    setBusy(true);

    try {
      const outcome = await loginWithGoogle();

      /**
       * Backing out of the account sheet is not a failure. Nothing is shown,
       * nothing is logged, no request was made — the user simply stays here
       * with the button usable again.
       */
      if (outcome === 'cancelled') return;

      onSuccess();
    } catch (error) {
      onError(messageFor(error));
    } finally {
      // In `finally` so the button always recovers, including after a throw
      // and after the cancelled early-return above.
      setBusy(false);
    }
  };

  /**
   * Turns any failure into something safe and translated.
   *
   * ApiError messages come from the backend and are already written for users
   * ("Your Google email address is not verified", "Your account is
   * deactivated"), so they pass through as-is — the same treatment the password
   * form gives them. Native SDK failures carry a code instead of a message,
   * precisely so the wording can live here where `t()` does.
   */
  function messageFor(error: unknown): string {
    if (error instanceof ApiError) return error.message;

    if (error instanceof GoogleSignInFailure) {
      switch (error.code) {
        case 'not_configured':
        case 'developer_error':
          // Both are build/configuration faults. The user cannot act on the
          // difference, and naming SHA-1s or client IDs at them would be noise.
          return t('auth.googleNotConfigured');
        case 'play_services':
          return t('auth.googlePlayServices');
        default:
          return t('auth.googleFailed');
      }
    }

    return t('common.somethingWentWrong');
  }

  return (
    <View style={styles.wrap}>
      {/*
        Centred rule with a label. Centring is also what keeps it correct under
        RTL without any direction-aware styling of its own.
      */}
      <View style={styles.dividerRow}>
        <View style={styles.rule} />
        <Text style={styles.dividerLabel}>{t('auth.or')}</Text>
        <View style={styles.rule} />
      </View>

      <Button
        label={t('auth.continueWithGoogle')}
        variant="secondary"
        onPress={handlePress}
        loading={busy}
        loadingLabel={t('auth.googleConnecting')}
        // Blocked while the password form is submitting, so the two auth paths
        // can never be in flight at once.
        disabled={disabled}
        icon={<Ionicons name="logo-google" size={18} color={theme.text} />}
      />
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  wrap: {
    gap: Spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.border,
  },
  dividerLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    textTransform: 'uppercase',
  },
});
