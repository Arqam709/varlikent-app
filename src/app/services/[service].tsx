import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import CTABand from '@/components/ui/cta-band';
import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import DesignMySpaceEntry from '@/features/design-my-space/components/design-my-space-entry';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import {
  resolveServicePage,
  type ResolvedServiceHero,
  type ResolvedServiceSection,
} from '@/features/services/service-content';
import { resolveShowroomItems, type ResolvedShowroomItem } from '@/features/services/service-showroom';
import {
  capabilityNumeral,
  getService,
  serviceKey,
  showsHeroContactCta,
  type ServiceStructure,
} from '@/features/services/services-data';
import { useServiceContent } from '@/features/services/use-service-content';
import { useServiceShowroom } from '@/features/services/use-service-showroom';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * SERVICE DETAIL — one native renderer for all four services.
 *
 * Content is the website's admin-managed Page Content for the service
 * (features/services/service-content.ts), falling back to the app's bundled
 * copy until a cached or live document exists. Sections appear in the backend
 * contract's order — the website's order — and a section the admin hid is not
 * rendered. The layout is the app's own: single column, stacked cards, a
 * vertical process list and a swipeable gallery.
 *
 * Only interface chrome comes from `t()`: the header, the call-to-action
 * eyebrow, accessibility hints and not-found copy.
 */
