import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/** [label, value] — both already translated. Empty values are skipped. */
export type SummaryRow = [string, string];

/**
 * A titled card of label/value rows — the request form's Review step and the
 * request detail screen show the same facts the same way.
 */
export default function SummaryCard({ title, rows }: { title: string; rows: readonly SummaryRow[] }) {
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();
  const visible = rows.filter(([, value]) => value.trim() !== '');
  if (visible.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={[styles.title, { textAlign }]} accessibilityRole="header">
        {title}
      </Text>
      {visible.map(([label, value], index) => (
        <View
          key={`${label}-${index}`}
          style={[styles.row, index === visible.length - 1 && styles.rowLast]}
          accessible
          accessibilityLabel={`${label}: ${value}`}>
          <Text style={[styles.label, { textAlign }]}>{label}</Text>
          <Text style={[styles.value, { textAlign }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    card: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
    },
    title: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.md,
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    row: {
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 2,
    },
    rowLast: { borderBottomWidth: 0, paddingBottom: Spacing.md },
    label: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.overline,
      letterSpacing: LetterSpacing.wide,
      textTransform: 'uppercase',
      color: theme.textMuted,
    },
    value: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      lineHeight: 20,
      color: theme.text,
    },
  });
