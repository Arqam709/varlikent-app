import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { serviceRequestStatusKey, type ServiceRequestStatus } from '@/features/service-requests/service-request';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/** Submitted / Contacted / Closed, from the request's linked lead. */
export default function StatusBadge({ status }: { status: ServiceRequestStatus }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  return (
    <View style={[styles.badge, status === 'contacted' && styles.contacted, status === 'closed' && styles.closed]}>
      <Text style={[styles.text, status === 'contacted' && styles.contactedText]}>{t(serviceRequestStatusKey(status))}</Text>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: theme.primaryInk,
      backgroundColor: theme.marble,
    },
    contacted: { backgroundColor: theme.primary, borderColor: theme.primary },
    closed: { borderColor: theme.border, backgroundColor: theme.cardBg },
    text: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.overline,
      letterSpacing: LetterSpacing.wide,
      textTransform: 'uppercase',
      color: theme.primaryInk,
    },
    contactedText: { color: theme.primaryText },
  });
