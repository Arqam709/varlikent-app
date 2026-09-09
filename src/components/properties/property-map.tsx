import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { Radius } from '@/constants/theme';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import type { PropertyDetail, PropertySummary } from '@/types/property';
import { getPublicCoordinates, isPubliclyMappable } from '@/utils/property-location';

/**
 * THE PROPERTY MAP.
 *
 * ── Why this file is named for the concept, not for "one property" ──────
 * The website keeps its list map and its single-property map in ONE file
 * (frontend/src/components/PropertyMapView.jsx) so that the privacy predicate
 * they share cannot drift apart. This file is the mobile counterpart and is
 * expected to grow the same way: `SinglePropertyMap` today, a
 * `PropertyMapView` taking `properties[]` in the next phase, both gated on the
 * same `isPubliclyMappable`. Naming it `single-property-map.tsx` would have
 * made that addition read like a second, competing map module.
 *
 * What it deliberately is NOT, yet: no clustering, no price bubbles, no
 * "search this area", no bottom sheet, no user location. Those are later
 * phases, and the shape here — a component that takes a property and asks the
 * shared validator for a coordinate — is what keeps them cheap to add rather
 * than something to build now.
 */

/**
 * Zoom, translated rather than copied.
 *
 * The website uses Leaflet zoom 15 for a single detail marker. react-native-maps
 * has no zoom level in its region API; it takes a span in DEGREES. The
 * relationship is `span ≈ 360 / 2^zoom` for longitude at the equator, which puts
 * z15 at roughly 0.011°. Rounded to 0.01, that is a viewport about 1.1 km tall —
 * a street-and-neighbourhood view, close enough to see which block the property
 * is on and wide enough that a slightly imprecise pin does not look absurd.
 *
 * Latitude and longitude spans are set EQUAL rather than corrected for the
 * cos(latitude) convergence of meridians. react-native-maps expands whichever
 * delta it needs to match the view's aspect ratio, so pre-compensating here
 * would be arithmetic the platform immediately overrides.
 */
const DETAIL_SPAN_DEGREES = 0.01;

/** Tall enough to give the pin context, short enough to leave the page scrollable. */
const MAP_HEIGHT = 220;

type Props = {
  /**
   * Accepts either shape. The detail screen passes a PropertyDetail; the list
   * map will pass PropertySummary. Both carry `location` from the same
   * serializer, so one component serves both with no adapter.
   */
  property: PropertySummary | PropertyDetail;
  /** Announced to screen readers as the label of the map region. */
  accessibilityLabel: string;
};

/**
 * One property, one marker.
 *
 * ── Renders NOTHING when the property may not be mapped ─────────────────
 * Gated on the identical predicate the website uses and the later list map will
 * use, so "approximate beats coordinates" is decided in one place
 * (utils/property-location.ts) and merely obeyed here. This is a second gate,
 * not the only one — the details screen also branches before reaching this
 * component — and that redundancy is intentional: it means no future caller can
 * render this component into a privacy leak by forgetting a check.
 *
 * ── No third-party geocoding, no coordinate in a URL ────────────────────
 * The coordinate goes to the native Google/Apple map SDK as a region, which is
 * the same trust boundary any map on the device crosses. Nothing here builds a
 * static-map URL, an embed iframe or a geocode request, and nothing is sent for
 * a property whose coordinate the server withheld — the component returns null
 * before a provider is ever touched.
 */
export function SinglePropertyMap({ property, accessibilityLabel }: Props) {
  const styles = useThemedStyles(makeStyles);
  const coordinates = getPublicCoordinates(property);

  // Belt and braces: getPublicCoordinates already implies isPubliclyMappable,
  // but stating both makes the guard obvious to anyone reading only this file.
  if (!coordinates || !isPubliclyMappable(property)) return null;

  return (
    <View
      style={styles.frame}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <MapView
        /*
          PROVIDER_DEFAULT, not PROVIDER_GOOGLE. On Android the default IS
          Google Maps, so the map is identical there; on iOS it is Apple Maps,
          which needs no API key, no billing account and no extra app config.
          Forcing Google on iOS would mean a second key and a second SDK for a
          map that shows the same street.
        */
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        /*
          The PROPERTY determines the region — never a hardcoded city. A
          listing outside Istanbul, or a future one in another country, centres
          on itself with no code change.
        */
        initialRegion={{
          ...coordinates,
          latitudeDelta: DETAIL_SPAN_DEGREES,
          longitudeDelta: DETAIL_SPAN_DEGREES,
        }}
        /*
          ── Gesture policy, and why ─────────────────────────────────────
          This map lives inside the Property Details ScrollView. A native map
          that accepts one-finger drags swallows the vertical pan, and the page
          stops scrolling wherever the customer's thumb happens to land — the
          single most irritating thing an embedded map can do, and the mobile
          equivalent of the scroll-wheel capture the website already disables.

          So: one finger always scrolls the PAGE (scrollEnabled off), two
          fingers zoom the MAP (zoomEnabled on). A pinch is never a scroll, so
          the two gestures cannot be confused, and the customer keeps a real
          way to look closer without a separate full-screen route.

          Rotate and pitch are off because a tilted, north-off map of a single
          pin communicates nothing and is easy to trigger by accident. The
          Android toolbar (the Google Maps / directions shortcuts that appear
          after tapping a marker) is off too: it overlays the map with buttons
          that leave the app, which is not what a location preview is for.
        */
        scrollEnabled={false}
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        /*
          The compass and the "my location" dot both belong to a map you can
          navigate. This one has neither a heading to correct nor — in this
          phase — permission to know where the device is.
        */
        showsCompass={false}
        showsMyLocationButton={false}
        /*
          The default marker, on purpose. Price bubbles need a compact price
          formatter that does not exist yet, across six languages, two scripts
          and inconsistent priceLabel data — that is its own piece of work, not
          a detail of proving the map stack.
        */
        >
        <Marker coordinate={coordinates} title={property.title} description={property.district} />
      </MapView>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    /*
      Only the FRAME is themed. The map canvas is geography rendered by the
      platform SDK, and re-tinting it would take custom map styling that adds
      no information — the surrounding card is what has to belong to Varlikent.
    */
    frame: {
      height: MAP_HEIGHT,
      marginHorizontal: 0,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.marble,
      // Clips the map's own square corners to the card radius. Required on
      // Android, where a child surface ignores the parent's borderRadius.
      overflow: 'hidden',
    },
    map: { flex: 1 },
  });
