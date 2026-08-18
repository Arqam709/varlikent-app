import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { useAuth } from '@/features/auth/auth-context';
import { getPropertyById } from '@/features/properties/properties-api';
import { startPropertyConversation } from '@/features/property-messaging/property-messaging-api';
import { ApiError } from '@/services/api-client';
import type { PropertyDetail } from '@/types/property';
import { formatPrice } from '@/utils/format-price';
import { getPropertyImages } from '@/utils/property-images';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';


export default function PropertyDetailScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  /** Typed as a string — the param comes from the URL, so it is always text. */
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [imageIndex, setImageIndex] = useState(0);

  const load = useCallback(async () => {
    if (!id) {
      setErrorMessage('This property could not be found.');
      setLoadState('error');
      return;
    }

    setLoadState('loading');
    try {
      setProperty(await getPropertyById(id));
      setLoadState('success');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : t('common.somethingWentWrong')
      );
      setLoadState('error');
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  /** Back, with a fallback for the deep-link case where there is no history. */
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/properties');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={10}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={theme.charcoal} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('propertyDetails.title')}</Text>
      </View>

      {loadState === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGreen} />
        </View>
      ) : loadState === 'error' || !property ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>{t('propertyDetails.loadError')}</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button label="Try Again" variant="primary" onPress={load} style={styles.retry} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Gallery
            property={property}
            width={width}
            index={imageIndex}
            onIndexChange={setImageIndex}
          />

          <View style={styles.body}>
            <Text style={styles.price}>
              {formatPrice(property.price, property.listingType, property.priceLabel)}
            </Text>
            <Text style={styles.title}>{property.title}</Text>
            <Text style={styles.location}>
              {property.district}, Istanbul
            </Text>
            {property.address ? <Text style={styles.address}>{property.address}</Text> : null}
            <Text style={styles.propertyType}>{property.propertyType}</Text>

            <Specs property={property} />
            <Description property={property} />
            <DetailRows property={property} />
            <Features property={property} />
            <Agent property={property} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────── Gallery ─────────────────────────── */

function Gallery({
  property,
  width,
  index,
  onIndexChange,
}: {
  property: PropertyDetail;
  width: number;
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const images = getPropertyImages(property);

  const isRent = property.listingType === 'Rent';
  const isFeatured = Boolean(property.featured) && !isRent;
  const badgeLabel = isRent ? 'For Rent' : isFeatured ? 'Featured' : 'For Sale';
  const badgeColor = isRent ? theme.brandGreen : isFeatured ? theme.goldWarm : theme.navy;

  return (
    <View style={[styles.gallery, { height: 280 }]}>
      {images.length === 0 ? (
        // Most listings have no photography at all, so this is the common
        // path. A muted brand mark reads as intentional; a borrowed stock
        // photo would misrepresent the listing.
        <View style={styles.placeholder}>
          <VarlikentIcon width={64} height={60} opacity={0.18} />
        </View>
      ) : images.length === 1 ? (
        <Image
          source={{ uri: images[0] }}
          style={styles.galleryImage}
          contentFit="cover"
          transition={200}
          accessibilityLabel={property.title}
        />
      ) : (
        <FlatList
          data={images}
          keyExtractor={(uri) => uri}
          horizontal
          // Snaps one full-width photo at a time, the native swipe idiom.
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            onIndexChange(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={[styles.galleryImage, { width }]}
              contentFit="cover"
              transition={200}
              accessibilityLabel={property.title}
            />
          )}
        />
      )}

      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{badgeLabel}</Text>
      </View>

      {images.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {images.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ─────────────────────────── Sections ─────────────────────────── */

/**
 * Headline facts. Each is skipped when zero rather than printed as "0 Beds":
 * the schema allows Land and Commercial listings, where bedrooms are not a
 * missing value but a meaningless one.
 */
function Specs({ property }: { property: PropertyDetail }) {
  const styles = useThemedStyles(makeStyles);
  const specs = [
    property.beds > 0 ? { value: String(property.beds), label: property.beds === 1 ? 'Bed' : 'Beds' } : null,
    property.baths > 0 ? { value: String(property.baths), label: property.baths === 1 ? 'Bath' : 'Baths' } : null,
    property.sqm > 0 ? { value: String(property.sqm), label: 'm²' } : null,
  ].filter((s): s is { value: string; label: string } => s !== null);

  if (specs.length === 0) return null;

  return (
    <View style={styles.specs}>
      {specs.map((spec) => (
        <View key={spec.label} style={styles.specItem}>
          <Text style={styles.specValue}>{spec.value}</Text>
          <Text style={styles.specLabel}>{spec.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Description({ property }: { property: PropertyDetail }) {
  const styles = useThemedStyles(makeStyles);
  const text = property.description?.trim();
  if (!text) return null;

  return (
    <Section title="About this property">
      {/* Verified plain text on the live data — no HTML to strip. */}
      <Text style={styles.body}>{text}</Text>
    </Section>
  );
}

/**
 * Only rows with real values. `rooms`, `floor`, `totalFloors`, `heating` and
 * `buildingAge` are unpopulated on every current listing, so in practice this
 * renders Type / Listing / District / Status and, on 20 of 34, Parking.
 */
function DetailRows({ property }: { property: PropertyDetail }) {
  const styles = useThemedStyles(makeStyles);
  const rows: [string, string][] = [];
  const push = (label: string, value: string | number | undefined) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      rows.push([label, String(value)]);
    }
  };

  push('Property Type', property.propertyType);
  push('Listing', property.listingType === 'Rent' ? 'For Rent' : 'For Sale');
  push('District', property.district);
  push('Status', property.status);
  push('Rooms', property.rooms);
  push('Floor', property.floor);
  push('Total Floors', property.totalFloors);
  push('Building Age', property.buildingAge);
  push('Heating', property.heating);
  push('Parking', property.parking);

  if (rows.length === 0) return null;

  return (
    <Section title="Property details">
      <View style={styles.rows}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

/** Positive features only — a list of "Pool: No" tells a buyer nothing. */
function Features({ property }: { property: PropertyDetail }) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const features = (
    [
      ['Balcony', property.balcony],
      ['Elevator', property.elevator],
      ['Pool', property.pool],
      ['Garden', property.garden],
      ['Furnished', property.furnished],
    ] as const
  )
    .filter(([, present]) => present === true)
    .map(([label]) => label);

  if (features.length === 0) return null;

  return (
    <Section title="Features">
      <View style={styles.features}>
        {features.map((feature) => (
          <View key={feature} style={styles.feature}>
            <Ionicons name="checkmark-circle" size={16} color={theme.brandGreen} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

/**
 * Display only. Calling, WhatsApp and email are a later step, so nothing here
 * is a control — showing a phone number that does not dial would be worse
 * than showing plain text.
 *
 * ── Which name to show ───────────────────────────────────────────────────
 * Two fields can carry an agent's name, and they are not equal:
 *
 *   property.agent.name  the REAL assigned account, populated by the server
 *                        from Property.agent. Authoritative.
 *   property.agentName   a LEGACY free-text field. Nothing writes it any
 *                        more; it survives only on listings created before
 *                        agents were real accounts.
 *
 * Reading the legacy field first showed the wrong person on any listing that
 * had been reassigned: the stale typed name beside `agentEmail`, which the
 * server derives from the CURRENT agent's account. Same block, two different
 * people.
 *
 * The real account wins; the legacy string is only a fallback for listings
 * that have no assigned agent at all.
 */
function Agent({ property }: { property: PropertyDetail }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const router = useRouter();
  const { status, token } = useAuth();

  const [starting, setStarting] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const name = property.agent?.name?.trim() || property.agentName?.trim() || '';
  const phone = property.agentPhone?.trim() || '';
  // Still the listing's own field, not property.agent.email — the public agent
  // serializer deliberately withholds account emails.
  const email = property.agentEmail?.trim() || '';

  /**
   * Messaging needs a real account to deliver to, which is exactly what
   * `property.agent` is. A legacy listing can carry agentName and agentEmail
   * with no agent object at all — that is contact information, not somebody
   * who can receive a Varlikent message, so it shows the details without the
   * button.
   *
   * The same check covers a deactivated or demoted agent for free: the backend
   * serializer already returns `agent: null` for those, so there is no second
   * client-side role rule to keep in sync.
   */
  const canMessage = Boolean(property.agent);

  const handleMessage = async () => {
    // Ask for sign-in BEFORE calling the API. Firing an anonymous request and
    // reading the 401 back would be a wasted round trip and a worse message.
    if (status !== 'authenticated' || !token) {
      router.push('/login');
      return;
    }

    setMessageError(null);
    setStarting(true);
    try {
      // ONLY the property id. The backend resolves the agent from
      // Property.agent — no agent id crosses the wire in either direction.
      const { conversationId } = await startPropertyConversation(token, property._id);
      // Object form, matching how the app navigates to dynamic routes
      // elsewhere — and what Expo Router's typed routes accept.
      router.push({ pathname: '/messages/[id]', params: { id: conversationId } });
    } catch (error) {
      // ApiError.message is already normalised: a 409 gives the backend's own
      // "agent unavailable" wording, never a stack trace or a Mongo error.
      setMessageError(
        error instanceof ApiError ? error.message : t('propertyDetails.conversationFailed')
      );
    } finally {
      setStarting(false);
    }
  };

  // Gated on having something to say, not on the legacy field alone. That old
  // condition hid this whole section on listings with a real assigned agent
  // but no legacy name — which is every listing created since.
  if (!name && !phone && !email) return null;

  return (
    <Section title="Listed by">
      <View style={styles.agent}>
        <View style={styles.agentHeader}>
          <View style={styles.agentIdentity}>
            {name ? <Text style={styles.agentName}>{name}</Text> : null}
            {phone ? <Text style={styles.agentLine}>{phone}</Text> : null}
            {email ? <Text style={styles.agentLine}>{email}</Text> : null}
          </View>

          {canMessage ? (
            <Pressable
              onPress={handleMessage}
              disabled={starting}
              accessibilityRole="button"
              accessibilityLabel={name ? `Message ${name}` : 'Message the agent'}
              accessibilityState={{ disabled: starting, busy: starting }}
              style={({ pressed }) => [
                styles.messageButton,
                pressed && !starting && styles.messageButtonPressed,
                starting && styles.messageButtonBlocked,
              ]}>
              {starting ? (
                <ActivityIndicator size="small" color={theme.textOnDark} />
              ) : (
                <Text style={styles.messageButtonLabel}>{t('propertyDetails.message')}</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {messageError ? <Text style={styles.agentError}>{messageError}</Text> : null}
      </View>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.goldRule} />
      <Text style={styles.sectionTitle}>{title}</Text>
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
    color: theme.charcoal,
  },
  scroll: { paddingBottom: Spacing.xxl },

  gallery: { width: '100%', backgroundColor: theme.marble },
  galleryImage: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: 0,
    top: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textOnDark,
  },
  counter: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(30,30,28,0.65)',
  },
  counterText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textOnDark,
  },

  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    paddingHorizontal: Spacing.lg,
  },
  price: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.xl,
    color: theme.navy,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.md,
    lineHeight: 24,
    color: theme.charcoal,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  location: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  address: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    paddingHorizontal: Spacing.lg,
    marginTop: 2,
  },
  propertyType: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textMuted,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },

  specs: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    backgroundColor: theme.cardBg,
    paddingVertical: Spacing.md,
  },
  specItem: { flex: 1, alignItems: 'center' },
  specValue: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.charcoal,
  },
  specLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    marginTop: 2,
  },

  section: { marginTop: Spacing.xl },
  goldRule: {
    width: 40,
    height: 1,
    backgroundColor: theme.gold,
    marginLeft: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.charcoal,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  rows: { paddingHorizontal: Spacing.lg, gap: Spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.marble,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rowLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },
  rowValue: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: theme.charcoal,
  },

  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  featureText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.charcoal,
  },

  agent: {
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    backgroundColor: theme.cardBg,
    padding: Spacing.md,
    gap: 2,
  },
  /** Name/contact on the left, Message on the right, top-aligned. */
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  /** `flex: 1` lets a long email truncate instead of pushing the button off. */
  agentIdentity: {
    flex: 1,
    gap: 2,
  },
  agentName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.charcoal,
  },
  agentLine: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },
  /**
   * Deliberately not the shared Button: that is a full-width 52dp pill for
   * primary page actions and would dominate this card. Same brand green, same
   * pill radius, sized to sit inline beside the name.
   */
  messageButton: {
    minHeight: 36,
    minWidth: 92,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonPressed: {
    backgroundColor: theme.primaryPressed,
  },
  messageButtonBlocked: {
    opacity: 0.6,
  },
  messageButtonLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.primaryText,
  },
  agentError: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.danger,
    marginTop: Spacing.sm,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  stateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.charcoal,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    textAlign: 'center',
  },
  retry: { marginTop: Spacing.md, alignSelf: 'stretch' },
});
