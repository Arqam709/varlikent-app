import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

export type ActionSheetAction = {
  key: string;
  /** Already translated. */
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Drawn in the danger colour. For irreversible actions such as Delete. */
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  /** Already translated. Optional — a one-action menu rarely needs a heading. */
  title?: string;
  actions: ActionSheetAction[];
  /** Backdrop, Cancel, and the Android back button all call this. */
  onClose: () => void;
};

/**
 * A short list of actions for one thing the user long-pressed.
 *
 * Built exactly like the app's other sheets (Near Me radius, property filters):
 * React Native's own Modal, slide animation, tap the backdrop to dismiss — no
 * sheet library, and no second sheet idiom to learn.
 *
 * ── Why an action runs AFTER the sheet has closed ───────────────────────
 * The common next step is a confirmation Alert. iOS refuses to present an
 * Alert while a Modal is still animating away, so the chosen action is held
 * until the Modal reports it is gone (`onDismiss`, iOS only) — on Android,
 * where that callback does not exist and there is no such conflict, it runs as
 * soon as the sheet is hidden. Callers therefore never need a timeout.
 */
export default function ActionSheet({ visible, title, actions, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { row, textAlign } = useDirection();
  const insets = useSafeAreaInsets();

  const pending = useRef<(() => void) | null>(null);

  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  useEffect(() => {
    if (visible || Platform.OS === 'ios') return;
    const action = pending.current;
    pending.current = null;
    action?.();
  }, [visible]);

  const choose = (action: ActionSheetAction) => {
    pending.current = action.onPress;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={runPending}>
      <View style={styles.backdropWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
          {title ? (
            <Text style={[styles.title, { textAlign }]} accessibilityRole="header">
              {title}
            </Text>
          ) : null}

          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => choose(action)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.option,
                { flexDirection: row },
                pressed && styles.optionPressed,
              ]}>
              {action.icon ? (
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? theme.danger : theme.primaryInk}
                />
              ) : null}
              <Text
                style={[
                  styles.optionText,
                  action.destructive && styles.optionTextDestructive,
                  { textAlign },
                ]}>
                {action.label}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    backdropWrap: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,30,28,0.45)' },
    sheet: {
      backgroundColor: theme.softWhite,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    title: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.md,
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    option: {
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      minHeight: 52,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    optionPressed: { backgroundColor: theme.marble },
    /** `flex: 1` so a long German or Russian label wraps instead of clipping. */
    optionText: {
      flex: 1,
      fontFamily: FontFamily.bodyMedium,
      fontSize: FontSizes.md,
      color: theme.text,
      paddingVertical: Spacing.sm,
    },
    optionTextDestructive: { color: theme.danger },
    cancel: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      borderRadius: Radius.md,
      marginTop: Spacing.xs,
    },
    cancelText: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.md,
      color: theme.textMuted,
    },
  });
