import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
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
  const { row, textAlign } = useDirection();
  const router = useRouter();

  return (
    <View style={styles.section}>
      <SectionHeader eyebrow={t('home.discoverEyebrow')} title={t('home.discoverTitle')} />

      {/*
        Looks like a search field, behaves like a link. `accessibilityRole` is
        "button", never "search"/"text", so a screen reader never announces an
        editable field the user cannot type into.
      */}
      <View style={[styles.searchRow, { flexDirection: row }]}>
        <Pressable
          onPress={() => router.push('/properties')}
          accessibilityRole="button"
          accessibilityLabel={t('home.searchA11y')}
          style={({ pressed }) => [
            styles.searchBar,
            { flexDirection: row },
            pressed && styles.searchBarPressed,
          ]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <Text style={[styles.searchText, { textAlign }]} numberOfLines={1}>
            {t('home.searchPlaceholder')}
          </Text>
        </Pressable>

        {/*
          Straight to the map, the one way of browsing a phone does better than
          the website. No params, so it opens on every listing — the same
          starting point as the search launcher — and Near Me is one tap away
          there. Pushed over Home, so Back returns here.
        */}
        <Pressable
          onPress={() => router.push('/properties/map')}
          accessibilityRole="button"
          accessibilityLabel={t('home.mapA11y')}
          style={({ pressed }) => [styles.mapButton, pressed && styles.searchBarPressed]}>
          <Ionicons name="map-outline" size={20} color={theme.primaryInk} />
        </Pressable>
      </View>

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
  const { row, textAlign, forwardIcon } = useDirection();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Both title and subtitle in one label, so the destination is announced
      // as a single intent rather than two disconnected fragments.
      accessibilityLabel={`${title}. ${subtitle}.`}
      style={({ pressed }) => [
        styles.action,
        { flexDirection: row },
        pressed && styles.actionPressed,
      ]}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={theme.primaryInk} />
      </View>

      {/* `flex: 1` lets the text block absorb the row and wrap if it must. */}
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { textAlign }]}>{title}</Text>
        <Text style={[styles.actionSubtitle, { textAlign }]}>{subtitle}</Text>
      </View>

      {/* Directional: the chevron points the way the language reads. */}
      <Ionicons name={forwardIcon} size={18} color={theme.textMuted} />
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
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    // Matches the height of a real input, so it reads as one at a glance.
    minHeight: 52,
  },
  /** Square, and the search bar's height, so the two read as one control row. */
  mapButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
  },
  searchBarPressed: {
    borderColor: theme.brandGreen,
  },
  searchText: {
    flex: 1,
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
