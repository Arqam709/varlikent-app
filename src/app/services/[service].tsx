import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  if (!service) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title={t('services.title')} onBack={handleBack} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>{t('services.notFound')}</Text>
          <Text style={styles.notFoundBody}>
            This service isn&apos;t available. Browse everything we offer instead.
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
      <Header title={t('services.title')} onBack={handleBack} />

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
          Closing statement, deliberately WITHOUT a button.

          The website's CTAs here ("Start a Project", "Request a Quote") all
          submit to a contact/lead system that does not exist in the app yet.
          Rendering a button that looks functional and does nothing is the
          exact mistake the old "Our Services" control made, so this stays an
          editorial sign-off until Phase 3C gives it something to do.
        */}
        <View style={styles.closing}>
          <View style={styles.goldRule} />
          <Text style={styles.closingHeading}>{t(serviceKey(service, 'closingHeading'))}</Text>
          <Text style={styles.closingBody}>{t(serviceKey(service, 'closingBody'))}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    // Custom, because the root Stack sets headerShown: false globally — there
    // is no navigation header to duplicate.
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={10}
        style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color={theme.text} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function ServiceHero({ service }: { service: ServiceStructure }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.hero}>
      {/* The website's own breadcrumb, uppercased as an overline. */}
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
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },
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
  sectionEyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.textMuted,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  sectionHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },

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

  // ── Closing ──────────────────────────────────────────────────────
  closing: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  closingHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginTop: Spacing.lg,
  },
  closingBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    marginTop: Spacing.sm,
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
