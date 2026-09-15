import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import type { PropertyDetail, PropertySummary } from '@/types/property';
import type { MapRegion } from '@/utils/near-me';
import {
  getPublicCoordinates,
  isPubliclyMappable,
  selectMappableProperties,
  type MappablePropertyEntry,
  type PublicCoordinates,
} from '@/utils/property-location';

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
  /**
   * Turns this into a PREVIEW that opens something bigger.
   *
   * When given, the map stops handling touches entirely and a Pressable covers
   * it — see the note on the overlay below for why that is the reliable
   * arrangement rather than the convenient one. Omit it and the component
   * behaves exactly as it did before: a small map you can pinch but not open.
   */
  onPress?: () => void;
  /** Visible affordance text, e.g. "View map". Required when `onPress` is set. */
  pressLabel?: string;
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
export function SinglePropertyMap({
  property,
  accessibilityLabel,
  onPress,
  pressLabel,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row } = useDirection();
  const coordinates = getPublicCoordinates(property);

  // Belt and braces: getPublicCoordinates already implies isPubliclyMappable,
  // but stating both makes the guard obvious to anyone reading only this file.
  if (!coordinates || !isPubliclyMappable(property)) return null;

  /*
    ── Why the map gives up its touches entirely in preview mode ─────────
    A native MapView consumes gestures at the native level. Layering a
    Pressable over an interactive map and hoping the tap arrives first is a
    race — and on Fabric it is the kind of race that behaves differently
    between devices, which is the worst sort of bug to chase.

    So preview mode does not race it: `pointerEvents="none"` means the map
    handles nothing at all, and every touch in the frame belongs to the overlay.
    Two things follow, both improvements:

      * page scrolling ALWAYS wins, with no gesture policy to tune;
      * the preview loses pinch-zoom — which it no longer needs, because the
        tap now opens a full screen built for exactly that.
  */
  const isPreview = typeof onPress === 'function';

  return (
    <View
      style={styles.frame}
      /*
        Interactive previews must NOT be announced as one static image, or the
        overlay button below becomes unreachable. The non-pressable form keeps
        its original image semantics.
      */
      accessible={!isPreview}
      accessibilityRole={isPreview ? undefined : 'image'}
      accessibilityLabel={isPreview ? undefined : accessibilityLabel}>
      <MapView
        pointerEvents={isPreview ? 'none' : 'auto'}
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

      {isPreview ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          // Names the destination, not the gesture: "Open full map for X" tells
          // a screen-reader user what they get, which "map, button" does not.
          accessibilityLabel={accessibilityLabel}
          style={StyleSheet.absoluteFill}>
          {/*
            A small corner chip rather than a button across the map. The whole
            frame is already the tap target; this exists so a sighted customer
            can tell that it IS one.
          */}
          <View style={[styles.viewMapChip, { flexDirection: row }]} pointerEvents="none">
            <Text style={styles.viewMapLabel}>{pressLabel}</Text>
            <Ionicons name="expand-outline" size={12} color={theme.primaryInk} />
          </View>
        </Pressable>
      ) : null}
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
    /**
     * Bottom-trailing corner. `end` rather than `right` so it follows the
     * reading edge in Arabic and Urdu — the CHROME mirrors, the geography
     * underneath never does.
     */
    viewMapChip: {
      position: 'absolute',
      bottom: Spacing.sm,
      end: Spacing.sm,
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      opacity: 0.96,
    },
    viewMapLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.xs,
      color: theme.primaryInk,
    },
    /** The Properties map screen: the canvas IS the screen. */
    fullMap: { flex: 1 },
  });

/* ══════════════════════ MANY PROPERTIES ══════════════════════ */

/**
 * Span for a lone marker on a FULL-SCREEN map.
 *
 * Wider than the details map's 0.01: that map is a 220dp card where a tight
 * span reads as focus, while a full-screen map at the same span reads as being
 * lost in a housing estate with no landmark in view. ~0.03deg is roughly 3.3km
 * tall — the property plus enough surrounding district to recognise where it is.
 */
