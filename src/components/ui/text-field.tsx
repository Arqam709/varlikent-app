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

import { Colors, FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';

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
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
}: Props) {
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

      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <TextInput
          value={value}
          /**
           * `onChangeText` hands over the STRING directly — unlike web's
           * onChange, which hands over an event you must read `.target.value`
           * from. That is why the setter can be passed by reference.
           */
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />

        {secure && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            // Expands the touch target beyond the small text without changing layout.
            hitSlop={8}>
            <Text style={styles.toggle}>{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: Colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardBg,
    paddingHorizontal: Spacing.md,
  },
  /** Stands in for the website's `focus:ring-[#4b6741]`. */
  inputRowFocused: {
    borderColor: Colors.brandGreen,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  toggle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.brandGreen,
  },
});
