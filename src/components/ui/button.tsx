import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';

/**
 * VARLIKENT BUTTON
 *
 * Extracted because the Home screen needs three buttons across two looks —
 * the point at which duplication is real rather than predicted.
 *
 * `Pressable` is React Native's touch target. Unlike a web <button> it carries
 * no styling, no semantics and no hover — touch has no hover state, so the
 * only feedback available is `pressed`, which Pressable hands to both `style`
 * and children as a render prop.
 */

type Variant = 'primary' | 'secondary' | 'outlineLight';

type Props = {
  label: string;
  /**
   * `primary`      filled green — the action.
   * `secondary`    outlined, dark text — for light backgrounds.
   * `outlineLight` outlined, light text — for dark backgrounds such as the
   *                hero image, where `secondary` would be invisible. Matches
   *                the website hero's second CTA (1px rgba(246,243,237,0.3)).
   */
  variant?: Variant;
  /** Omit to render a non-interactive visual placeholder. */
  onPress?: () => void;
  /**
   * Extra context for screen readers, e.g. explaining that a control is not
   * functional yet. Announced after the label.
   */
  accessibilityHint?: string;
  /** Shows a spinner and blocks presses — prevents duplicate submissions. */
  loading?: boolean;
  disabled?: boolean;
  /** Shown in place of `label` while loading, e.g. "Signing In...". */
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  label,
  variant = 'primary',
  onPress,
  accessibilityHint,
  loading = false,
  disabled = false,
  loadingLabel,
  style,
}: Props) {
  const isPrimary = variant === 'primary';
  const isOutlineLight = variant === 'outlineLight';
  /**
   * A loading button is also a disabled button. Passing this to Pressable's
   * `disabled` is what actually stops a second tap from firing a second
   * request — hiding the handler visually would not be enough.
   */
  const isBlocked = loading || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      // Tells screen readers this is a button — Pressable is just a View, so
      // without this it is announced as plain content.
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      /**
       * `style` accepts a FUNCTION receiving { pressed }. This is the native
       * replacement for CSS :active / :hover, and it is why the press feedback
       * works even when no onPress is attached.
       */
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === 'secondary' && styles.secondary,
        isOutlineLight && styles.outlineLight,
        pressed &&
          !isBlocked &&
          (isPrimary
            ? styles.primaryPressed
            : isOutlineLight
              ? styles.outlineLightPressed
              : styles.secondaryPressed),
        isBlocked && styles.blocked,
        style,
      ]}>
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={isPrimary || isOutlineLight ? Colors.textOnDark : Colors.brandGreen}
          />
        )}
        <Text
          style={[
            styles.label,
            isPrimary && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            isOutlineLight && styles.labelOutlineLight,
          ]}>
          {loading ? (loadingLabel ?? label) : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full, // pill
    alignItems: 'center',
    justifyContent: 'center',
    // 48dp is the minimum comfortable touch target on both platforms.
    minHeight: 52,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  primaryPressed: {
    backgroundColor: Colors.primaryPressed,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryPressed: {
    backgroundColor: Colors.marble,
  },
  /** For dark backgrounds. Border matches the website hero's rgba(246,243,237,0.3). */
  outlineLight: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(246,243,237,0.3)',
  },
  outlineLightPressed: {
    backgroundColor: 'rgba(246,243,237,0.12)',
  },
  /** Dimmed while loading or disabled, so the blocked state is visible. */
  blocked: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
  },
  labelPrimary: {
    color: Colors.primaryText,
  },
  labelSecondary: {
    color: Colors.text,
  },
  labelOutlineLight: {
    color: Colors.textOnDark,
  },
});
