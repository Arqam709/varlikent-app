import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PropertyLocationMap } from '@/components/properties/property-map';
import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import { useLanguage } from '@/features/localization/language-context';
import { getPropertyById } from '@/features/properties/properties-api';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { ApiError } from '@/services/api-client';
import type { PropertyDetail } from '@/types/property';
import { formatPrice } from '@/utils/format-price';
import { buildPropertyDirectionsUrl } from '@/utils/map-directions';
import { openFirstAvailable } from '@/utils/open-external-url';
import { isPubliclyMappable } from '@/utils/property-location';

/**
 * WHERE IS THIS PROPERTY?
 *
 * ── One question, one screen ────────────────────────────────────────────
 * This screen answers "where is this one property". The Properties map answers
 * "what is around me". Keeping them apart is why neither has to compromise:
 * there is no Near Me here, no radius, no filters, no second marker and no
 * "show closest" — and the map on the Properties tab does not have to pretend
 * to be a detail view.
 *
 * ── Why /properties/location/[id] and not /properties/[id]/location ─────
 * The nested form reads better, and it was the first choice — but
 * `src/app/properties/` holds two FILES today (`[id].tsx`, `map.tsx`), not a
 * folder. Nesting would mean moving the 700-line details screen into
 * `[id]/index.tsx` and repairing its relative `../../../assets/...` import,
 * while nine `router.push({ pathname: '/properties/[id]' })` call sites and an
 * autoVerify deep-link prefix all depend on that route continuing to resolve.
 *
 * Both layouts produce identical behaviour for the customer. Only one requires
 * moving working code, so this is the smaller safe change. Three segments
 * versus two means there is no ambiguity with `/properties/[id]` or the static
 * `/properties/map`.
 *
 * ── Only the id travels ─────────────────────────────────────────────────
 * The property is refetched through the SAME `getPropertyById` the details
 * screen uses, rather than being serialized into route params. So this screen
 * cannot render a snapshot that went stale while the customer was reading, and
 * the URL stays a URL.
 */
type LoadState = 'loading' | 'success' | 'error';

