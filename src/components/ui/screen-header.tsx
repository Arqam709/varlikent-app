import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * THE HEADER EVERY NON-TAB SCREEN DRAWS.
 *
 * ── Why a component rather than a navigator option ──────────────────────
 * The root Stack sets `headerShown: false` globally (see app/_layout.tsx), so
 * there is no navigation header to configure — each screen draws its own. That
 * was being done nine separate times, with a byte-identical container and back
 * button in every one:
 *
 *   settings-ui.tsx AccountHeader   (7 account screens)
 *   services/index.tsx              services/[service].tsx
 *   properties/[id].tsx             messages/[id].tsx
 *   notifications/index.tsx         notifications/alerts/index.tsx
 *   notifications/alerts/edit.tsx   favourites/index.tsx
 *
 * Only three differences between them were real; the rest was drift. Those
 * three are the only props below beyond title and onBack.
 *
 * ── What this deliberately does NOT own ─────────────────────────────────
 * SAFE AREA. Every screen already wraps itself in
 * `<SafeAreaView edges={['top']}>` and places the header inside as a plain
 * row. Putting a second SafeAreaView here would double the inset on all nine.
 *
 * NAVIGATION. `onBack` is a callback, never a route, because the fallback
 * genuinely differs per screen — `/`, `/account`, `/properties`, `/services`,
 * `/notifications` and `/notifications/alerts` are all real fallbacks in use.
 * The `router.canGoBack() ? back() : replace(...)` decision stays with the
 * screen that knows where it sits.
 *
 * TRANSLATION. Callers pass already-translated strings. The one exception is
 * the back button's accessibility label, which is the same `common.back` on
 * every screen and is therefore not worth making nine callers repeat.
 */

type Props = {
  /** Already translated. Truncated to one line rather than wrapping the row. */
  title: string;
  /**
   * Runs when the back control is pressed.
   *
   * A callback rather than a route: see the note above on why the fallback
   * cannot be centralised.
   */
  onBack: () => void;
  /**
   * Optional second line under the title, e.g. the agent's role on a
   * conversation. Used by messages/[id]; omitted everywhere else.
   */
  subtitle?: string;
  /**
   * Optional controls at the trailing edge — a favourite toggle, a share
   * button, a link to alert settings. Laid out by the row's own `gap`, and
   * mirrored for free in RTL because the row direction flips.
   *
   * A ReactNode rather than a structured `actions` array: the two screens that
   * use it render different element types (properties/[id] passes a
   * FavouriteButton beside a Pressable) and both gate on their own state.
   */
  right?: ReactNode;
  /**
   * Which family the title is set in.
   *
   * `'body'` (Josefin Sans) is the default and covers eight of the nine
   * headers. `'heading'` (Cinzel) is what the seven account detail screens use,
   * matching the Cinzel masthead on the Account tab itself — a deliberate
   * house style for that section, not drift, so it is preserved rather than
   * flattened.
   */
  titleFont?: 'body' | 'heading';
};

export default function ScreenHeader({
  title,
  onBack,
  subtitle,
  right,
  titleFont = 'body',
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { row, textAlign, backIcon } = useDirection();

  return (
    <View style={[styles.header, { flexDirection: row }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={10}
        style={styles.backButton}>
        {/* Directional: back points the way you came, which flips in Arabic. */}
        <Ionicons name={backIcon} size={22} color={theme.text} />
      </Pressable>

      {/*
        `flex: 1` on the text block, not a margin, is what pushes `right` to
        the trailing edge — and it needs no direction-specific value, because
        the row itself is already reversed in RTL.
      */}
      <View style={styles.headerText}>
        <Text style={[styles.title, titleFont === 'heading' && styles.titleHeading, { textAlign }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { textAlign }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  /**
   * Values carried over unchanged from the nine implementations this replaces,
   * all of which already agreed on them exactly.
   */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { padding: Spacing.xs },
  headerText: { flex: 1 },
  title: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  /** Cinzel, for the account section. See the `titleFont` note above. */
  titleHeading: {
    fontFamily: FontFamily.headingSemiBold,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
});
