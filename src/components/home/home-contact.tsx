import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import CTABand from '@/components/ui/cta-band';
import { Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';

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
 *
 * ── Why the card itself is no longer written here ───────────────────────
 * It is the same composition the service pages now close with — marble card,
 * eyebrow, Cinzel heading, muted body, full-width primary action — so it moved
 * into ui/cta-band.tsx and this file passes copy to it. The rendered result is
 * unchanged; what is gone is a second copy of the styles that would eventually
 * have drifted from the service one.
 *
 * The outer padding stays HERE, because it is this section's place in Home's
 * scroll and not a property of the band.
 */
export default function HomeContact() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <View style={styles.section}>
      <CTABand
        eyebrow={t('home.contactEyebrow')}
        heading={t('home.contactHeading')}
        body={t('home.contactBody')}
        ctaLabel={t('home.contactCta')}
        onPress={() => router.push('/contact')}
      />
    </View>
  );
}

/**
 * Not themed, so a plain StyleSheet rather than `useThemedStyles`: spacing
 * carries no colour, and the band owns every token that does.
 */
const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
