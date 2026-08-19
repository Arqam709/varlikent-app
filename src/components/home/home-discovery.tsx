import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';

/**
 * HOME DISCOVERY
 *
 * The intent-capture block: a search launcher and the Buy / Rent entry points.
 *
 * ── Why nothing here is a filter ─────────────────────────────────────────
 * Home captures INTENT; Properties owns SEARCH STATE. Everything below is a
 * one-shot launcher that hands Properties a starting position and then gets
 * out of the way. Nothing here holds state, and no request is made — this
 * whole section is navigation.
 *
 * That is also why the search bar is a Pressable and NOT a TextInput. Two
 * independent search inputs would mean two states to keep in sync, a keyboard
 * opening over the hero, and two places for bugs to live. When real text
 * search lands in Properties, this launcher opens that screen with the input
 * focused — a one-line change from here.
 */
export default function HomeDiscovery() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{t('home.discoverEyebrow')}</Text>
      <Text style={styles.heading}>{t('home.discoverTitle')}</Text>

      {/*
        Looks like a search field, behaves like a link. `accessibilityRole` is
        "button", never "search"/"text", so a screen reader never announces an
        editable field the user cannot type into.
      */}
      <Pressable
        onPress={() => router.push('/properties')}
        accessibilityRole="button"
        accessibilityLabel="Search properties. Opens the properties list."
        style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <Text style={styles.searchText}>{t('home.searchPlaceholder')}</Text>
      </Pressable>

      {/*
        Stacked rather than side by side. At 360dp a two-column layout leaves
        each card ~156dp, which forces "Explore properties for sale" onto three
        cramped lines. Full width keeps every subtitle on one line and reads
        more editorial — the point of these being cards rather than buttons.
      */}
      <View style={styles.actions}>
        <QuickAction
          icon="home-outline"
          title={t('home.buyTitle')}
          subtitle={t('home.buySubtitle')}
          onPress={() =>
            router.push({ pathname: '/properties', params: { listingType: 'Sale' } })
          }
        />
        <QuickAction
          icon="key-outline"
          title={t('home.rentTitle')}
          subtitle={t('home.rentSubtitle')}
          onPress={() =>
            router.push({ pathname: '/properties', params: { listingType: 'Rent' } })
          }
        />
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Both title and subtitle in one label, so the destination is announced
      // as a single intent rather than two disconnected fragments.
      accessibilityLabel={`${title}. ${subtitle}.`}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={theme.primaryInk} />
      </View>

      {/* `flex: 1` lets the text block absorb the row and wrap if it must. */}
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    // Breathing room before the full-bleed marble stats band that follows.
    paddingBottom: Spacing.xl,
  },
  /**
   * Green rather than gold. The hero already carries a gold eyebrow and rule,
   * and the stats strip a gold hairline — a third gold accent in one screen
   * would stop reading as restraint.
   */
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.primaryInk,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginTop: Spacing.xs,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    // Matches the height of a real input, so it reads as one at a glance.
    minHeight: 52,
  },
  searchBarPressed: {
    borderColor: theme.brandGreen,
  },
  searchText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    color: theme.textMuted,
  },

  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
  },
  actionPressed: {
    borderColor: theme.brandGreen,
    backgroundColor: theme.marble,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  actionSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
    marginTop: 2,
  },
});
