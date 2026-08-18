import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileHeader, SettingsRow, SettingsSection } from '@/components/account/settings-ui';
import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { hasLocalPassword } from '@/features/account/account-api';
import { useAuth } from '@/features/auth/auth-context';
import { LANGUAGES, useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';

/**
 * ACCOUNT — the settings index.
 *
 * A native settings-index layout (grouped rows, chevrons, detail routes) wearing
 * Varlikent's identity: Cinzel for the wordmark and headings, Josefin Sans for
 * rows, brand green for action and gold reserved for decoration.
 *
 * ── Rows are only here when they lead somewhere real ────────────────────
 * Every row below has a working destination, verified against the backend and
 * the existing mobile routes. Three rows from the original design brief are
 * deliberately ABSENT rather than shipped as decoration:
 *
 *   My Favourites   — there is no favourites screen in the app yet. The data
 *                     exists on the User, but a row that navigates nowhere is
 *                     worse than no row.
 *   Notifications   — as a PREFERENCES screen. The backend stores no
 *                     notification preferences (only a list of new listings and
 *                     a last-seen timestamp), so there is nothing to toggle. The
 *                     existing listings feed is linked under Property Activity
 *                     instead, labelled for what it actually is.
 *   Sign-in Methods — the app only knows `provider`, i.e. which method CREATED
 *                     the account. It cannot truthfully say whether Google and
 *                     Microsoft are each linked, and inferring that would be a
 *                     guess presented as fact.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const { theme } = useTheme();
  const { t, isRTL, language } = useLanguage();

  const currentLanguageLabel = LANGUAGES.find((entry) => entry.code === language)?.label ?? '';

  /* ── Session still resolving ─────────────────────────────────────── */
  if (status === 'loading') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <Masthead />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Signed out ──────────────────────────────────────────────────── */
  if (status !== 'authenticated' || !user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <Masthead />
        <View style={styles.centered}>
          <Text style={[styles.gateHeading, { color: theme.text }]}>
            {t('account.signedOutHeading')}
          </Text>
          <Text style={[styles.gateBody, { color: theme.textMuted }]}>
            {t('account.signedOutBody')}
          </Text>
          <View style={styles.gateActions}>
            <Button label={t('common.signIn')} variant="primary" onPress={() => router.push('/login')} />
            <Button
              label={t('common.createAccount')}
              variant="secondary"
              onPress={() => router.push('/register')}
            />
          </View>
        </View>

        {/* Language and Appearance work signed out too — they are device
            preferences, not account data, so there is no reason to gate them. */}
        <View style={styles.gateSettings}>
          <SettingsSection title={t('account.sectionPreferences')}>
            <SettingsRow
              label={t('account.appearance')}
              icon="color-palette-outline"
              onPress={() => router.push('/account/appearance')}
            />
            <SettingsRow
              label={t('account.language')}
              icon="language-outline"
              value={currentLanguageLabel}
              onPress={() => router.push('/account/language')}
              isLast
            />
          </SettingsSection>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Signed in ───────────────────────────────────────────────────── */

  // Derived from the real role, never hard-coded: an agent signing in on mobile
  // must not be labelled "Member".
  const roleLabel = t(`accountInformation.roles.${user.role}`);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Masthead />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <ProfileHeader
          name={user.name}
          email={user.email}
          avatar={user.avatar || undefined}
          roleLabel={roleLabel}
          onPress={() => router.push('/account/personal-information')}
        />

        <SettingsSection title={t('account.sectionProfile')}>
          <SettingsRow
            label={t('account.personalInformation')}
            icon="person-outline"
            onPress={() => router.push('/account/personal-information')}
          />
          <SettingsRow
            label={t('account.profilePhoto')}
            icon="camera-outline"
            onPress={() => router.push('/account/profile-photo')}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t('account.sectionActivity')}>
          <SettingsRow
            label={t('account.propertyAlerts')}
            icon="notifications-outline"
            onPress={() => router.push('/notifications/alerts')}
          />
          <SettingsRow
            label={t('account.notifications')}
            icon="sparkles-outline"
            onPress={() => router.push('/notifications')}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t('account.sectionPreferences')}>
          <SettingsRow
            label={t('account.appearance')}
            icon="color-palette-outline"
            onPress={() => router.push('/account/appearance')}
          />
          <SettingsRow
            label={t('account.language')}
            icon="language-outline"
            value={currentLanguageLabel}
            onPress={() => router.push('/account/language')}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t('account.sectionSecurity')}>
          {/*
            Shown for every account, including Google/Microsoft ones — but the
            screen itself renders an explanation instead of a form when the
            account has no Varlikent password. Hiding the row entirely would
            leave a social customer with no way to learn WHY they cannot set one.
          */}
          <SettingsRow
            label={t('account.passwordSecurity')}
            icon="lock-closed-outline"
            value={hasLocalPassword(user) ? undefined : t(`accountInformation.providers.${user.provider}`)}
            onPress={() => router.push('/account/password')}
          />
          <SettingsRow
            label={t('account.accountInformation')}
            icon="information-circle-outline"
            onPress={() => router.push('/account/information')}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t('account.sectionAccount')}>
          <SettingsRow
            label={t('account.deleteAccount')}
            icon="trash-outline"
            onPress={() => router.push('/account/delete-account')}
            destructive
            isLast
          />
        </SettingsSection>

        {/*
          Sign Out sits outside a card as a deliberate full-width action, the way
          native settings screens separate "leave" from "configure". Uses the one
          AuthContext.logout() — which clears the token and flips status, and so
          also tears down the realtime socket and its AppState listener through
          RealtimeProvider's own cleanup.
        */}
        <Pressable
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel={t('account.signOut')}
          style={({ pressed }) => [
            styles.signOut,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            pressed && { backgroundColor: theme.marble },
          ]}>
          <Text style={[styles.signOutText, { color: theme.text }]}>{t('account.signOut')}</Text>
        </Pressable>

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

/** The Varlikent wordmark block, kept from the original Account screen. */
function Masthead() {
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();

  return (
    <View style={[styles.masthead, { borderBottomColor: theme.border }]}>
      <Text
        style={[
          styles.eyebrow,
          { color: theme.accentText, textAlign: isRTL ? 'right' : 'left' },
        ]}>
        {t('account.eyebrow')}
      </Text>
      <Text
        style={[styles.title, { color: theme.text, textAlign: isRTL ? 'right' : 'left' }]}>
        {t('account.title')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  masthead: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    marginTop: 2,
  },

  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  gateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    textAlign: 'center',
  },
  gateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: 'center',
  },
  gateActions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.lg },
  gateSettings: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  signOut: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
  },

  footnote: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    marginTop: Spacing.lg,
  },
});
