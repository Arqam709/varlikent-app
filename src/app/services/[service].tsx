import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CTABand from '@/components/ui/cta-band';
import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import {
  capabilityNumeral,
  getService,
  serviceKey,
  type ServiceStructure,
} from '@/features/services/services-data';

export default function ServiceDetailScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { service: serviceParam } = useLocalSearchParams<{ service?: string }>();
  const router = useRouter();

  /** Validated, never cast — see getServiceById. */
  const service = getService(serviceParam);

  const handleBack = () => {
    // Uses real history, so Home → tile → Back lands on Home, while
    // Home → Services → tile → Back lands on Services.
    if (router.canGoBack()) router.back();
    else router.replace('/services');
  };

  /**
   * Opens the lead form with this service's reason already chosen.
   *
   * ── push, never replace ─────────────────────────────────────────────────
   * `push` keeps this page on the stack, so Contact's own Back returns to the
   * service the customer was reading — Services → Renovation → Contact → Back
   * → Renovation. `replace` would drop Renovation from history and land Back
   * on Services, which is the wrong place and would also make Contact's
   * existing `canGoBack()` fallback fire for no reason.
   *
   * Contact therefore needs NO service-specific back logic; ordinary history
   * is already correct, and its `router.canGoBack() ? back() : replace('/')`
   * fallback stays untouched for the deep-link case it was written for.
   *
   * ── The stable id travels, not a label ──────────────────────────────────
   * `service.contactInterestId` is a stable id from the backend's shared
   * contact contract ('interior_design'). The Contact screen resolves it
   * against the served list and submits that entry's legacy value, so a
   * Turkish customer reading "Tadilat" still sends "Renovation". Passing
   * `t(...)` here is precisely the bug the website once shipped.
   *
   * The param keeps its old name, `interestType`, so older links that carry a
   * legacy value ('Interior Design') still resolve on the Contact screen.
   */
  const openContact = () => {
    if (!service) return;

    router.push({
      pathname: '/contact',
      params: { interestType: service.contactInterestId },
    });
  };

  if (!service) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('services.title')} onBack={handleBack} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>{t('services.notFound')}</Text>
          <Text style={styles.notFoundBody}>
            {t('services.notFound')}
          </Text>
          <Pressable
            onPress={() => router.replace('/services')}
            accessibilityRole="button"
            accessibilityLabel={t('services.backToServices')}
            style={({ pressed }) => [styles.notFoundAction, pressed && styles.pressedOutline]}>
            <Text style={styles.notFoundActionText}>{t('services.backToServices')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Names the destination of Back, not the current page. */}
      <ScreenHeader title={t('services.title')} onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ServiceHero service={service} />

        <Capabilities service={service} />

        {service.processSteps > 0 ? (
          <Section
            eyebrow={t('services.howWeWork')}
            heading={t(serviceKey(service, 'process.heading'))}>
            <View style={styles.steps}>
              {Array.from({ length: service.processSteps }, (_, index) => (
                <View key={index} style={styles.step}>
                  <Text style={styles.stepNumber}>{capabilityNumeral(index)}</Text>
                  <Text style={styles.stepLabel}>
                    {t(serviceKey(service, `process.steps.s${index + 1}`))}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {service.comparisonRows > 0 ? (
          <Section
            eyebrow={t('services.theTransformation')}
            heading={t(serviceKey(service, 'comparison.heading'))}>
            <View style={styles.compare}>
              <CompareColumn
                label={t(serviceKey(service, 'comparison.beforeLabel'))}
                items={Array.from({ length: service.comparisonRows }, (_, i) =>
                  t(serviceKey(service, `comparison.before.b${i + 1}`))
                )}
                muted
              />
              <CompareColumn
                label={t(serviceKey(service, 'comparison.afterLabel'))}
                items={Array.from({ length: service.comparisonRows }, (_, i) =>
                  t(serviceKey(service, `comparison.after.a${i + 1}`))
                )}
              />
            </View>
          </Section>
        ) : null}

        {service.hasNote ? (
          <Section
            eyebrow={t(serviceKey(service, 'note.eyebrow'))}
            heading={t(serviceKey(service, 'note.heading'))}>
            <Text style={styles.noteBody}>{t(serviceKey(service, 'note.body'))}</Text>
          </Section>
        ) : null}

        {/*
          The closing statement, now with the button it was always written for.

          It used to be an editorial sign-off with no action, because the
          contact destination did not exist. It does now — so the SAME copy
          becomes the band's heading and body, rather than being replaced by
          new CTA prose. That was deliberate: every one of these four lines
          already reads as an invitation ("Contact us to discuss your project",
          "Book a complimentary 30-minute consultation"), so writing fresh
          headings would have meant 48 new strings saying what these already
          say, in six languages, with two versions to keep in step.

          Only the eyebrow and the button label are new — and the eyebrow is
          ONE shared key rather than four, because "Get Started" is the same
          invitation whichever service you arrived from. The label is
          per-service, because "Start Your Renovation" and "Book a
          Consultation" are genuinely different promises.
        */}
        <CTABand
          eyebrow={t('services.ctaEyebrow')}
          heading={t(serviceKey(service, 'closingHeading'))}
          body={t(serviceKey(service, 'closingBody'))}
          ctaLabel={t(serviceKey(service, 'ctaLabel'))}
          /*
            Names the destination and what will already be filled in, so the
            tap holds no surprise. The visible label stays the button's
            accessibilityLabel — see the note on CTABand's prop.
          */
          accessibilityHint={t('services.ctaAccessibility', {
            service: t(serviceKey(service, 'title')),
          })}
          onPress={openContact}
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function ServiceHero({ service }: { service: ServiceStructure }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.hero}>
      {/*
        The hero keeps its own type rather than using SectionHeader: its title
        is 30/38, larger than either SectionHeader size, and its gold rule sits
        below the subtitle rather than under the heading. Sharing the component
        here would need two props to describe one screen.
      */}
      <Text style={styles.heroLabel}>{t(serviceKey(service, 'websiteLabel'))}</Text>
      <Text style={styles.heroTitle}>{t(serviceKey(service, 'title'))}</Text>
      <Text style={styles.heroSubtitle}>{t(serviceKey(service, 'description'))}</Text>

      {/*
        An icon rather than photography, for all four alike.

        Only three of the four have an approved static image — Renovation has
        none, and the website's service pages source imagery from an
        admin-managed showroom API. Three photos plus one placeholder would
        look broken, and inventing a Renovation image would fabricate a brand
        association. Consistency wins until real imagery exists.
      */}
      <View style={styles.heroIcon}>
        <Ionicons name={service.icon} size={30} color={theme.primaryInk} />
      </View>

      <View style={styles.goldRule} />
    </View>
  );
}

function Capabilities({ service }: { service: ServiceStructure }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  return (
    <Section
      eyebrow={t(serviceKey(service, 'capabilitiesLabel'))}
      heading={t(serviceKey(service, 'capabilitiesHeading'))}>
      <View style={styles.capabilities}>
        {service.capabilities.map((slug, index) => (
          <View key={slug} style={styles.capability}>
            <Text style={styles.capabilityNum}>{capabilityNumeral(index)}</Text>
            <View style={styles.capabilityText}>
              <Text style={styles.capabilityTitle}>
                {t(serviceKey(service, `caps.${slug}.title`))}
              </Text>
              <Text style={styles.capabilityDesc}>
                {t(serviceKey(service, `caps.${slug}.desc`))}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

function CompareColumn({
  label,
  items,
  muted = false,
}: {
  label: string;
  items: string[];
  muted?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.compareColumn}>
      <Text style={[styles.compareLabel, !muted && styles.compareLabelAfter]}>{label}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.compareItem}>
          {item}
        </Text>
      ))}
    </View>
  );
}

function Section({
  eyebrow,
  heading,
  children,
}: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      {/*
        The muted tone is used because these sections sit UNDER a hero that
        already carries a brand-coloured eyebrow — quietening them is the
        page's own hierarchy, not an oversight.
      */}
      <SectionHeader eyebrow={eyebrow} title={heading} tone="muted" style={styles.sectionHeader} />
      {children}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  scroll: { paddingBottom: Spacing.xxl },

  // ── Hero ─────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  heroLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.primaryInk,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 30,
    lineHeight: 38,
    color: theme.text,
    marginTop: Spacing.sm,
  },
  heroSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    lineHeight: 25,
    color: theme.textMuted,
    marginTop: Spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  goldRule: {
    width: 56,
    height: 1,
    backgroundColor: theme.gold,
    marginTop: Spacing.lg,
  },

  // ── Sections ─────────────────────────────────────────────────────
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  /**
   * The gap the old sectionHeading style carried as its own marginBottom.
   * Moved onto the wrapper because SectionHeader owns no outer spacing.
   */
  sectionHeader: { marginBottom: Spacing.lg },

  // ── Capabilities ─────────────────────────────────────────────────
  capabilities: { gap: Spacing.lg },
  capability: { flexDirection: 'row', gap: Spacing.md },
  capabilityNum: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    color: theme.accentText,
    letterSpacing: LetterSpacing.wide,
    // Fixed width keeps the numerals in a clean column as text wraps.
    width: 28,
    paddingTop: 2,
  },
  capabilityText: { flex: 1 },
  capabilityTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  capabilityDesc: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    marginTop: Spacing.xs,
  },

  // ── Process ──────────────────────────────────────────────────────
  steps: { gap: Spacing.sm },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: theme.marble,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  stepNumber: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    color: theme.primaryInk,
    width: 24,
  },
  stepLabel: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: theme.text,
  },

  // ── Before / After ───────────────────────────────────────────────
  compare: { flexDirection: 'row', gap: Spacing.sm },
  compareColumn: {
    flex: 1,
    gap: Spacing.sm,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  compareLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginBottom: Spacing.xs,
  },
  /** Only the "After" column carries brand colour — the improvement. */
  compareLabelAfter: { color: theme.primaryInk },
  compareItem: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.text,
  },

  // ── Note ─────────────────────────────────────────────────────────
  noteBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    color: theme.text,
  },

  // ── Closing CTA ──────────────────────────────────────────────────
  /**
   * The same `paddingHorizontal` and `Spacing.xxl` rhythm every other section
   * on this page uses, so the band sits in the column rather than beside it.
   *
   * The standalone gold rule that used to open this block is gone: it existed
   * to separate an unbounded run of text from the section above it, and the
   * card's own border now does that job. The hero keeps its rule, which is
   * where `styles.goldRule` is still used.
   */
  cta: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },

  // ── Not found ────────────────────────────────────────────────────
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  notFoundTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    textAlign: 'center',
  },
  notFoundBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    textAlign: 'center',
  },
  notFoundAction: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressedOutline: { borderColor: theme.brandGreen, backgroundColor: theme.marble },
  notFoundActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.primaryInk,
  },
});
