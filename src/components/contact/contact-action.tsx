import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { openFirstAvailable } from '@/utils/open-external-url';

/**
 * ONE TAP, ONE CHANNEL.
 *
 * A row that opens a `tel:`, `mailto:`, `wa.me` or maps URL. Used for every
 * company-level contact action on the Contact screen.
 *
 * ── Why it takes a URL rather than a number ─────────────────────────────
 * Building the URL is a data problem with real edge cases — a stored '+' that
 * wa.me rejects, a cleared field, an admin who pasted a whole link — and it is
 * solved once, in `utils/contact-links.ts`, where it is unit tested without a
 * device. This component's only job is presentation and the OS handoff.
 *
 * The division also gives the screen the behaviour it wants for free: a
 * builder returns `null` when a setting is missing, and the screen renders
 * nothing rather than a button that opens an empty dialer.
 *
 * ── Opening is an ATTEMPT, not a question ───────────────────────────────
 * This used to ask `Linking.canOpenURL` first and treat a false as "not
 * available". That produced false negatives on both platforms — see the note
 * in utils/open-external-url.ts — so the WhatsApp and Email rows could report
 * themselves unavailable on a phone that had both apps installed.
 *
 * `openFirstAvailable` attempts each candidate instead and reports failure only
 * when every one is genuinely refused. That is also what lets a single row
 * express "open WhatsApp, or the web version if it is not installed".
 */

type Props = {
  /** Already translated, e.g. "WhatsApp". */
  label: string;
  /**
   * The line under the label — usually the value itself (the phone number,
   * the email address), so the customer can read it even if the tap fails.
   */
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * A ready-to-open URL from `utils/contact-links.ts`, or an ORDERED list of
   * candidates tried until one opens.
   *
   * The list form is what makes "native app, else web" one action rather than
   * two: WhatsApp passes `[whatsapp://…, https://wa.me/…]`, while Call and
   * Email pass a single string. The caller is expected to have skipped
   * rendering this component when the builder produced nothing, so there is
   * always at least one real URL here.
   */
  url: string | readonly string[];
  /**
   * Announced to screen readers instead of "label, value".
   *
   * Written by the caller because "Call Varlikent on +90 533…" reads as one
   * intention, whereas the two visible strings read as two disconnected
   * fragments.
   */
  accessibilityLabel: string;
  /**
   * Called when the OS has no handler for ANY of the candidates.
   *
   * A callback rather than an Alert raised here: the Contact screen already
   * owns an error area, and one place showing failures is easier to translate
   * and easier to read than a modal per row.
   */
  onUnavailable: () => void;
};

export default function ContactAction({
  label,
  value,
  icon,
  url,
  accessibilityLabel,
  onUnavailable,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign, forwardIcon } = useDirection();

  const handlePress = async () => {
    const opened = await openFirstAvailable(typeof url === 'string' ? [url] : url);

    // Never thrown: a device with no mail client is an ordinary state of the
    // world, not an app failure. The caller keeps the value visible as text so
    // the customer can still reach the company by hand.
    if (!opened) onUnavailable();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.action,
        { flexDirection: row },
        pressed && styles.actionPressed,
      ]}>
      <View style={styles.iconBox}>
        {/*
          Decorative: the Pressable already carries the role and the label, so
          the icon must not be announced as a second element.
        */}
        <Ionicons name={icon} size={20} color={theme.primaryInk} />
      </View>

      <View style={styles.text}>
        <Text style={[styles.label, { textAlign }]}>{label}</Text>
        <Text style={[styles.value, { textAlign }]} numberOfLines={1}>
          {value}
        </Text>
      </View>

      <Ionicons name={forwardIcon} size={18} color={theme.textMuted} />
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  /**
   * Matches the Buy/Rent cards on Home (home-discovery.tsx) — same 72dp row,
   * same 40dp marble icon box, same pressed treatment. Contact is a new screen
   * but not a new visual language.
   */
  action: {
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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  label: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  value: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
    marginTop: 2,
  },
});
