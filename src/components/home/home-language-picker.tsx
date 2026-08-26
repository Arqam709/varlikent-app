import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import {
  LANGUAGES,
  getLanguageMeta,
  useLanguage,
  type LanguageCode,
} from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';


export default function HomeLanguagePicker() {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);

  const current = getLanguageMeta(language);

  const handleSelect = (code: LanguageCode) => {
    
    void setLanguage(code);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('language.changeA11y', { language: current.label })}
        hitSlop={10}
        style={({ pressed }) => [
          styles.trigger,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
          pressed && styles.triggerPressed,
        ]}>
        <Ionicons name="globe-outline" size={20} color={theme.text} />
        {/* A two-letter code reads the same in every script. */}
        <Text style={styles.triggerCode}>{language.toUpperCase()}</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        // Android hardware back closes the sheet.
        onRequestClose={() => setOpen(false)}>
        <View style={styles.backdropWrap}>
          {/* Tapping outside dismisses, matching the platform convention. */}
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />

          {/* Padded past the gesture bar / home indicator. */}
          <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View
              style={[
                styles.sheetHeader,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}>
              <Text style={[styles.sheetTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('language.title')}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
            {LANGUAGES.map((entry, index) => {
              const selected = entry.code === language;

              return (
                <Pressable
                  key={entry.code}
                  onPress={() => handleSelect(entry.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  // The English name, so a screen reader announces something it
                  // can pronounce; the VISIBLE name stays native.
                  accessibilityLabel={entry.englishLabel}
                  style={({ pressed }) => [
                    styles.row,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                    index < LANGUAGES.length - 1 && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}>
                  {/*
                    `entry.label`, never a translated name. Someone stranded in
                    a language they cannot read has to recognise their own —
                    "Turkish" is no help to a person looking for "Türkçe".
                  */}
                  <Text
                    style={[
                      styles.rowLabel,
                      selected && styles.rowLabelSelected,
                      { textAlign: isRTL ? 'right' : 'left' },
                    ]}>
                    {entry.label}
                  </Text>

                  {selected ? (
                    <Ionicons name="checkmark" size={20} color={theme.primaryInk} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  /** Compact in the header; hitSlop takes the touch target past 44dp. */
  trigger: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  triggerPressed: { opacity: 0.6 },
  triggerCode: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: 1,
    color: theme.text,
  },

  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,30,28,0.45)' },
  sheet: {
    backgroundColor: theme.softWhite,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  sheetHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rowPressed: { backgroundColor: theme.marble },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  rowLabelSelected: { fontFamily: FontFamily.bodySemiBold },
});
