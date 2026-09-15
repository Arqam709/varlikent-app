import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import MapPropertyPreview from '@/components/properties/map-property-preview';
import {
  NearMeButton,
  NearMeEmptyRadiusCard,
  NearMeFallbackBanner,
  RadiusButton,
  RadiusSheet,
  RecenterButton,
} from '@/components/properties/near-me-controls';
import PropertyFilterPanel, { type AreasState } from '@/components/properties/property-filter-panel';
import {
  PropertiesMapView,
  type PropertiesMapHandle,
} from '@/components/properties/property-map';
import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import {
  getCurrentCoordinates,
  type LocationFailure,
} from '@/features/location/device-location';
import {
  getProperties,
  getPropertyAreas,
  type PropertySecondaryFilters,
} from '@/features/properties/properties-api';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';
import type { PropertyArea, PropertySummary } from '@/types/property';
import { formatDistanceKm } from '@/utils/format-distance';
import {
  DEFAULT_NEAR_ME_RADIUS_KM,
  getNearMeResults,
  regionForRadius,
  type NearMeRadiusKm,
} from '@/utils/near-me';
import { selectMappableProperties, type PublicCoordinates } from '@/utils/property-location';
import {
  countActiveFilters,
  fromMapParams,
  toPropertyListFilters,
} from '@/utils/property-map-filters';

/**
 * THE DEDICATED PROPERTIES MAP.
 *
 * ── Why a pushed stack screen and not a fifth tab ───────────────────────
 * The map is a way of looking at the Properties SEARCH, not a separate
 * destination. Making it a tab would say the opposite: that a customer can
 * arrive at "the map" without having a query, and that the map's results are
 * unrelated to the list's. Pushing it over the Properties tab also solves
 * "preserve the filters when going back" without writing any code — the tab
 * screen is never unmounted, so its filter state is exactly where it was.
 *
 * The route is /properties/map, a static sibling of /properties/[id]. Static
 * segments win over dynamic ones in Expo Router, and no property id can
 * collide with it: they are 24-character hex ObjectIds.
 *
 * ── Where the query comes from ──────────────────────────────────────────
 * Route params, parsed and re-validated by `fromMapParams`. Only the QUERY
 * travels — never property objects — so this screen refetches and can never
 * render a snapshot that went stale while the customer was reading the list.
 *
 * ── Near Me ─────────────────────────────────────────────────────────────
 * Foreground-only, user-initiated, and entirely client-side: the same complete
 * result set, the same privacy gate, then a haversine radius filter. Nothing
 * about the customer's position leaves this screen — see the state comment
 * below. Near Me LAYERS ON TOP of the query and never clears a filter.
 *
 * ── What this screen deliberately does NOT do yet ───────────────────────
 * No background location, no tracking, no geofencing, no backend geo query, no
 * price bubbles, no clustering, no "search this area", no radius overlay
 * circle. The shape here — a result set, a privacy filter, a distance filter,
 * markers, a selection, a preview — is what makes each of those an addition
 * rather than a rewrite.
 */

/**
 * How much map the chrome covers, in points.
 *
 * Passed to `fitToCoordinates` as edge padding so the outermost pins are never
 * tucked under the header or the preview card. Measured against what this
 * screen actually renders rather than guessed: the header row plus its padding,
 * and the preview card at its tallest (thumbnail + action button + padding).
 *
 * The bottom value is applied whether or not a preview is currently showing.
 * Fitting tighter while nothing is selected, then having the first marker tap
 * hide a pin behind the card that just appeared, is worse than a slightly
 * generous margin that never moves.
 */
const HEADER_FIT_PADDING = 96;
const PREVIEW_FIT_PADDING = 190;
const SIDE_FIT_PADDING = 56;

type LoadState = 'loading' | 'success' | 'error';