export default function PropertyLocationScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign } = useDirection();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Set when the maps hand-off could not open anything. Cleared on the next
   * attempt, so a customer who installs a maps app and retries is not left
   * reading a stale failure.
   */
  const [directionsFailed, setDirectionsFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setErrorMessage(t('propertyDetails.loadError'));
      setLoadState('error');
      return;
    }

    setLoadState('loading');
    try {
      setProperty(await getPropertyById(id));
      setLoadState('success');
    } catch (error) {
      // ApiError.message is already normalised — a 404 and a malformed-ObjectId
      // 500 both arrive as readable copy rather than a stack trace.
      setErrorMessage(error instanceof ApiError ? error.message : t('common.somethingWentWrong'));
      setLoadState('error');
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The hand-off URL — or null, in which case NO Directions action renders.
   *
   * Built through `buildPropertyDirectionsUrl`, which reaches the coordinate
   * only via `getPublicCoordinates`. An approximate listing therefore yields
   * null here and no URL containing a coordinate can exist on this screen,
   * even if malformed public data still carried one.
   *
   * Destination only. No origin is read or sent: the maps app starts from the
   * device's location under its own permission, so this screen never touches
   * expo-location and never sees where the customer is.
   */
  const directionsUrl = useMemo(
    () => (property ? buildPropertyDirectionsUrl(Platform.OS, property) : null),
    [property]
  );

  /**
   * Opens the platform's maps app at the property.
   *
   * Through the app's existing `openFirstAvailable` rather than a direct
   * Linking call, for the two reasons documented in utils/open-external-url.ts:
   * it never asks `canOpenURL` first (false negatives on both platforms), and
   * it calls `Linking.openURL` as a METHOD — the detached-receiver bug that
   * once broke every contact button, including Maps, shipped from a bare
   * reference.
   *
   * The URL is https, so on a device with no maps app it opens in a browser.
   * A failure therefore means nothing at all could open it, which is worth
   * telling the customer rather than leaving the tap looking broken.
   *
   * The screen stays in navigation history underneath the external app, so
   * returning to Varlikent lands back here with nothing to restore.
   */
  const handleDirections = useCallback(async () => {
    if (!directionsUrl) return;

    setDirectionsFailed(false);
    const opened = await openFirstAvailable([directionsUrl]);
    if (!opened) setDirectionsFailed(true);
  }, [directionsUrl]);

  /** Back, with a fallback for the deep-link case where there is no history. */
  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/properties');
  }, [router]);

  /**
   * THE PRIVACY GATE, re-run on arrival.
   *
   * This route is reachable by a hand-typed URL or a stale link, so it must not
   * assume the details screen already vetted the property. An approximate
   * listing — even one that wrongly still carries coordinates — falls through
   * to the unavailable state below and no map is ever constructed.
   */
  const mappable = property !== null && isPubliclyMappable(property);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('propertyLocation.title')} onBack={handleBack} />

      <View style={styles.canvas}>
        {loadState === 'loading' ? (
          /*
            Deliberately a spinner and not a map. Rendering a default region
            while the property loads would show the customer a place that is not
            their property, then jump — which reads as the map being wrong
            rather than as loading.
          */
          <View style={styles.centered}>
            <ActivityIndicator color={theme.primaryInk} />
          </View>
        ) : loadState === 'error' || !property ? (
          <View style={styles.centered}>
            <Text style={styles.stateHeading}>{t('propertyDetails.loadError')}</Text>
            <Text style={styles.stateBody}>{errorMessage}</Text>
            <Button
              label={t('common.retry')}
              variant="primary"
              onPress={() => load()}
              style={styles.stateAction}
            />
          </View>
        ) : !mappable ? (
          /*
            User-focused and deliberately incurious about WHY. It says nothing
            about private coordinates, hidden values or owner settings — naming
            the reason would leak exactly what the approximate setting protects,
            and the customer cannot act on it either way.
          */
          <View style={styles.centered}>
            <Text style={styles.stateHeading}>{t('propertyLocation.unavailable')}</Text>
            <Button
              label={t('common.back')}
              variant="secondary"
              onPress={handleBack}
              style={styles.stateAction}
            />
          </View>
        ) : (
          <>
            <PropertyLocationMap
              property={property}
              accessibilityLabel={t('propertyDetails.mapLabel')}
            />

            {/*
              A compact identity card, floated rather than stacked so the map
              keeps the whole canvas. No favourite toggle, no messaging, no
              gallery and no "View Property" — the customer arrived FROM the
              details screen, so sending them back there would be a loop.

              A column: identity first, then the Directions hand-off beneath it.
            */}
            <View
              style={[styles.cardSlot, { paddingBottom: Spacing.md + insets.bottom }]}
              pointerEvents="box-none">
              <View style={styles.card}>
                <Text style={[styles.cardTitle, { textAlign }]} numberOfLines={2}>
                  {property.title}
                </Text>
                <Text style={[styles.cardDistrict, { textAlign }]} numberOfLines={1}>
                  {property.district}
                </Text>
                <Text style={[styles.cardPrice, { textAlign }]} numberOfLines={1}>
                  {formatPrice(property.price, property.listingType, property.priceLabel)}
                </Text>

                {directionsUrl ? (
                  <>
                    {/*
                      A local Pressable rather than the shared Button, for three
                      concrete reasons: Button hardcodes accessibilityLabel to its
                      visible label (so "Get directions to {title}" could only be
                      a hint), its icon row is a fixed 'row' that does not follow
                      RTL, and it is a 52dp uppercase page-action pill that would
                      dominate a card floating over the map. Changing Button for
                      one screen would alter every button in the app.

                      "Directions" is the truthful label on both platforms: each
                      URL targets a directions endpoint with the start left to the
                      device's current location, not merely a place view.
                    */}
                    <Pressable
                      onPress={handleDirections}
                      accessibilityRole="button"
                      accessibilityLabel={t('propertyLocation.directionsAccessibility', {
                        title: property.title,
                      })}
                      style={({ pressed }) => [
                        styles.directions,
                        { flexDirection: row },
                        pressed && styles.directionsPressed,
                      ]}>
                      {/*
                        'navigate' is a GEOGRAPHIC arrow, not a reading-direction
                        one, so the glyph is never mirrored. The row order still
                        follows RTL, placing it at the reading edge.
                      */}
                      <Ionicons name="navigate" size={16} color={theme.primaryText} />
                      <Text style={styles.directionsLabel}>{t('propertyLocation.directions')}</Text>
                    </Pressable>

                    {directionsFailed ? (
                      // Inline, with the alert role — the same convention the
                      // Contact screen uses for a failed hand-off.
                      <Text accessibilityRole="alert" style={[styles.directionsError, { textAlign }]}>
                        {t('propertyLocation.directionsFailed')}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.softWhite },
    /** Everything under the header, so the map gets every remaining point. */
    canvas: { flex: 1 },

    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    stateHeading: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.lg,
      color: theme.text,
      textAlign: 'center',
    },
    stateBody: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      color: theme.textMuted,
      textAlign: 'center',
    },
    stateAction: { marginTop: Spacing.md, alignSelf: 'stretch' },

    cardSlot: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: Spacing.md,
    },
    card: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      padding: Spacing.md,
      gap: 2,
      /* Floats over live tiles, so it carries its own separation from them. */
      elevation: 4,
      shadowColor: theme.charcoal,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    cardTitle: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.sm,
      color: theme.text,
    },
    cardDistrict: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      color: theme.textMuted,
    },
    cardPrice: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.md,
      color: theme.text,
      marginTop: 2,
    },

    /**
     * Full width, brand primary, compact. 44dp is the comfortable touch minimum
     * without the extra height of the page-action pill.
     */
    directions: {
      marginTop: Spacing.sm,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: theme.primary,
    },
    directionsPressed: { backgroundColor: theme.primaryPressed },
    directionsLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.sm,
      color: theme.primaryText,
    },
    directionsError: {
      marginTop: Spacing.xs,
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      color: theme.danger,
    },
  });
