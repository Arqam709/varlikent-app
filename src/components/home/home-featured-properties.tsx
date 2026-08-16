import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { getProperties } from '@/features/properties/properties-api';
import type { PropertySummary } from '@/types/property';
import { formatPrice } from '@/utils/format-price';
import { getPropertyImages } from '@/utils/property-images';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';

const MAX_CARDS = 6;

type LoadState = 'loading' | 'success' | 'error';

export default function HomeFeaturedProperties() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const result = await getProperties({ featured: true });
      setProperties(result.properties.slice(0, MAX_CARDS));
      setLoadState('success');
    } catch {
      // The message is deliberately generic and local; Home must keep working.
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadState === 'success' && properties.length === 0) {
    return null;
  }
  const cardWidth = Math.min(Math.round(width * 0.78), 320);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {/* "Handpicked" is the website's own label for this section. */}
          <Text style={styles.eyebrow}>Handpicked</Text>
          <Text style={styles.heading}>Featured Properties</Text>
        </View>

        
        <Pressable
          onPress={() => router.push('/properties')}
          accessibilityRole="button"
          accessibilityLabel="View all properties"
          hitSlop={8}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      {loadState === 'loading' ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={Colors.brandGreen} />
        </View>
      ) : loadState === 'error' ? (
        // Compact and inline: the hero, discovery, Buy/Rent and stats around
        // it all stay fully usable.
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>Featured properties couldn&apos;t load.</Text>
          <Pressable onPress={load} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item._id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <FeaturedCard
              property={item}
              width={cardWidth}
              onPress={() =>
                router.push({ pathname: '/properties/[id]', params: { id: item._id } })
              }
            />
          )}
        />
      )}
    </View>
  );
}
function FeaturedCard({
  property,
  width,
  onPress,
}: {
  property: PropertySummary;
  width: number;
  onPress: () => void;
}) {
  const imageUrl = getPropertyImages(property)[0] ?? null;
  const isRent = property.listingType === 'Rent';
  const badgeLabel = isRent ? 'For Rent' : 'For Sale';
  const badgeColor = isRent ? Colors.brandGreen : Colors.navy;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${property.title}, ${formatPrice(
        property.price,
        property.listingType,
        property.priceLabel
      )}, ${property.district}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}>
      <View style={styles.imageArea}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            accessibilityLabel={property.title}
          />
        ) : (
          // Same truthful placeholder as the Properties list — no stock photos.
          <View style={styles.placeholder}>
            <VarlikentIcon width={40} height={37} opacity={0.18} />
          </View>
        )}

        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.price}>
          {formatPrice(property.price, property.listingType, property.priceLabel)}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {property.title}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          {property.district}, Istanbul
        </Text>
        <Text style={styles.specs}>
          {property.beds} bed · {property.baths} bath · {property.sqm} m²
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    // Padding on the header only — the list keeps its own so cards can scroll
    // past the screen edge.
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: Colors.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
    marginTop: Spacing.xs,
  },
  viewAll: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.brandGreen,
  },

  list: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },

  card: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
    borderColor: Colors.brandGreen,
  },
  /** 170 rather than the list card's 200 — a preview, not the main event. */
  imageArea: {
    height: 170,
    backgroundColor: Colors.marble,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    left: 0,
    top: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: Colors.textOnDark,
  },
  body: { padding: Spacing.md },
  price: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: Colors.navy,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.sm,
    lineHeight: 19,
    color: Colors.charcoal,
    marginTop: Spacing.xs,
  },
  location: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  specs: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  /** Shared by the loading and error states so the section height is stable. */
  stateBox: {
    minHeight: 96,
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardBg,
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  retry: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.brandGreen,
  },
});