export default function PropertiesMapScreen() {
  const { t, language } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row } = useDirection();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  /**
   * The query this screen opened with.
   *
   * Parsed ONCE from the route params. After that the panel owns the secondary
   * filters, because the customer can change them here — but the segment
   * (All/Buy/Rent) stays as the list left it: this screen shows no segmented
   * control, so nothing on it can change that part of the query.
   */
  const initialQuery = useMemo(() => fromMapParams(params), [params]);

  const [filters, setFilters] = useState<PropertySecondaryFilters>(initialQuery.filters);
  const [panelOpen, setPanelOpen] = useState(false);

  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  /** Map-only UI state, deliberately local — never lifted into a context. */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * NEAR ME.
   *
   * ── Where the customer's coordinate lives, and only here ────────────
   * `origin` is component state on ONE screen. It is never written to
   * AsyncStorage, never placed in route params, never sent to the backend,
   * never logged. Leaving this screen drops it, and re-entering asks the
   * device again. That is the whole storage story, deliberately.
   *
   * A single nullable object rather than parallel `isActive` / `origin` /
   * `radius` flags: "active" and "has a position" cannot then disagree, so
   * there is no state in which the radius filter runs against a null origin.
   */
  const [nearMe, setNearMe] = useState<{
    origin: PublicCoordinates;
    radiusKm: NearMeRadiusKm;
  } | null>(null);
  const [nearMeBusy, setNearMeBusy] = useState(false);
  const [nearMeFailure, setNearMeFailure] = useState<LocationFailure | null>(null);
  const [radiusSheetOpen, setRadiusSheetOpen] = useState(false);

  /**
   * The customer has asked to see the nearest properties OUTSIDE their radius.
   *
   * Opt-in only, and reset whenever the question changes — a new radius or new
   * filters are a new search, and the customer should choose the fallback for
   * that search rather than inherit it. The EFFECTIVE mode is derived below
   * rather than read straight from this flag, so it can never go stale.
   */
  const [showClosest, setShowClosest] = useState(false);

  /** Commands the camera for activation, radius changes and recenter. */
  const mapHandle = useRef<PropertiesMapHandle>(null);

  const [areas, setAreas] = useState<PropertyArea[]>([]);
  const [areasState, setAreasState] = useState<AreasState>('loading');

  const loadAreas = useCallback(async () => {
    setAreasState('loading');
    try {
      setAreas(await getPropertyAreas());
      setAreasState('success');
    } catch {
      // Its own state, so a failing /areas can never break the map itself —
      // only the District section of the filter panel.
      setAreasState('error');
    }
  }, []);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  /**
   * The SAME request the list makes, with the same filters.
   *
   * `GET /api/properties` has no pagination — the route reads no limit/page
   * param and applies no `.limit()`, returning every match with
   * `count = properties.length`. So one call is the COMPLETE result set, and
   * this map shows the whole search rather than whichever page the list
   * happened to have scrolled to. If pagination is ever added to that endpoint,
   * this is the line that has to grow a loop.
   */
  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const result = await getProperties(
        toPropertyListFilters({ segment: initialQuery.segment, filters })
      );
      setProperties(result.properties);
      setLoadState('success');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('common.somethingWentWrong'));
      setLoadState('error');
    }
  }, [initialQuery.segment, filters, t]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * THE MAP DATASET.
   *
   *   filtered results (same query as the list)
   *     -> privacy gate            selectMappableProperties
   *     -> radius, when Near Me is on   haversine, client-side
   *
   * The privacy gate runs FIRST in both branches, so a listing whose exact
   * coordinate the server withheld is never measured, never counted and never
   * plotted. Near Me LAYERS ON TOP of the query — it narrows, and it never
   * clears listing type, district, price, beds, property type or featured.
   *
   * All of it is local arithmetic over a result set the screen already has:
   * changing the radius recomputes, it does not refetch.
   */
  /**
   * Measured ONCE per (results, origin, radius), then classified.
   *
   * Every Near Me number on this screen comes out of this one call — which
   * markers to draw, whether the radius is empty, how far the closest
   * alternative is, and the figure on the preview card. Computing them
   * separately is how two parts of one screen end up disagreeing.
   */
  const nearMeResults = useMemo(
    () =>
      nearMe
        ? getNearMeResults(properties, nearMe.origin, nearMe.radiusKm)
        : { withinRadius: [], outsideRadius: [], closestOutside: [] },
    [properties, nearMe]
  );

  /**
   * Whether out-of-radius properties are actually on screen.
   *
   * DERIVED, not stored. The flag alone is not enough: once the radius widens
   * far enough to contain something, or the filters change so that it does,
   * fallback stops being meaningful and must stop applying immediately —
   * without waiting for an effect to notice and without a frame of stale
   * markers. Expressing it as a derivation makes those states unreachable.
   */
  const fallbackActive =
    nearMe !== null &&
    showClosest &&
    nearMeResults.withinRadius.length === 0 &&
    nearMeResults.closestOutside.length > 0;

  const visible = useMemo(() => {
    if (!nearMe) return selectMappableProperties(properties);
    return fallbackActive ? nearMeResults.closestOutside : nearMeResults.withinRadius;
  }, [properties, nearMe, fallbackActive, nearMeResults]);

  /** What the map is given. Re-gated inside the component as well. */
  const visibleProperties = useMemo(() => visible.map((entry) => entry.property), [visible]);

  /**
   * Distance by property id, for whatever is currently on screen.
   *
   * Formatted here rather than in the preview so the card cannot round
   * differently from the number that decided the radius split, and so the
   * locale lives in one place. Empty while Near Me is off — there is no origin,
   * so there is no distance to state.
   */
  const distanceLabels = useMemo(() => {
    const labels = new Map<string, string>();
    if (!nearMe) return labels;

    /*
      Built from the MEASURED results rather than from `visible`, which is a
      union of measured and unmeasured entries depending on whether Near Me is
      on. Reading it from the typed source keeps this honest — there is no cast
      and no `'distanceKm' in entry` probe that could silently start failing.

      withinRadius and closestOutside are disjoint by construction, and between
      them they cover every property that can be selected while Near Me is on.
    */
    for (const entry of [...nearMeResults.withinRadius, ...nearMeResults.closestOutside]) {
      labels.set(entry.property._id, formatDistanceKm(entry.distanceKm, language));
    }
    return labels;
  }, [nearMeResults, nearMe, language]);

  /** How far the nearest OUT-OF-RADIUS property is, ready to display. */
  const closestOutsideLabel = useMemo(() => {
    const nearest = nearMeResults.closestOutside[0];
    return nearest ? formatDistanceKm(nearest.distanceKm, language) : null;
  }, [nearMeResults, language]);

  /**
   * How far PAST the chosen radius the nearest property sits.
   *
   * ── Why this exists alongside the real distance ─────────────────────────
   * They answer different questions, and on a device only showing the first
   * one is actively confusing. "Closest property is 12.9 km away" is a fact
   * about the property and does not change when the radius does — so stepping
   * 1 km -> 5 km -> 10 km shows the same 12.9 three times and looks broken,
   * even though it is correct. This line is the one that moves: 11.9, then
   * 7.9, then 2.9. It answers "why is this not in my search, and how much
   * would I have to widen it?"
   *
   * Subtracted from the RAW distance, before any rounding — rounding first
   * could show "2.9 km outside" for a property that is really 2.94 km out, or
   * worse produce a 0.0 for one that is genuinely outside.
   *
   * Null whenever there is nothing to say: no fallback property, or a distance
   * that is not actually past the radius. The `> 0` guard means a negative can
   * never be formatted — a property at or inside the radius is not a fallback
   * at all, and `getNearMeResults` would not have put it in `closestOutside`.
   */
  const closestOutsideByLabel = useMemo(() => {
    const nearest = nearMeResults.closestOutside[0];
    if (!nearest || !nearMe) return null;

    const outsideByKm = nearest.distanceKm - nearMe.radiusKm;
    if (!(outsideByKm > 0)) return null;

    return formatDistanceKm(outsideByKm, language);
  }, [nearMeResults, nearMe, language]);

  const selected = useMemo(
    () => visible.find((entry) => entry.property._id === selectedId)?.property ?? null,
    [visible, selectedId]
  );

  /**
   * Drop a selection that the current result set no longer contains.
   *
   * Without this, changing the filters leaves the previous property's card
   * floating over a map that no longer has its marker — the customer would be
   * reading about a listing that is not in their search any more.
   */
  useEffect(() => {
    if (selectedId !== null && !visible.some((e) => e.property._id === selectedId)) {
      setSelectedId(null);
    }
  }, [visible, selectedId]);

  const activeFilterCount = countActiveFilters(filters);

  /**
   * The ONLY place a permission prompt can originate.
   *
   * Nothing asks at startup, and nothing asks when the map merely opens —
   * a prompt with no context is the one most reliably denied. It appears when
   * the customer taps a control named "Near me", where the reason is obvious.
   *
   * `getCurrentCoordinates` checks the existing grant before requesting, so
   * repeat taps on an already-denied permission never re-prompt.
   */
  const enableNearMe = useCallback(async () => {
    setNearMeBusy(true);
    setNearMeFailure(null);

    const result = await getCurrentCoordinates();

    if (!result.ok) {
      setNearMeFailure(result.failure);
      setNearMeBusy(false);
      return;
    }

    const radiusKm = DEFAULT_NEAR_ME_RADIUS_KM;
    setNearMe({ origin: result.coordinates, radiusKm });
    setShowClosest(false);
    setNearMeBusy(false);

    // The camera follows the RADIUS, not the nearby results: it always centres
    // the customer, and it still says something useful when nothing is nearby.
    mapHandle.current?.focusRegion(regionForRadius(result.coordinates, radiusKm));
  }, []);

  /**
   * Turning it off restores the normal mappable set and hands the camera back
   * to the map's own fit. It does NOT touch the property filters — Near Me is
   * a map discovery tool layered over the search, not part of it.
   */
  const disableNearMe = useCallback(() => {
    setNearMe(null);
    setNearMeFailure(null);
    setRadiusSheetOpen(false);
    setShowClosest(false);
  }, []);

  const handleRadiusChange = useCallback((radiusKm: NearMeRadiusKm) => {
    setRadiusSheetOpen(false);
    /*
      A new radius is a new question. If the wider radius now contains
      something, the customer wants those real results; if it is still empty,
      they should choose the fallback again for THIS radius rather than inherit
      a decision they made about a different one.
    */
    setShowClosest(false);
    setNearMe((current) => {
      if (!current) return current;
      // Local recompute only — no request is made for a radius change.
      mapHandle.current?.focusRegion(regionForRadius(current.origin, radiusKm));
      return { ...current, radiusKm };
    });
  }, []);

  /**
   * Back to the customer's own position after they have panned away.
   *
   * Uses the origin ALREADY held in state — deliberately no new location
   * request, and therefore no chance of a permission prompt reappearing.
   */
  /**
   * Reveal the nearest out-of-radius properties, and frame them WITH the
   * customer.
   *
   * The camera fits the origin plus the fallback markers, because the distance
   * is the point: seeing the pins without seeing where you are relative to them
   * says nothing. Radius mode keeps its own radius-derived region, so this does
   * not change normal Near Me camera behaviour — it is a one-shot fit.
   */
  const handleShowClosest = useCallback(() => {
    if (!nearMe || nearMeResults.closestOutside.length === 0) return;

    setShowClosest(true);
    mapHandle.current?.fitCoordinates([
      nearMe.origin,
      ...nearMeResults.closestOutside.map((entry) => entry.coordinates),
    ]);
  }, [nearMe, nearMeResults]);

  const handleRecenter = useCallback(() => {
    if (!nearMe) return;
    mapHandle.current?.focusRegion(regionForRadius(nearMe.origin, nearMe.radiusKm));
  }, [nearMe]);

  const handleBack = useCallback(() => {
    // Fallback for the deep-link case, where this screen can be the first in
    // the stack and there is nothing to go back to.
    if (router.canGoBack()) router.back();
    else router.replace('/properties');
  }, [router]);

  const edgePadding = useMemo(
    () => ({
      top: HEADER_FIT_PADDING + insets.top,
      right: SIDE_FIT_PADDING,
      bottom: PREVIEW_FIT_PADDING + insets.bottom,
      left: SIDE_FIT_PADDING,
    }),
    [insets.top, insets.bottom]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={t('propertiesMap.title')}
        onBack={handleBack}
        right={
          <Pressable
            onPress={() => setPanelOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0
                ? t('properties.filtersActiveAccessibility', { count: String(activeFilterCount) })
                : t('properties.filters')
            }
            hitSlop={8}
            style={[
              styles.filterButton,
              { flexDirection: row },
              activeFilterCount > 0 && styles.filterButtonActive,
            ]}>
            <Ionicons
              name="options-outline"
              size={16}
              color={activeFilterCount > 0 ? theme.brandGreen : theme.textMuted}
            />
            <Text style={[styles.filterText, activeFilterCount > 0 && styles.filterTextActive]}>
              {activeFilterCount > 0
                ? t('properties.filtersWithCount', { count: String(activeFilterCount) })
                : t('properties.filters')}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.canvas}>
        {loadState === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.primaryInk} />
          </View>
        ) : loadState === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.stateHeading}>{t('properties.loadError')}</Text>
            <Text style={styles.stateBody}>{errorMessage}</Text>
            <Button
              label={t('common.retry')}
              variant="primary"
              onPress={() => load()}
              style={styles.stateAction}
            />
          </View>
        ) : visible.length === 0 && nearMe === null ? (
          /*
            NOT an empty map centred on Istanbul. "We have no map locations for
            these results" and "there is nothing here" are different statements,
            and a blank map makes the second one on the first one's behalf. The
            copy is the website's, which is deliberately vague about WHY a
            listing is missing — naming which ones are private would leak the
            very thing the approximate setting exists to hide.
          */
          <View style={styles.centered}>
            <Ionicons name="map-outline" size={48} color={theme.textMuted} />
            {/*
              One line only. The second line here used to be
              `noMappedPropertiesHint` — "Some properties have private or
              unavailable map locations" — which was deleted from all six
              bundles when the hidden-count disclosure was removed, but the
              reference was left behind. `t()` falls back to returning the KEY,
              so this rendered the literal text "propertiesMap
              .noMappedPropertiesHint" on screen. The fix is to drop the line:
              the copy was the disclosure we deliberately removed.
            */}
            <Text style={styles.stateHeading}>{t('propertiesMap.noMappedProperties')}</Text>

            {activeFilterCount > 0 ? (
              <Button
                label={t('properties.clearFilters')}
                variant="secondary"
                onPress={() => setFilters({})}
                style={styles.stateAction}
              />
            ) : null}

            <Button
              label={t('propertiesMap.backToList')}
              variant="primary"
              onPress={handleBack}
              style={styles.stateAction}
            />
          </View>
        ) : (
          <>
            {/*
              `selectedId` is deliberately NOT passed down. Selection lives
              here and drives the preview card only; the map's markers must not
              vary with it, because mutating a native marker property on
              selection is what crashed Android (see the marker comment in
              property-map.tsx).
            */}
            <PropertiesMapView
              ref={mapHandle}
              properties={visibleProperties}
              onSelect={(property) => setSelectedId(property._id)}
              onDeselect={() => setSelectedId(null)}
              edgePadding={edgePadding}
              accessibilityLabel={t('propertiesMap.mapLabel')}
              /*
                The platform's own blue dot, and only once permission has
                actually been granted — `nearMe` is non-null only after a
                successful position, so this can never be true without it.
              */
              showsUserLocation={nearMe !== null}
              /*
                While Near Me is on, the camera belongs to the radius, not to
                the markers. Otherwise narrowing the radius would refit to
                whatever remained and push the customer's own position off
                screen.
              */
              autoFit={nearMe === null}
            />

            {/*
              Floating map controls, upper-leading edge, below the header.
              `box-none` so only the pills themselves take touches and the map
              stays draggable everywhere around them.
            */}
            <View style={styles.controls} pointerEvents="box-none">
              <View style={[styles.controlsRow, { flexDirection: row }]} pointerEvents="box-none">
                <NearMeButton
                  active={nearMe !== null}
                  busy={nearMeBusy}
                  radiusKm={nearMe?.radiusKm ?? DEFAULT_NEAR_ME_RADIUS_KM}
                  onPress={nearMe ? disableNearMe : enableNearMe}
                />

                {/* Appears only while active — nothing to choose otherwise. */}
                {nearMe ? (
                  <RadiusButton
                    radiusKm={nearMe.radiusKm}
                    onPress={() => setRadiusSheetOpen(true)}
                  />
                ) : null}
              </View>

              {/*
                Permission and availability problems, stated where the control
                that caused them is. 'blocked' is the only one the customer
                cannot resolve in-app, so it is the only one offering Settings.
              */}
              {nearMeFailure ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>
                    {t(`propertiesMap.location${
                      nearMeFailure === 'denied'
                        ? 'Denied'
                        : nearMeFailure === 'blocked'
                          ? 'Blocked'
                          : nearMeFailure === 'services-disabled'
                            ? 'ServicesOff'
                            : 'Unavailable'
                    }`)}
                  </Text>

                  <View style={[styles.noticeActions, { flexDirection: row }]}>
                    {nearMeFailure === 'blocked' ? (
                      <Pressable
                        onPress={() => Linking.openSettings()}
                        accessibilityRole="button"
                        accessibilityLabel={t('propertiesMap.openSettings')}
                        style={styles.noticeAction}>
                        <Text style={styles.noticeActionText}>
                          {t('propertiesMap.openSettings')}
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={() => setNearMeFailure(null)}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.close')}
                      style={styles.noticeAction}>
                      <Text style={styles.noticeActionText}>{t('common.close')}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Trailing edge, clear of the preview card. */}
            {nearMe ? (
              <View
                style={[styles.recenterSlot, { bottom: PREVIEW_FIT_PADDING + insets.bottom }]}
                pointerEvents="box-none">
                <RecenterButton onPress={handleRecenter} />
              </View>
            ) : null}

            {/*
              Overlays rather than a column, so the map occupies the whole
              canvas and the pins behind the card are still visible around it.
              `pointerEvents="box-none"` lets taps fall through the empty area
              to the map underneath — otherwise this container would swallow
              every marker tap in the bottom third of the screen.
            */}
            <View
              style={[styles.overlay, { paddingBottom: Spacing.md + insets.bottom }]}
              pointerEvents="box-none">
              {selected ? (
                <MapPropertyPreview
                  property={selected}
                  /*
                    Undefined while Near Me is off, which is what hides the line
                    entirely. The value is already formatted and comes from the
                    same measurement that classified the property, so the card
                    cannot state a distance that disagrees with the radius split.
                  */
                  distanceLabel={distanceLabels.get(selected._id)}
                  onViewProperty={() =>
                    // The SAME route the list cards use. Only the id travels;
                    // the detail screen refetches.
                    router.push({ pathname: '/properties/[id]', params: { id: selected._id } })
                  }
                />
              ) : nearMe && nearMeResults.withinRadius.length === 0 && !fallbackActive ? (
                /*
                  The radius is genuinely empty. Say so plainly, then offer the
                  nearest alternative as a SEPARATE, explicit choice — never by
                  quietly widening the search, which would break the promise the
                  selected radius makes.
                */
                <NearMeEmptyRadiusCard
                  radiusKm={nearMe.radiusKm}
                  closestDistanceLabel={closestOutsideLabel}
                  closestOutsideByLabel={closestOutsideByLabel}
                  onShowClosest={handleShowClosest}
                />
              ) : fallbackActive && nearMe ? (
                /*
                  Markers are on screen that are OUTSIDE the chosen radius.
                  Without this banner the map would show pins immediately after
                  saying "no properties within 5 km", which reads as a bug — or
                  worse, as a claim that they are within it.
                */
                <NearMeFallbackBanner radiusKm={nearMe.radiusKm} />
              ) : (
                /*
                  The old "N listings are not shown because their locations are
                  private or unavailable" pill is GONE. It spent permanent map
                  space narrating an implementation detail, and the count itself
                  was a disclosure: subtracting it from the result count told a
                  customer exactly how many listings were being withheld.

                  What remains is either a nudge, or — while Near Me is on with
                  nothing in range — the one fact that IS actionable, since the
                  fix is to widen the radius.
                */
                /*
                  The empty-radius case is handled by the card above now, so
                  this is only ever the nudge for a map that has markers on it.
                */
                <View style={styles.hint} pointerEvents="none">
                  <Text style={styles.hintText}>{t('propertiesMap.tapMarkerHint')}</Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>

      {/*
        The SAME panel the list uses, with the same props. Sharing the component
        rather than building a map-only filter form is what guarantees the two
        screens offer identical criteria — and means a filter added later
        appears on both at once.
      */}
      <RadiusSheet
        visible={radiusSheetOpen}
        radiusKm={nearMe?.radiusKm ?? DEFAULT_NEAR_ME_RADIUS_KM}
        onSelect={handleRadiusChange}
        onClose={() => setRadiusSheetOpen(false)}
      />

      <PropertyFilterPanel
        visible={panelOpen}
        initialFilters={filters}
        areas={areas}
        areasState={areasState}
        onRetryAreas={loadAreas}
        onApply={(next) => {
          setFilters(next);
          setPanelOpen(false);
          /*
            New criteria mean a new result set, so any fallback computed from
            the old one is stale. Near Me itself and the selected radius stay —
            the customer narrowed their search, they did not ask to stop
            looking near themselves.
          */
          setShowClosest(false);
        }}
        onClose={() => setPanelOpen(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.softWhite },
    /** Everything below the header, so the map gets every remaining point. */
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
      marginTop: Spacing.sm,
    },
    stateBody: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      color: theme.textMuted,
      textAlign: 'center',
    },
    stateAction: { marginTop: Spacing.md, alignSelf: 'stretch' },

    /** Matches the list screen's filter pill exactly, so the two read as one app. */
    filterButton: {
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      minHeight: 36,
    },
    filterButtonActive: { borderColor: theme.brandGreen },
    filterText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: FontSizes.xs,
      color: theme.textMuted,
    },
    filterTextActive: {
      fontFamily: FontFamily.bodySemiBold,
      color: theme.primaryInk,
    },

    /** Floating controls, pinned below the header on the leading edge. */
    controls: {
      position: 'absolute',
      top: Spacing.md,
      left: Spacing.md,
      right: Spacing.md,
      gap: Spacing.sm,
    },
    controlsRow: { alignItems: 'center', gap: Spacing.sm },

    /** Trailing edge, sat above where the preview card appears. */
    recenterSlot: {
      position: 'absolute',
      right: Spacing.md,
      alignItems: 'flex-end',
    },

    notice: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      padding: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      gap: Spacing.sm,
      elevation: 3,
      shadowColor: theme.charcoal,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    noticeText: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      color: theme.text,
    },
    noticeActions: { alignItems: 'center', gap: Spacing.md },
    noticeAction: { minHeight: 36, justifyContent: 'center' },
    noticeActionText: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.sm,
      color: theme.primaryInk,
    },

    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: Spacing.md,
    },
    /**
     * The line shown while nothing is selected. Doubles as the place the
     * "some locations are private or unavailable" footnote appears, so that
     * disclosure has a home without adding permanent chrome.
     */
    hint: {
      alignSelf: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.border,
      opacity: 0.95,
    },
    hintText: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      color: theme.textMuted,
      textAlign: 'center',
    },
  });
