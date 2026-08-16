import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PropertyCard from '@/components/properties/property-card';
import PropertyFilterPanel, { type AreasState } from '@/components/properties/property-filter-panel';
import Button from '@/components/ui/button';
import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import {
  getProperties,
  getPropertyAreas,
  type PropertySecondaryFilters,
} from '@/features/properties/properties-api';
import { ApiError } from '@/services/api-client';
import type { ListingType, PropertyArea, PropertySummary } from '@/types/property';

type LoadState = 'loading' | 'success' | 'error';

/**
 * The selected tab. Internally these are the backend's own enum values, so
 * nothing has to translate between UI state and query string — only the
 * user-facing LABEL differs ("Buy" reads better than "Sale").
 */
type Segment = 'All' | ListingType;

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Sale', label: 'Buy' },
  { value: 'Rent', label: 'Rent' },
];

function toSegment(value: unknown): Segment {
  return value === 'Sale' || value === 'Rent' ? value : 'All';
}

export default function PropertiesScreen() {
  const router = useRouter();
  const { listingType } = useLocalSearchParams<{ listingType?: string }>();

  const [segment, setSegment] = useState<Segment>(() => toSegment(listingType));
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [count, setCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  /**
   * APPLIED secondary filters — the ones currently driving requests. The
   * draft being edited lives inside the panel, so opening it and changing
   * options costs nothing until Apply.
   *
   * Kept separate from `segment` so switching All/Buy/Rent preserves them:
   * "apartments in Beylikdüzü" narrows to Sale or Rent rather than resetting.
   */
  const [filters, setFilters] = useState<PropertySecondaryFilters>({});
  const [panelOpen, setPanelOpen] = useState(false);

  /**
   * District options, loaded ONCE on mount with their own state.
   *
   * Loading on mount rather than lazily on open keeps the panel instant, and
   * separate state means a failing /areas can never block or break the
   * property list — the sections other than District stay fully usable.
   */
  const [areas, setAreas] = useState<PropertyArea[]>([]);
  const [areasState, setAreasState] = useState<AreasState>('loading');

  const loadAreas = useCallback(async () => {
    setAreasState('loading');
    try {
      setAreas(await getPropertyAreas());
      setAreasState('success');
    } catch {
      setAreasState('error');
    }
  }, []);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  useEffect(() => {
    setSegment(toSegment(listingType));
  }, [listingType]);

  /**
   * How many filter CATEGORIES are active — price counts once whether one
   * bound is set or both, so "Filters (2)" means two kinds of narrowing.
   */
  const activeFilterCount =
    (filters.district ? 1 : 0) +
    (filters.propertyType ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.beds !== undefined ? 1 : 0);

  /**
   * @param isRefresh pull-to-refresh keeps the current list on screen and
   *                  drives the spinner in the RefreshControl instead of
   *                  replacing everything with a full-screen loader.
   */
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadState('loading');
    }

    try {
      /**
       * ONE request combining the segment with the applied secondary filters.
       * 'All' contributes no listingType, so the URL stays plain when nothing
       * is selected. Pull-to-refresh runs through here too, which is why it
       * can never silently fall back to unfiltered results.
       */
      const result = await getProperties({
        ...(segment === 'All' ? {} : { listingType: segment }),
        ...filters,
      });
      setProperties(result.properties);
      setCount(result.count);
      setLoadState('success');
      setErrorMessage('');
    } catch (error) {

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Please try again.'
      );
      // A failed refresh keeps the properties already on screen rather than
      // blanking a working list.
      if (!isRefresh) setLoadState('error');
    } finally {
      setRefreshing(false);
    }
    // Both `segment` and `filters` are dependencies, so changing either
    // rebuilds `load` and the effect below re-runs it — one code path drives
    // first load, segment change, Apply, Clear and retry alike.
  }, [segment, filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Fixed header, so the title and controls stay put across all states. */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Istanbul</Text>
        <Text style={styles.title}>Properties</Text>
        <Text style={styles.subtitle}>Find your next home</Text>

        
        <View style={styles.segmented}>
          {SEGMENTS.map(({ value, label }) => {
            const active = segment === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSegment(value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${label} properties`}
                style={[styles.segment, active && styles.segmentActive]}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {/* Filters trigger on the left, result count on the right. */}
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setPanelOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0
                ? `Filters, ${activeFilterCount} active`
                : 'Filters'
            }
            style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}>
            <Ionicons
              name="options-outline"
              size={16}
              color={activeFilterCount > 0 ? Colors.brandGreen : Colors.textMuted}
            />
            <Text
              style={[styles.filterText, activeFilterCount > 0 && styles.filterTextActive]}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </Text>
          </Pressable>

          {loadState === 'success' ? (
            <Text style={styles.count}>
              {count} {count === 1 ? 'property' : 'properties'}
            </Text>
          ) : null}
        </View>
      </View>

      {loadState === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.brandGreen} />
        </View>
      ) : loadState === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>Unable to load properties</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button label="Try Again" variant="primary" onPress={() => load()} style={styles.retry} />
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              /*
                Only the id travels. The detail screen refetches, so it always
                shows current data and can read fields PropertySummary
                deliberately omits — rather than rendering a stale snapshot
                captured when the list was last loaded.
              */
              onPress={() =>
                router.push({ pathname: '/properties/[id]', params: { id: item._id } })
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.brandGreen}
              colors={[Colors.brandGreen]}
            />
          }
          // Only reachable on a genuine empty result — 'loading' and 'error'
          // are handled above, so zero results never reads as a failure.
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.stateBody}>
                {activeFilterCount > 0
                  ? 'No properties match these filters.'
                  : segment === 'Sale'
                    ? 'No properties for sale are available right now.'
                    : segment === 'Rent'
                      ? 'No properties for rent are available right now.'
                      : 'No properties available right now.'}
              </Text>

              {/*
                Recovery without reopening the sheet. Clears ONLY the secondary
                filters — the All/Buy/Rent segment is untouched, since that is
                controlled separately above.
              */}
              {activeFilterCount > 0 ? (
                <Button
                  label="Clear Filters"
                  variant="secondary"
                  onPress={() => setFilters({})}
                  style={styles.retry}
                />
              ) : null}
            </View>
          }
        />
      )}

      {/*
        Mounted alongside the list rather than replacing it, so the results
        stay visible behind the sheet. `initialFilters` seeds the draft each
        time it opens; `onApply` is the ONLY path that changes applied state,
        which is what keeps the request count at one per Apply.
      */}
      <PropertyFilterPanel
        visible={panelOpen}
        initialFilters={filters}
        areas={areas}
        areasState={areasState}
        onRetryAreas={loadAreas}
        onApply={(next) => {
          setFilters(next);
          setPanelOpen(false);
        }}
        onClose={() => setPanelOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.softWhite,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: Colors.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.xl,
    color: Colors.charcoal,
    marginTop: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  /** Track holding the three options. */
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.marble,
    borderRadius: Radius.full,
    padding: 3,
    marginTop: Spacing.md,
  },
  /** `flex: 1` gives each option an equal third at any screen width. */
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Comfortably above the 44dp minimum touch target.
    minHeight: 38,
  },
  segmentActive: {
    backgroundColor: Colors.brandGreen,
  },
  segmentText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  segmentTextActive: {
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primaryText,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    minHeight: 38,
  },
  /** Active filters are signalled by the brand green outline, kept subtle. */
  filterButtonActive: {
    borderColor: Colors.brandGreen,
  },
  filterText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  filterTextActive: {
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.brandGreen,
  },
  count: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  stateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retry: {
    marginTop: Spacing.md,
    alignSelf: 'stretch',
  },
});
