import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import FavouriteButton from '@/components/properties/favourite-button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { bathsKey, bedsKey, listingBadgeKey } from '@/utils/property-labels';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import type { PropertySummary } from '@/types/property';
import { formatPrice } from '@/utils/format-price';
import { getPropertyImages } from '@/utils/property-images';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';



type Props = {
  property: PropertySummary;
  /** Omit to render a non-interactive card. */
  onPress?: () => void;
};

export default function PropertyCard({ property, onPress }: Props) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const imageUrl = getPropertyImages(property)[0] ?? null;

  const isRent = property.listingType === 'Rent';
  // Website rule: a rental never shows the Featured badge, even when flagged.
  const isFeatured = Boolean(property.featured) && !isRent;

  const badgeLabel = t(listingBadgeKey(property.listingType, property.featured));
  const badgeColor = isRent ? theme.brandGreen : isFeatured ? theme.goldWarm : theme.navy;

  const content = (
    <>
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
          <View style={styles.placeholder}>
            <VarlikentIcon width={44} height={41} opacity={0.18} />
          </View>
        )}

        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>

        {/*
          Top-right, so it never collides with the left-edge listing badge. It
          is positioned inside imageArea, which is what keeps it clipped to the
          card's rounded corners.
        */}
        <FavouriteButton propertyId={property._id} />
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

        <Text style={styles.propertyType}>{property.propertyType}</Text>

        <View style={styles.stats}>
          <Text style={styles.stat}>{property.beds} {t(bedsKey(property.beds))}</Text>
          <Text style={styles.statDivider}>·</Text>
          <Text style={styles.stat}>{property.baths} {t(bathsKey(property.baths))}</Text>
          <Text style={styles.statDivider}>·</Text>
          <Text style={styles.stat}>{property.sqm} m²</Text>
        </View>
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.card}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Without this the reader announces every Text in the card separately.
      // One label per card states the property in the order that matters.
      accessibilityLabel={`${property.title}, ${formatPrice(
        property.price,
        property.listingType,
        property.priceLabel
      )}, ${property.district}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {content}
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  card: {
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    // Clips the image to the rounded top corners.
    overflow: 'hidden',
  },
  /** Touch feedback — the native stand-in for the website's hover lift. */
  cardPressed: {
    opacity: 0.85,
    borderColor: theme.brandGreen,
  },
  imageArea: {
    height: 200,
    backgroundColor: theme.marble,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.marble,
  },
  /** Left-edge tag, matching the website's badge placement. */
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
  body: {
    padding: Spacing.md,
  },
  /** Cinzel for prices — the website treats numerals as display type. */
  price: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: theme.text,
    marginTop: Spacing.xs,
  },
  location: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },
  propertyType: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  stat: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
  statDivider: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
});
