import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';

export default function AccountScreen() {
  const router = useRouter();
  const { user, status, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Varlikent</Text>
        <Text style={styles.title}>Account</Text>
        <View style={styles.goldRule} />

        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.brandGreen} />
          </View>
        ) : status === 'authenticated' ? (
          <SignedIn
            name={user?.name ?? ''}
            email={user?.email ?? ''}
            onSignOut={logout}
          />
        ) : (
          <SignedOut
            onSignIn={() => router.push('/login')}
            onCreateAccount={() => router.push('/register')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Entry point for a visitor who is not signed in. */
function SignedOut({
  onSignIn,
  onCreateAccount,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>Welcome to Varlikent</Text>
      <Text style={styles.body}>Sign in to save properties and manage your account.</Text>

      <View style={styles.buttons}>
        <Button label="Sign In" variant="primary" onPress={onSignIn} />
        <Button label="Create Account" variant="secondary" onPress={onCreateAccount} />
      </View>
    </View>
  );
}

/** Minimal identity summary. Profile editing, favourites and settings come later. */
function SignedIn({
  name,
  email,
  onSignOut,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
}) {
  /**
   * A plain initial circle rather than the avatar. `avatar` exists on SafeUser
   * but is an empty string for every email/password account, so rendering it
   * would mean a broken-image state for exactly the users we can test with.
   * The initial always works and needs no network request.
   */
  const initial = (name || email).trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.block}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.identityText}>
          {name ? (
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          ) : null}
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        </View>
      </View>

      {/*
        Signing out does not navigate. The user stays on /account and this
        screen re-renders into the signed-out branch, which is the least
        surprising outcome — they asked to sign out, not to go somewhere.
      */}
      <View style={styles.buttons}>
        <Button label="Sign Out" variant="secondary" onPress={onSignOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.softWhite,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: Colors.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.xl,
    color: Colors.charcoal,
    marginTop: Spacing.xs,
  },
  goldRule: {
    width: 56,
    height: 1,
    backgroundColor: Colors.gold,
    marginVertical: Spacing.lg,
  },
  loading: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  block: {
    gap: Spacing.md,
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
  },
  buttons: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.primaryText,
  },
  /** `flex: 1` lets the long email truncate instead of overflowing the card. */
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.charcoal,
  },
  email: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
});
