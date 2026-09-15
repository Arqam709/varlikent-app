import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { PropertySummary } from '@/types/property';
import { formatPrice } from '@/utils/format-price';
import { getPropertyImages } from '@/utils/property-images';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';

/**
 * THE CARD THAT APPEARS WHEN A MARKER IS TAPPED.
 *
 * ── Why not the existing PropertyCard ───────────────────────────────────
 * PropertyCard is a full-width, ~300dp tall browsing card with a 16:9 photo, a
 * listing badge, a favourite toggle and a spec row. Floating it over a map
 * would cover roughly half the markers it is meant to describe — the map stops
 * being browsable at the moment the customer starts browsing it.
 *
 * So this is a deliberately smaller sibling: a 72dp thumbnail beside three
 * lines of text. It is not a reduced COPY of PropertyCard — everything it
 * renders comes from the same helpers PropertyCard uses (`getPropertyImages`,
 * `formatPrice`, the same brand-mark fallback), so the two can never disagree
 * about what a property costs or which photo represents it. Only the layout is
 * new, because only the layout needed to change.
 *
 * ── Why the whole card is not the button ────────────────────────────────
 * The card is pressable AND carries an explicit "View Property" affordance.
 * On a map the customer is browsing, not committing: they tap markers to read
 * about them. A card that is entirely one big navigation target turns every
 * accidental brush into a screen change, and gives a screen-reader user no way
 * to read the summary without activating it. The explicit action names the
 * destination; the card press is the shortcut for people who expect it.
 */

type Props = {
  property: PropertySummary;
  onViewProperty: () => void;
  /**
   * Display-ready distance, e.g. "12.8" — the NUMBER only, already formatted
   * for the active locale. Omitted when Near Me is off, and the line then does
   * not render at all.
   *
   * Deliberately not a raw number and not a coordinate: this component does no
   * measuring. Distance is computed once per origin in the screen's Near Me
   * pipeline, so the figure on this card is provably the same one that decided
   * whether the property was inside the radius.
   */
  distanceLabel?: string;
};

export default function MapPropertyPreview({ property, onViewProperty, distanceLabel }: Props) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { row, textAlign } = useDirection();

  // The same resolver the list card uses: it already handles mainImage being
  // an EMPTY STRING rather than absent, which is common in the live data.
  const imageUrl = getPropertyImages(property)[0] ?? null;
  const price = formatPrice(property.price, property.listingType, property.priceLabel);

  return (
    <Pressable
      onPress={onViewProperty}
      accessibilityRole="button"
      /*
        One label carrying the whole summary. A screen reader lands on the card
        and hears the listing described in one pass, rather than four separate
        fragments it has to reassemble — and the visual order (title, district,
        price) is the order it is read in.
      */
      accessibilityLabel={
        distanceLabel
          ? t('propertiesMap.previewAccessibilityWithDistance', {
              title: property.title,
              district: property.district,
              price,
              distance: distanceLabel,
            })
          : t('propertiesMap.previewAccessibility', {
              title: property.title,
              district: property.district,
              price,
            })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {/* The media/text row follows reading order; the map beneath never does. */}
      <View style={[styles.body, { flexDirection: row }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumb}
            contentFit="cover"
            transition={150}
            // Decorative here: the title is already announced by the card's own
            // label, so naming the photo would repeat it.
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          // Most listings have no photography. The brand mark reads as
          // intentional; a borrowed stock photo would misrepresent the listing.
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <VarlikentIcon width={28} height={26} opacity={0.18} />
          </View>
        )}

        <View style={styles.text}>
          <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
            {property.title}
          </Text>
          <Text style={[styles.district, { textAlign }]} numberOfLines={1}>
            {property.district}
          </Text>
          <Text style={[styles.price, { textAlign }]} numberOfLines={1}>
            {price}
          </Text>

          {/*
            Only while Near Me is on. With no origin there is no distance to
            state, and inventing one ("distance unavailable") would add a line
            that says nothing.

            STRAIGHT-LINE distance — the copy says "away", never "drive": this
            is great-circle distance between two points, not a route.
          */}
          {distanceLabel ? (
            <Text style={[styles.distance, { textAlign }]} numberOfLines={1}>
              {t('propertiesMap.distanceAway', { distance: distanceLabel })}
            </Text>
          ) : null}
        </View>
      </View>

      {/*
        Presentational: the press is handled by the card above, so this is not a
        nested touchable. Two nested buttons would be announced as two separate
        controls describing one action.
      */}
      <View style={[styles.action, { flexDirection: row }]}>
        <Text style={styles.actionLabel}>{t('propertiesMap.viewProperty')}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    card: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      padding: Spacing.md,
      gap: Spacing.sm,
      /*
        The card floats over live map tiles rather than a flat ground, so it
        needs its own separation from them. Elevation on Android, a soft shadow
        on iOS — both keyed to the theme's own ink so a dark theme does not get
        a black halo on a dark card.
      */
      elevation: 4,
      shadowColor: theme.charcoal,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    cardPressed: { opacity: 0.9 },

    body: { alignItems: 'center', gap: Spacing.md },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: Radius.sm,
      backgroundColor: theme.marble,
    },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },

    /** `flex: 1` lets a long Turkish title truncate instead of pushing the row. */
    text: { flex: 1, gap: 2 },
    title: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.sm,
      color: theme.text,
    },
    district: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      color: theme.textMuted,
    },
    price: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.md,
      color: theme.text,
      marginTop: 2,
    },

    /** Sits under the price; muted, because it is context rather than headline. */
    distance: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: FontSizes.xs,
      color: theme.primaryInk,
      marginTop: 2,
    },

    action: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
      borderRadius: Radius.full,
      backgroundColor: theme.primary,
    },
    actionLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.sm,
      color: theme.primaryText,
    },
  });
