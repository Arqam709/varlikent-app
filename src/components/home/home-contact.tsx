import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/button';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';

/**
 * HOME → CONTACT
 *
 * The entry point, and deliberately nothing more.
 *
 * ── Why the company details are NOT here ────────────────────────────────
 * Putting the phone number, WhatsApp button and address on Home would mean a
 * second /api/settings request on the app's busiest screen, a second place
 * those values can be shown stale, and a Home screen that ends in a wall of
 * contact chrome. Home already carries a hero, discovery, a featured carousel
 * and four service tiles; its job here is to say the channel EXISTS.
 *
 * So this is a heading, two lines, and one button. Everything else lives on
 * /contact, where there is room for it and where it is fetched once.
 *
 * ── Why it sits last ────────────────────────────────────────────────────
 * "Need help?" is the question someone has AFTER browsing, not before. It
 * follows the services preview so the scroll ends on an offer of help rather
 * than on a grid the customer has already read.
 */
export default function HomeContact() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();
  const router = useRouter();

  return (
    <View style={styles.section}>
      {/*
        A card rather than a bare band, so the section reads as one offer and
        not as a fourth run of body copy. Marble is the same quiet ground the
        service tiles use.
      */}
      <View style={styles.card}>
        <SectionHeader
          eyebrow={t('home.contactEyebrow')}
          title={t('home.contactHeading')}
        />

        <Text style={[styles.body, { textAlign }]}>{t('home.contactBody')}</Text>

        <Button
          label={t('home.contactCta')}
          variant="primary"
          onPress={() => router.push('/contact')}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  card: {
    backgroundColor: theme.marble,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: Spacing.lg,
  },
});
