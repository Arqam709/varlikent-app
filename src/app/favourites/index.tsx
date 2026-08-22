import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PropertyCard from '@/components/properties/property-card';
import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { getFavourites } from '@/features/favourites/favourites-api';
import { useFavourites } from '@/features/favourites/favourites-context';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';
import type { PropertySummary } from '@/types/property';

/**
 * MY FAVOURITES  →  route "/favourites"
 *
 * Content, not a setting, which is why it sits at the top level beside
 * `properties/` and `notifications/` rather than under `account/`.
 *
 * ── Two sources, one truth ───────────────────────────────────────────────
 * This is the only screen that calls `GET /users/favourites`, because it is the
 * only one that needs populated property DOCUMENTS rather than ids. Everywhere
 * else — including the hearts on the cards below — reads FavouritesProvider.
 *
 * Those two are combined rather than merged: the fetch supplies the documents,
 * and `favouriteIds` decides which of them are currently saved. Keeping them
 * separate is what makes an optimistic un-favourite and its rollback both work
 * without a refetch. See `visibleProperties`.
 */

type LoadState = 'loading' | 'success' | 'error';

export default function FavouritesScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { status, token } = useAuth();
  const { favouriteIds, snapshotFavourites, reconcileFromServer } = useFavourites();

  /**
   * Everything the server has handed us this session.
   *
   * Deliberately NOT pruned when a property is un-favourited. If the request
   * behind that removal fails, the provider rolls `favouriteIds` back and the
   * card has to reappear — which is only possible if its document is still
   * here. Removal is expressed by filtering, never by deleting.
   */
  const [loadedProperties, setLoadedProperties] = useState<PropertySummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /** Distinguishes the first fetch from a focus refresh. */
  const hasLoadedRef = useRef(false);

  /**
   * @param silent Skips the full-screen spinner, for refreshes that happen
   *   while the list is already on screen.
   */
  const load = useCallback(
    async (silent = false) => {
      if (!token) return;

      if (!silent) setLoadState('loading');

      /**
       * Captured BEFORE the request, so anything the user favourites while it
       * is in flight counts as a local change the response cannot undo.
       */
      const snapshot = snapshotFavourites();

      try {
        const properties = await getFavourites(token);

        /**
         * The response is authoritative for the shared id Set as well as for
         * this screen — which is what makes a favourite added on the website
         * appear here AND fill the heart on Home, Properties and Details.
         *
         * A false return means the snapshot belonged to a previous session, so
         * these documents belong to a different account and are dropped rather
         * than rendered.
         */
        if (!reconcileFromServer(snapshot, properties.map((property) => property._id))) {
          return;
        }

        setLoadedProperties(properties);
        setLoadState('success');
        hasLoadedRef.current = true;
      } catch (error) {
        setErrorMessage(
          error instanceof ApiError ? error.message : t('common.somethingWentWrong')
        );
        // A failed silent refresh keeps the list that is already on screen
        // rather than replacing good content with an error panel.
        if (!silent) setLoadState('error');
      }
    },
    [token, t, snapshotFavourites, reconcileFromServer]
  );

  /**
   * Reload whenever the screen is focused.
   *
   * This is the reconciliation strategy, and it is the same one
   * notifications/alerts already uses. It exists for the one case the provider
   * cannot cover: favouriting property C from Home adds its ID to the shared
   * Set, but this screen has never fetched C's document and must not invent one
   * from an id. Coming back here refetches and C appears.
   *
   * After the first load the refetch is SILENT, so returning to the screen does
   * not blank an already-good list. `useFocusEffect` fires once per focus, not
   * per render, so there is no request loop and nothing is fetched per card.
   */
  useFocusEffect(
    useCallback(() => {
      if (status === 'authenticated') load(hasLoadedRef.current);
    }, [status, load])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  /**
   * What the list actually renders.
   *
   * The fetched documents, narrowed to those the provider still considers
   * saved. Every favourite interaction on this screen therefore resolves here:
   *
   *   tap a heart  → provider removes the id  → the card disappears at once
   *   request fails → provider restores the id → the card comes back
   *
   * Both fall out of the filter for free, with no per-card boolean state and no
   * refetch. The `_id` guard is defensive: `getFavourites` already drops
   * malformed entries, but a list renderer should never be the thing that
   * crashes on one.
   */
  const visibleProperties = useMemo(
    () => loadedProperties.filter((property) => property?._id && favouriteIds.has(String(property._id))),
    [loadedProperties, favouriteIds]
  );

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primaryInk} />
        </View>
      );
    }

    /**
     * A full screen-level gate rather than a redirect. The user deliberately
     * opened "My Favourites"; bouncing them straight to Login would hide what
     * they asked for and why signing in is worth it.
     */
    if (status !== 'authenticated') {
      return (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={28} color={theme.primaryInk} />
          </View>
          <Text style={styles.eyebrow}>{t('favourites.gateEyebrow')}</Text>
          <Text style={styles.stateHeading}>{t('favourites.gateTitle')}</Text>
          <Text style={styles.stateBody}>{t('favourites.gateDescription')}</Text>

          <Button
            label={t('common.signIn')}
            variant="primary"
            onPress={() => router.push('/login')}
            style={styles.stretch}
          />
          <Button
            label={t('common.createAccount')}
            variant="secondary"
            onPress={() => router.push('/register')}
            style={styles.stretchTight}
          />
        </View>
      );
    }

    if (loadState === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primaryInk} />
        </View>
      );
    }

    if (loadState === 'error') {
      return (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>{t('favourites.loadError')}</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button
            label={t('common.retry')}
            variant="primary"
            onPress={() => load()}
            style={styles.stretch}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={visibleProperties}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primaryInk}
          />
        }
        renderItem={({ item }) => (
          /*
            The shared card, which already carries its own FavouriteButton and
            its own accessibility label — so no second heart is added here, and
            no card labelling is duplicated from outside the component.
          */
          <PropertyCard
            property={item}
            onPress={() =>
              router.push({ pathname: '/properties/[id]', params: { id: item._id } })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={28} color={theme.primaryInk} />
            </View>
            <Text style={styles.stateHeading}>{t('favourites.emptyTitle')}</Text>
            <Text style={styles.stateBody}>{t('favourites.emptyDescription')}</Text>
            <Button
              label={t('favourites.browseProperties')}
              variant="primary"
              onPress={() => router.push('/properties')}
              style={styles.stretch}
            />
          </View>
        }
      />
    );
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
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('favourites.title')}</Text>
      </View>

      {renderBody()}
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },
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
    color: theme.text,
  },
  /** flexGrow lets the empty state fill the screen instead of hugging the top. */
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.primaryInk,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
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
    lineHeight: 22,
    color: theme.textMuted,
    textAlign: 'center',
  },
  stretch: { alignSelf: 'stretch', marginTop: Spacing.md },
  stretchTight: { alignSelf: 'stretch', marginTop: Spacing.sm },
});
