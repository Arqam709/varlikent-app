import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';

/**
 * VARLIKENT TEXT FIELD
 *
 * Label + input, with an optional accessory on the right of the label row
 * (used for "Forgot password?") and built-in password masking.
 *
 * Justified by real repetition: six inputs across Login and Register, all
 * sharing the same label/border/focus treatment. Deliberately NOT a form
 * system — no validation, no schema, no context.
 */

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Masks input and adds a Show/Hide toggle. */
  secure?: boolean;
  /** Rendered at the right end of the label row, e.g. a "Forgot password?" link. */
  labelAccessory?: ReactNode;
  /**
   * Grows the field into a multi-line box, for a message rather than a value.
   *
   * Added for the Contact enquiry, which is the app's first free-text field.
   * It changes THREE things that a plain `multiline` flag alone would get
   * wrong on this component: the row stops being vertically centred (so the
   * caret starts at the top rather than floating mid-box), the input gets a
   * minimum height, and `textAlignVertical` is set for Android, which
   * otherwise centres the first line regardless of the flex alignment.
   */
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
};

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  labelAccessory,
  multiline = false,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  /**
   * React Native has no CSS `:focus`, so the focus ring the website gets for
   * free has to be tracked as state and applied manually.
   */
  const [focused, setFocused] = useState(false);

  /** Only meaningful when `secure` — whether the password is currently shown. */
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAccessory}
      </View>

      <View
        style={[
          styles.inputRow,
          multiline && styles.inputRowMultiline,
          focused && styles.inputRowFocused,
        ]}>
        <TextInput
          value={value}
          /**
           * `onChangeText` hands over the STRING directly — unlike web's
           * onChange, which hands over an event you must read `.target.value`
           * from. That is why the setter can be passed by reference.
           */
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          /**
           * `secureTextEntry` is <input type="password">: it masks the text and
           * tells the OS to skip autocorrect and not learn the word.
           */
          secureTextEntry={secure && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCorrect={false}
          multiline={multiline}
          // Android centres the first line of a multiline input without this,
          // so a one-line message sits oddly in the middle of the box.
          textAlignVertical={multiline ? 'top' : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.inputMultiline]}
        />

        {secure && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            // Expands the touch target beyond the small text without changing layout.
            hitSlop={8}>
            <Text style={styles.toggle}>{revealed ? t('common.hide') : t('common.show')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    backgroundColor: theme.cardBg,
    paddingHorizontal: Spacing.md,
  },
  /**
   * A multi-line box aligns its content to the top: `alignItems: 'center'`
   * would keep a growing input vertically centred, which reads as a bug once
   * the text wraps.
   */
  inputRowMultiline: {
    alignItems: 'flex-start',
  },
  /** Stands in for the website's `focus:ring-[#4b6741]`. */
  inputRowFocused: {
    borderColor: theme.brandGreen,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    color: theme.text,
    paddingVertical: Spacing.md,
  },
  /** ~4 lines at the body size — enough to see an enquiry take shape. */
  inputMultiline: {
    minHeight: 112,
  },
  toggle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    color: theme.primaryInk,
  },
});