const SINGLE_RESULT_SPAN_DEGREES = 0.03;

/**
 * Padding used when fitting several markers, in points.
 *
 * Asymmetric on purpose. The header sits over the top of the map and the
 * preview card over the bottom, so an evenly-padded fit would tuck the
 * outermost pins underneath them. These numbers are the chrome heights plus a
 * margin, passed by the screen rather than guessed here would be better still —
 * but the screen owns those heights, so it passes them in as `edgePadding`.
 */
export type MapEdgePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * What the screen may command the camera to do.
 *
 * An imperative handle rather than a `region` prop, because "recenter" has to
 * work when the region has NOT changed: the customer pans away, taps recenter,
 * and expects to come back to the same place. A value prop cannot express
 * "do it again" without a nonce, which is a counter existing only to defeat
 * memoisation — this says what it means instead.
 *
 * React 19 accepts `ref` as an ordinary prop on function components, so this
 * needs no forwardRef and the component stays generic over its property type.
 */
export type PropertiesMapHandle = {
  focusRegion: (region: MapRegion, animated?: boolean) => void;
  /**
   * Frame an explicit set of points — used by "Show closest", which must show
   * the customer AND the out-of-radius properties it just revealed in one view.
   *
   * Distinct from the automatic marker fit: that one follows the result set and
   * is switched off entirely while Near Me owns the camera. This is a one-shot
   * command with a caller-chosen list, which is why it takes coordinates rather
   * than reading the component's own entries.
   */
  fitCoordinates: (coordinates: readonly PublicCoordinates[], animated?: boolean) => void;
};

type PropertiesMapProps<T extends PropertySummary> = {
  /**
   * The FULL result set, unfiltered by privacy. This component applies
   * `selectMappableProperties` itself rather than trusting the caller to have
   * done it — the same reason SinglePropertyMap re-checks its one property.
   */
  properties: readonly T[];
  /**
   * NOTE: selection is deliberately NOT a prop of this component.
   *
   * The screen owns `selectedId` and uses it to drive the preview card. It is
   * not passed down, because nothing here may vary with it — see the marker
   * comment below. Keeping it out of these props is what guarantees that a
   * selection change mutates no native marker property at all.
   */
  onSelect: (property: T) => void;
  /** Tapping the map background, away from any marker. */
  onDeselect: () => void;
  /** Keeps outermost pins clear of the header and the preview card. */
  edgePadding: MapEdgePadding;
  accessibilityLabel: string;
  /**
   * Draws the platform's own blue user-location dot.
   *
   * The NATIVE indicator, deliberately — not a Marker of our own. A custom
   * marker would need a colour prop, and colour props on markers are exactly
   * what crashed this screen before (see the marker comment below). The
   * platform dot also carries accuracy and heading for free and looks like
   * every other map on the device.
   *
   * Only ever true once foreground permission has actually been granted: on
   * Android the underlying my-location layer throws without it.
   */
  showsUserLocation?: boolean;
  /**
   * Whether the map may fit itself to its markers when the result set changes.
   *
   * Near Me turns this OFF and drives the camera through `focusRegion`
   * instead. Without the switch the two would fight: narrowing the radius
   * changes the entries, the fit effect would yank the camera to whatever
   * happened to remain, and the customer's own position would slide off screen.
   */
  autoFit?: boolean;
  ref?: Ref<PropertiesMapHandle>;
};