export default function ServiceDetailScreen() {
  const { t, language } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { service: serviceParam } = useLocalSearchParams<{ service?: string }>();
  const router = useRouter();
  /** Content ends above the Android navigation bar, which the app draws edge to edge. */
  const insets = useSafeAreaInsets();

  /** Validated, never cast. */
  const service = getService(serviceParam);

  const { content } = useServiceContent(service?.id);
  const showroom = useServiceShowroom(service?.id);

  const page = useMemo(
    () => (service ? resolveServicePage(service.id, content, language) : null),
    [service, content, language]
  );
  const gallery = useMemo(() => resolveShowroomItems(showroom.items, language), [showroom.items, language]);

  const handleBack = () => {
    // Uses real history, so Home → tile → Back lands on Home, while
    // Home → Services → tile → Back lands on Services.
    if (router.canGoBack()) router.back();
    else router.replace('/services');
  };

  /**
   * Opens the lead form with this service's reason already chosen.
   *
   * `push`, so Contact's Back returns to this service. The stable Contact
   * interest id travels — never CMS text — and the Contact screen resolves it
   * against the served list (General if that interest is disabled).
   */
  const openContact = () => {
    if (!service) return;

    router.push({
      pathname: '/contact',
      params: { interestType: service.contactInterestId },
    });
  };

  if (!service || !page) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('services.title')} onBack={handleBack} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>{t('services.notFound')}</Text>
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

  const contactHint = t('services.ctaAccessibility', { service: t(serviceKey(service, 'title')) });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Names the destination of Back, not the current page. */}
      <ScreenHeader title={t('services.title')} onBack={handleBack} />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Spacing.xl + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <ServiceHero
          hero={page.hero}
          service={service}
          contactHint={contactHint}
          onContact={openContact}
        />

        {/*
          The app-only tool, offered right under the hero on the one service
          that has one. Which service that is comes from services-data, not
          from a comparison written here.
        */}
        {service.feature === 'design-my-space' ? <DesignMySpaceEntry /> : null}

        {page.sections.map((section) => {
          switch (section.kind) {
            case 'showroom':
              // Only when the owner has not switched it off AND there is media to show.
              return showroom.enabled === true && gallery.length > 0 ? (
                <ShowroomSection key={section.kind} section={section} items={gallery} />
              ) : null;
            case 'services':
              return <ServicesSection key={section.kind} section={section} />;
            case 'process':
              return <ProcessSection key={section.kind} section={section} />;
            case 'transform':
              return <TransformSection key={section.kind} section={section} />;
            case 'seismic':
              return <SeismicSection key={section.kind} section={section} />;
            case 'cta':
              return (
                <CTABand
                  key={section.kind}
                  eyebrow={t('services.ctaEyebrow')}
                  heading={section.heading}
                  body={section.body}
                  ctaLabel={section.button}
                  accessibilityHint={contactHint}
                  onPress={openContact}
                  style={styles.cta}
                />
              );
            default:
              return null;
          }
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function ServiceHero({
  hero,
  service,
  contactHint,
  onContact,
}: {
  hero: ResolvedServiceHero;
  service: ServiceStructure;
  contactHint: string;
  onContact: () => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign, isRTL } = useDirection();
  const heading = hero.heading || t(serviceKey(service, 'title'));

  return (
    <View style={styles.hero}>
      {/*
        The icon sits beside the eyebrow rather than alone below the text, so
        it identifies the service without claiming its own band of the screen.
      */}
      <View style={[styles.heroTop, { flexDirection: row }]}>
        <View style={styles.heroIcon}>
          <Ionicons name={service.icon} size={20} color={theme.primaryInk} />
        </View>
        {hero.label ? <Text style={[styles.heroLabel, { textAlign }]}>{hero.label}</Text> : null}
      </View>

      <Text style={[styles.heroTitle, { textAlign }]} accessibilityRole="header">
        {heading}
      </Text>
      {hero.subtitle ? <Text style={[styles.heroSubtitle, { textAlign }]}>{hero.subtitle}</Text> : null}

      {/* Off where the service says so (Interior Design): its closing CTA is the one consultation button. */}
      {hero.ctaPrimary && showsHeroContactCta(service) ? (
        <Button label={hero.ctaPrimary} onPress={onContact} accessibilityHint={contactHint} style={styles.heroCta} />
      ) : null}

      <View style={[styles.goldRule, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
    </View>
  );
}

function SectionBlock({ label, heading, children }: { label: string; heading: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const title = heading || label;
  return (
    <View style={styles.section}>
      {title ? (
        <SectionHeader
          eyebrow={heading && label ? label : undefined}
          title={title}
          tone="muted"
          style={styles.sectionHeader}
        />
      ) : null}
      {children}
    </View>
  );
}

function ShowroomSection({
  section,
  items,
}: {
  section: Extract<ResolvedServiceSection, { kind: 'showroom' }>;
  items: ResolvedShowroomItem[];
}) {
  const styles = useThemedStyles(makeStyles);
  const { isRTL, textAlign } = useDirection();
  const [failed, setFailed] = useState<readonly string[]>([]);
  const visible = items.filter((item) => !failed.includes(item.id));

  // Every image failed: no empty gallery frame.
  if (visible.length === 0) return null;

  return (
    <SectionBlock label={section.label} heading={section.heading}>
      <FlatList
        data={visible}
        horizontal
        // Starts at the reading edge in Arabic and Urdu.
        inverted={isRTL}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gallery}
        renderItem={({ item }) => (
          <View style={styles.galleryCard}>
            <Image
              source={{ uri: item.image }}
              style={styles.galleryImage}
              contentFit="cover"
              transition={200}
              accessibilityLabel={item.caption || section.heading || section.label}
              onError={() => setFailed((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))}
            />
            {item.caption ? (
              <Text style={[styles.galleryCaption, { textAlign }]} numberOfLines={2}>
                {item.caption}
              </Text>
            ) : null}
          </View>
        )}
      />
    </SectionBlock>
  );
}

function ServicesSection({ section }: { section: Extract<ResolvedServiceSection, { kind: 'services' }> }) {
  const styles = useThemedStyles(makeStyles);
  const { row, textAlign } = useDirection();
  return (
    <SectionBlock label={section.label} heading={section.heading}>
      <View style={styles.capabilities}>
        {section.items.map((item, index) => (
          <View key={index} style={[styles.capability, { flexDirection: row }]}>
            <Text style={styles.capabilityNum}>{capabilityNumeral(index)}</Text>
            <View style={styles.capabilityText}>
              <Text style={[styles.capabilityTitle, { textAlign }]}>{item.title}</Text>
              {item.desc ? <Text style={[styles.capabilityDesc, { textAlign }]}>{item.desc}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </SectionBlock>
  );
}

function ProcessSection({ section }: { section: Extract<ResolvedServiceSection, { kind: 'process' }> }) {
  const styles = useThemedStyles(makeStyles);
  const { row, textAlign } = useDirection();
  return (
    <SectionBlock label={section.label} heading={section.heading}>
      <View style={styles.steps}>
        {section.steps.map((step, index) => (
          <View key={index} style={[styles.step, { flexDirection: row }]}>
            <Text style={styles.stepNumber}>{capabilityNumeral(index)}</Text>
            <Text style={[styles.stepLabel, { textAlign }]}>{step}</Text>
          </View>
        ))}
      </View>
    </SectionBlock>
  );
}

function TransformSection({ section }: { section: Extract<ResolvedServiceSection, { kind: 'transform' }> }) {
  const styles = useThemedStyles(makeStyles);
  const { row } = useDirection();
  return (
    <SectionBlock label={section.label} heading={section.heading}>
      <View style={[styles.compare, { flexDirection: row }]}>
        <CompareColumn label={section.beforeTitle} items={section.before} muted />
        <CompareColumn label={section.afterTitle} items={section.after} />
      </View>
    </SectionBlock>
  );
}

function CompareColumn({ label, items, muted = false }: { label: string; items: string[]; muted?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();
  if (items.length === 0 && !label) return null;
  return (
    <View style={styles.compareColumn}>
      {label ? (
        <Text style={[styles.compareLabel, !muted && styles.compareLabelAfter, { textAlign }]}>{label}</Text>
      ) : null}
      {items.map((item, index) => (
        <Text key={index} style={[styles.compareItem, { textAlign }]}>
          {item}
        </Text>
      ))}
    </View>
  );
}

function SeismicSection({ section }: { section: Extract<ResolvedServiceSection, { kind: 'seismic' }> }) {
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();
  return (
    <SectionBlock label={section.label} heading={section.heading}>
      {section.body ? <Text style={[styles.noteBody, { textAlign }]}>{section.body}</Text> : null}
    </SectionBlock>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  /** Bottom padding is applied inline, with the navigation-bar inset added. */
  scroll: {},

  // ── Hero ─────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroLabel: {
    flex: 1,
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
    lineHeight: 24,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCta: {
    marginTop: Spacing.md,
  },
  goldRule: {
    width: 56,
    height: 1,
    backgroundColor: theme.gold,
    marginTop: Spacing.md,
  },

  // ── Sections ─────────────────────────────────────────────────────
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  sectionHeader: { marginBottom: Spacing.md },

  // ── Showroom gallery ─────────────────────────────────────────────
  gallery: { gap: Spacing.md },
  /** Wide enough to read a photograph, narrow enough that the next card peeks in. */
  galleryCard: { width: 260 },
  galleryImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    backgroundColor: theme.marble,
  },
  galleryCaption: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },

  // ── Service cards ────────────────────────────────────────────────
  capabilities: { gap: Spacing.md },
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
    lineHeight: 21,
    color: theme.textMuted,
    // Number, title and description read as one item, not three blocks.
    marginTop: 2,
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
    minHeight: 48,
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

  // ── Seismic note ─────────────────────────────────────────────────
  noteBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    color: theme.text,
  },

  // ── Closing CTA ──────────────────────────────────────────────────
  cta: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
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
