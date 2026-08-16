import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { getServiceById, type Service } from '@/features/services/services-data';

export default function ServiceDetailScreen() {
  const { service: serviceParam } = useLocalSearchParams<{ service?: string }>();
  const router = useRouter();

  /** Validated, never cast — see getServiceById. */
  const service = getServiceById(serviceParam);

  const handleBack = () => {
    // Uses real history, so Home → tile → Back lands on Home, while
    // Home → Services → tile → Back lands on Services.
    if (router.canGoBack()) router.back();
    else router.replace('/services');
  };
  if (!service) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Services" onBack={handleBack} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Service not found</Text>
          <Text style={styles.notFoundBody}>
            This service isn&apos;t available. Browse everything we offer instead.
          </Text>
          <Pressable
            onPress={() => router.replace('/services')}
            accessibilityRole="button"
            accessibilityLabel="Back to services"
            style={({ pressed }) => [styles.notFoundAction, pressed && styles.pressedOutline]}>
            <Text style={styles.notFoundActionText}>Back to Services</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Names the destination of Back, not the current page. */}
      <Header title="Services" onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ServiceHero service={service} />

        <Capabilities service={service} />

        {service.process ? (
          <Section eyebrow="How We Work" heading={service.process.heading}>
            <View style={styles.steps}>
              {service.process.steps.map((step, index) => (
                <View key={step} style={styles.step}>
                  <Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.stepLabel}>{step}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {service.comparison ? (
          <Section eyebrow="The Transformation" heading={service.comparison.heading}>
            <View style={styles.compare}>
              <CompareColumn
                label={service.comparison.beforeLabel}
                items={service.comparison.before}
                muted
              />
              <CompareColumn
                label={service.comparison.afterLabel}
                items={service.comparison.after}
              />
            </View>
          </Section>
        ) : null}

        {service.note ? (
          <Section eyebrow={service.note.eyebrow} heading={service.note.heading}>
            <Text style={styles.noteBody}>{service.note.body}</Text>
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
          <Text style={styles.closingHeading}>{service.closingHeading}</Text>
          <Text style={styles.closingBody}>{service.closingBody}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    // Custom, because the root Stack sets headerShown: false globally — there
    // is no navigation header to duplicate.
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color={Colors.charcoal} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function ServiceHero({ service }: { service: Service }) {
  return (
    <View style={styles.hero}>
      {/* The website's own breadcrumb, uppercased as an overline. */}
      <Text style={styles.heroLabel}>{service.websiteLabel}</Text>
      <Text style={styles.heroTitle}>{service.title}</Text>
      <Text style={styles.heroSubtitle}>{service.description}</Text>

      {/*
        An icon rather than photography, for all four alike.

        Only three of the four have an approved static image — Renovation has
        none, and the website's service pages source imagery from an
        admin-managed showroom API. Three photos plus one placeholder would
        look broken, and inventing a Renovation image would fabricate a brand
        association. Consistency wins until real imagery exists.
      */}
      <View style={styles.heroIcon}>
        <Ionicons name={service.icon} size={30} color={Colors.brandGreen} />
      </View>

      <View style={styles.goldRule} />
    </View>
  );
}

function Capabilities({ service }: { service: Service }) {
  return (
    <Section eyebrow={service.capabilitiesLabel} heading={service.capabilitiesHeading}>
      <View style={styles.capabilities}>
        {service.capabilities.map((capability) => (
          <View key={capability.num} style={styles.capability}>
            <Text style={styles.capabilityNum}>{capability.num}</Text>
            <View style={styles.capabilityText}>
              <Text style={styles.capabilityTitle}>{capability.title}</Text>
              <Text style={styles.capabilityDesc}>{capability.desc}</Text>
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
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.softWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.charcoal,
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
    color: Colors.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 30,
    lineHeight: 38,
    color: Colors.charcoal,
    marginTop: Spacing.sm,
  },
  heroSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    lineHeight: 25,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.marble,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  goldRule: {
    width: 56,
    height: 1,
    backgroundColor: Colors.gold,
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
    color: Colors.textMuted,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  sectionHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },

  // ── Capabilities ─────────────────────────────────────────────────
  capabilities: { gap: Spacing.lg },
  capability: { flexDirection: 'row', gap: Spacing.md },
  capabilityNum: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.gold,
    letterSpacing: LetterSpacing.wide,
    // Fixed width keeps the numerals in a clean column as text wraps.
    width: 28,
    paddingTop: 2,
  },
  capabilityText: { flex: 1 },
  capabilityTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: Colors.charcoal,
  },
  capabilityDesc: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  // ── Process ──────────────────────────────────────────────────────
  steps: { gap: Spacing.sm },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.marble,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  stepNumber: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.brandGreen,
    width: 24,
  },
  stepLabel: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.charcoal,
  },

  // ── Before / After ───────────────────────────────────────────────
  compare: { flexDirection: 'row', gap: Spacing.sm },
  compareColumn: {
    flex: 1,
    gap: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  compareLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  /** Only the "After" column carries brand colour — the improvement. */
  compareLabelAfter: { color: Colors.brandGreen },
  compareItem: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: Colors.text,
  },

  // ── Note ─────────────────────────────────────────────────────────
  noteBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    color: Colors.text,
  },

  // ── Closing ──────────────────────────────────────────────────────
  closing: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  closingHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
    marginTop: Spacing.lg,
  },
  closingBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
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
    color: Colors.charcoal,
    textAlign: 'center',
  },
  notFoundBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  notFoundAction: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressedOutline: { borderColor: Colors.brandGreen, backgroundColor: Colors.marble },
  notFoundActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: Colors.brandGreen,
  },
});