/**
 * MANY PROPERTIES, ONE MARKER EACH.
 *
 * ── Same gate, same file ────────────────────────────────────────────────
 * Deliberately lives beside SinglePropertyMap rather than in a module of its
 * own, mirroring the website's PropertyMapView.jsx, which keeps its list map
 * and its detail map together for exactly one reason: the privacy predicate
 * they share must be impossible to fork. Both components here route through
 * `selectMappableProperties` -> `getPublicCoordinates` -> `isPubliclyMappable`.
 * An approximate listing cannot become a marker through either door.
 *
 * ── Gestures, unlike the details map ────────────────────────────────────
 * This map owns the whole screen, so there is no parent ScrollView to fight
 * and every gesture is enabled. The details map disables one-finger panning
 * precisely because it is embedded; copying that restriction here would
 * cripple the one screen whose entire purpose is browsing the map.
 */
export function PropertiesMapView<T extends PropertySummary>({
  properties,
  onSelect,
  onDeselect,
  edgePadding,
  accessibilityLabel,
  showsUserLocation = false,
  autoFit = true,
  ref,
}: PropertiesMapProps<T>) {
  const styles = useThemedStyles(makeStyles);
  const mapRef = useRef<MapView>(null);

  const entries = useMemo(() => selectMappableProperties(properties), [properties]);

  /**
   * A stable description of WHICH pins are on the map.
   *
   * The camera refits when this string changes and at no other time. Comparing
   * the entries array by identity would refit on every render that produced a
   * new array — every theme toggle, every selection — yanking the camera away
   * from wherever the customer had just panned. Comparing ids and coordinates
   * means the fit happens when the RESULT SET genuinely changed, which is the
   * only time a refit is something the customer asked for.
   */
  const fitSignature = useMemo(
    () =>
      entries
        .map((e) => `${e.property._id}:${e.coordinates.latitude},${e.coordinates.longitude}`)
        .join('|'),
    [entries]
  );

  const fitToEntries = useCallback(
    (animated: boolean) => {
      const map = mapRef.current;
      if (!map || entries.length < 2) return;

      map.fitToCoordinates(
        entries.map((e) => e.coordinates),
        { edgePadding, animated }
      );
    },
    [entries, edgePadding]
  );

  /**
   * Refit when the result set changes — but only for two or more pins.
   *
   * A single pin is handled by `initialRegion` instead: fitToCoordinates on one
   * coordinate produces a degenerate zero-area bounding box, and the platforms
   * resolve that by zooming to maximum, which lands the customer on a rooftop
   * with no context at all.
   */
  /** Point the camera at an explicit region — Near Me activation and recenter. */
  const focusRegion = useCallback((region: MapRegion, animated = true) => {
    const map = mapRef.current;
    if (!map) return;

    // animateToRegion routes through the Fabric command path on New
    // Architecture; duration 0 is used for the non-animated case because the
    // library has no separate setRegion command.
    map.animateToRegion(region, animated ? 450 : 0);
  }, []);

  const fitCoordinates = useCallback(
    (coordinates: readonly PublicCoordinates[], animated = true) => {
      const map = mapRef.current;
      // fitToCoordinates on a single point produces a degenerate zero-area box,
      // which the platforms resolve by zooming to maximum — a rooftop view with
      // no context. Callers pass the origin plus at least one marker, so two is
      // the real minimum here.
      if (!map || coordinates.length < 2) return;

      map.fitToCoordinates([...coordinates], { edgePadding, animated });
    },
    [edgePadding]
  );

  useImperativeHandle(
    ref,
    () => ({ focusRegion, fitCoordinates }),
    [focusRegion, fitCoordinates]
  );

  useEffect(() => {
    // While Near Me owns the camera, the result set changing must not move it.
    if (!autoFit || !fitSignature) return;
    fitToEntries(true);
    // fitSignature, not entries: see the note on the signature above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignature, autoFit]);

  /**
   * The opening camera.
   *
   * One pin centres on it at a district-scale span. Several pins get the first
   * coordinate as a placeholder, immediately replaced by the fit below once the
   * map reports ready — initialRegion is required regardless, and a region
   * derived from a real result is a better first frame than a hardcoded city.
   */
  const initialRegion = useMemo(() => {
    const first: PublicCoordinates | undefined = entries[0]?.coordinates;
    if (!first) return undefined;

    return {
      ...first,
      latitudeDelta: SINGLE_RESULT_SPAN_DEGREES,
      longitudeDelta: SINGLE_RESULT_SPAN_DEGREES,
    };
  }, [entries]);

  /*
    Nothing to plot AND no user dot to show: the screen renders its own empty
    state, and drawing a map here would centre it on null island.

    But when Near Me is on, an empty result is exactly when the map is most
    worth keeping — the customer wants to see where they are and that nothing
    is nearby, then widen the radius. So the map survives zero entries as long
    as it has a user location to display.
  */
  if (entries.length === 0 && !showsUserLocation) return null;

  return (
    <MapView
      ref={mapRef}
      // Google on Android, Apple Maps on iOS. Same reasoning as the details
      // map: no second SDK and no second key for the same streets.
      provider={PROVIDER_DEFAULT}
      style={styles.fullMap}
      initialRegion={initialRegion}
      // Full-screen: every gesture belongs to the map.
      scrollEnabled
      zoomEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsCompass={false}
      /*
        The platform's own my-location BUTTON stays off even while the dot is
        shown: this screen provides its own recenter control, and two buttons
        doing the same thing in different corners is worse than one.
      */
      showsMyLocationButton={false}
      showsUserLocation={showsUserLocation}
      // Fires once the first frame is drawn, which is the earliest point
      // fitToCoordinates has a viewport to measure against. Not animated: the
      // opening frame should already be correct, not slide into place.
      onMapReady={() => {
        if (autoFit) fitToEntries(false);
      }}
      // Tapping bare map dismisses the preview, the standard maps idiom.
      onPress={onDeselect}
      accessible={false}
      accessibilityLabel={accessibilityLabel}>
      {entries.map(({ property, coordinates }: MappablePropertyEntry<T>) => {
        return (
          <Marker
            key={property._id}
            coordinate={coordinates}
            title={property.title}
            description={property.district}
            /*
              ── Why there is no pinColor here, and must not be ──────────────
              Tinting the selected pin crashed Android. react-native-maps
              1.27.2's Fabric MarkerManager declares

                  setPinColor(MapMarker view, @Nullable Integer value)

              and then calls `Color.colorToHSV(value, hsv)` with no null check.
              That overload takes a primitive `int`, so a null value is
              auto-unboxed and throws NullPointerException. The generated
              delegate hands nulls straight through — it null-guards the
              primitives beside it (`isPreselected`, `opacity`) but colours go
              via `ColorPropConverter.getColor(value, ...)`, which returns null
              for a null prop.

              So ANY `pinColor={selected ? colour : undefined}` pattern is a
              latent crash: the moment a marker stops being selected, Fabric
              diffs colour -> null and invokes that setter. There is no safe way
              to express "coloured when selected, default otherwise" through
              this prop on this version.

              The preview card is the selection indicator for now. A visually
              distinct selected marker returns with price bubbles, which need a
              custom marker VIEW rather than pinColor — a different mechanism
              that does not go through this setter at all.

              zIndex is gone for the same reason in miniature: it was the only
              other marker property that varied with selection, and a selection
              change should mutate NO native marker property. Every prop below
              is derived purely from the property itself, so Fabric diffs them
              to "unchanged" on every selection and calls no setter.
            */
            onPress={(event) => {
              // Without this the tap also reaches the map's own onPress and
              // immediately deselects what was just selected.
              event.stopPropagation();
              onSelect(property);
            }}
          />
        );
      })}
    </MapView>
  );
}

/* ══════════════════════ ONE PROPERTY, FULL SCREEN ══════════════════════ */

/**
 * Span for the dedicated Property Location screen.
 *
 * Sits deliberately between the other two. The details preview uses 0.01 (~1.1
 * km) because it is a 220dp card where tightness reads as focus. The Properties
 * browse map uses 0.03 for a lone result because that screen is about
 * discovering what is around. This screen answers "where is THIS property", so
 * it opens closer than browsing — but ~2.2 km still shows the arterial roads
 * and the surrounding blocks, rather than a single rooftop with no landmark in
 * view. The customer can zoom from there; the opening frame just has to be
 * legible.
 */
const LOCATION_SPAN_DEGREES = 0.02;

/**
 * The property's location, as a screen rather than a card.
 *
 * ── Same gate, third door ───────────────────────────────────────────────
 * Re-runs `getPublicCoordinates` and `isPubliclyMappable` itself rather than
 * trusting the screen that rendered it. That redundancy is the point: this
 * route is reachable by a hand-typed URL or a stale deep link, so the component
 * must refuse an approximate listing on its own account. Returning null lets
 * the screen show its unavailable state instead of a map.
 *
 * ── Fully interactive, unlike the preview ───────────────────────────────
 * There is no parent ScrollView to fight here, so every gesture belongs to the
 * map. That is the whole reason this screen exists.
 *
 * No user location and no permission request: this is about the PROPERTY. Near
 * Me lives on the Properties map and stays there.
 */
export function PropertyLocationMap({
  property,
  accessibilityLabel,
}: {
  property: PropertySummary | PropertyDetail;
  accessibilityLabel: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const coordinates = getPublicCoordinates(property);

  if (!coordinates || !isPubliclyMappable(property)) return null;

  return (
    <MapView
      // Google on Android, Apple Maps on iOS — the same provider the other two
      // maps use. No second SDK and no second key.
      provider={PROVIDER_DEFAULT}
      style={styles.fullMap}
      // The PROPERTY determines the centre. Never a hardcoded city.
      initialRegion={{
        ...coordinates,
        latitudeDelta: LOCATION_SPAN_DEGREES,
        longitudeDelta: LOCATION_SPAN_DEGREES,
      }}
      /*
        ── A NORMAL MAP, deliberately unlike the other two ─────────────────
        Pan, pinch, two-finger rotate and two-finger tilt are all on. The
        details PREVIEW disables interaction because it lives in a ScrollView;
        the Properties browse map keeps rotate/pitch off because north-up makes
        comparing many pins easier. Neither reason applies here: this screen is
        a destination in its own right, and inspecting the streets around one
        property is exactly when turning the map to match the road you will
        arrive on is useful.

        Verified safe under Fabric before enabling: react-native-maps 1.27.2's
        MapViewManager takes a PRIMITIVE boolean for setRotateEnabled,
        setPitchEnabled and setShowsCompass, and the generated delegate
        null-guards each (`value == null ? true : (boolean) value`). There is no
        unboxing path of the kind that made setPinColor crash.
      */
      scrollEnabled
      zoomEnabled
      rotateEnabled
      pitchEnabled
      /*
        The NATIVE compass, not a custom one. It appears once the map is rotated
        and tapping it restores north — standard platform behaviour, which is
        the whole point of not reinventing it.
      */
      showsCompass
      /*
        The Android toolbar stays off. It overlays Google Maps shortcuts after a
        marker tap that LEAVE the app. This screen now has an explicit, labelled
        Directions action instead, so a stray tap on the pin should never hand
        the customer off by surprise.
      */
      toolbarEnabled={false}
      // No location request on this screen, so no my-location button either.
      showsMyLocationButton={false}
      /*
        `accessible={false}` keeps the marker individually reachable rather than
        collapsing the whole interactive map into one static element — the
        opposite of what the details PREVIEW wants, and for the opposite reason.
      */
      accessible={false}
      accessibilityLabel={accessibilityLabel}>
      {/*
        One stable default marker. No pinColor, no zIndex, no custom view —
        every marker prop is derived purely from the property, which is the
        arrangement that ended the Fabric setPinColor crash.
      */}
      <Marker coordinate={coordinates} title={property.title} description={property.district} />
    </MapView>
  );
}
