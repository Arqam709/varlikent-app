import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { isServerDesignBoardId } from '@/features/design-my-space/design-board';
import { designMySpaceAccess, loadDesignBoards } from '@/features/design-my-space/design-board-sync';
import { designGenerationImageSource, fetchAllDesignGenerations } from '@/features/design-my-space/design-generation-api';
import { groupDesignHistory, type DesignHistoryEntry } from '@/features/design-my-space/design-history';
import type { DesignGeneration } from '@/features/design-my-space/design-generation';
import { DESIGN_ROOMS, DESIGN_STYLES, designOptionLabelKey } from '@/features/design-my-space/design-options';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { formatShortDate } from '@/utils/format-short-date';

/**
 * MY DESIGNS (Account → My Designs) — each saved board WITH its
 * visualizations, as one design history.
 *
 * Boards and visualizations stay separate records on the server; here they are
 * joined on the device from the two existing list endpoints (see
 * design-history.ts) — never one request per board. Each card shows the
 * board's NEWEST finished visualization; "View all" opens that board's full set.
 * Only that one image per card is loaded, and only as the card scrolls into view.
 *
 * Nothing is generated from here, so the visualization feature flag is not
 * bypassed: this is history the customer already owns.
 *
 * "Request this design" is the deliberate step to Varlikent — the only thing on
 * this screen that can lead to a request, and only through the request stage.
 */

export default function MyDesignsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { user, token, status } = useAuth();

  const access = useMemo(() => designMySpaceAccess(status, user?._id ?? null, token), [status, user?._id, token]);
  const [entries, setEntries] = useState<DesignHistoryEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready'>('loading');
  const [offline, setOffline] = useState(false);
  const [gallery, setGallery] = useState<DesignHistoryEntry | null>(null);
  const loadRef = useRef(0);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  useFocusEffect(
    useCallback(() => {
      if (access.state !== 'signed-in') return undefined;
      const load = ++loadRef.current;
      const current = () => loadRef.current === load;
      void (async () => {
        // Both lists at once; a visualization failure never hides the boards.
        const [boards, generations] = await Promise.all([
          loadDesignBoards(access.owner, (cached) => {
            if (current() && cached.length > 0) {
              setEntries(groupDesignHistory(cached, []));
              setState('ready');
            }
          }),
          fetchAllDesignGenerations(access.owner.token).catch(() => [] as DesignGeneration[]),
        ]);
        if (!current()) return;
        setEntries(groupDesignHistory(boards.boards, generations));
        setOffline(boards.failed);
        setState('ready');
      })();
      return () => {
        loadRef.current++;
      };
    }, [access])
  );

  const requestDesign = (boardId: string, generationId?: string) =>
    router.push({
      pathname: '/service-request',
      params: generationId ? { type: 'interior_design', boardId, generationId } : { type: 'interior_design', boardId },
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('designs.title')} onBack={leave} />

      {access.state !== 'signed-in' || state === 'loading' ? (
        <View style={styles.centered}>
          {access.state === 'signed-out' ? (
            <>
              <Text style={styles.emptyTitle}>{t('designs.gateTitle')}</Text>
              <Button label={t('common.signIn')} onPress={() => router.push('/login')} style={styles.stretch} />
            </>
          ) : (
            <ActivityIndicator color={theme.primaryInk} />
          )}
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.board.id}
          contentContainerStyle={styles.list}
          initialNumToRender={4}
          windowSize={5}
          ListHeaderComponent={offline ? <Text style={styles.notice}>{t('designs.offlineNotice')}</Text> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="color-palette-outline" size={32} color={theme.primaryInk} />
              <Text style={styles.emptyTitle}>{t('designs.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('designs.emptyBody')}</Text>
              <Button label={t('services.primaryActions.designMySpace.label')} onPress={() => router.push('/design-my-space')} style={styles.stretch} />
            </View>
          }
          renderItem={({ item }) => (
            <DesignCard
              entry={item}
              token={access.state === 'signed-in' ? access.owner.token : ''}
              onOpen={() => router.push({ pathname: '/design-my-space', params: { boardId: item.board.id } })}
              onViewAll={() => setGallery(item)}
              // Only a board saved to the account can be requested.
              onRequest={
                isServerDesignBoardId(item.board.id)
                  ? () => requestDesign(item.board.id, item.visualizations[0]?.id)
                  : undefined
              }
            />
          )}
        />
      )}

      <VisualizationGallery
        entry={gallery}
        token={access.state === 'signed-in' ? access.owner.token : ''}
        onClose={() => setGallery(null)}
        onRequest={(generation) => {
          setGallery(null);
          requestDesign(generation.boardId, generation.id);
        }}
      />
    </SafeAreaView>
  );
}

function DesignCard({
  entry,
  token,
  onOpen,
  onViewAll,
  onRequest,
}: {
  entry: DesignHistoryEntry;
  token: string;
  onOpen: () => void;
  onViewAll: () => void;
  onRequest?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { row, textAlign } = useDirection();
  const [imageFailed, setImageFailed] = useState(false);

  const { board, visualizations, pending } = entry;
  const latest = visualizations[0];
  const room = t(designOptionLabelKey(DESIGN_ROOMS, board.room)) || board.room;
  const style = t(designOptionLabelKey(DESIGN_STYLES, board.style)) || board.style;
  const updated = formatShortDate(board.updatedAt, language);
  const swatches = [board.wall.color, board.floor.color, ...board.materials.slice(0, 3).map((m) => m.color)];

  return (
    <View style={styles.card}>
      {latest && !imageFailed ? (
        <Pressable onPress={onViewAll} accessibilityRole="imagebutton" accessibilityLabel={t('designs.viewVisualizationsA11y', { room })}>
          <Image
            source={designGenerationImageSource(token, latest.id)}
            cachePolicy="none"
            contentFit="cover"
            transition={150}
            recyclingKey={latest.id}
            onError={() => setImageFailed(true)}
            style={styles.image}
          />
        </Pressable>
      ) : null}

      <View style={styles.cardBody}>
        <View style={[styles.swatches, { flexDirection: row }]}>
          {swatches.map((color, index) => (
            <View key={`${color}-${index}`} style={[styles.swatch, { backgroundColor: color }]} />
          ))}
        </View>
        <Text style={[styles.cardTitle, { textAlign }]}>{`${room} — ${style}`}</Text>
        <Text style={[styles.cardMeta, { textAlign }]}>
          {`${t('designMySpace.fields.wall')}: ${board.wall.label} · ${t('designMySpace.fields.floor')}: ${board.floor.label}`}
        </Text>
        {updated ? <Text style={[styles.cardMeta, { textAlign }]}>{t('designs.updatedOn', { date: updated })}</Text> : null}

        {visualizations.length === 0 ? (
          <Text style={[styles.cardMeta, { textAlign }]}>
            {t(pending ? 'designs.visualizationPending' : 'designs.noVisualization')}
          </Text>
        ) : visualizations.length > 1 || imageFailed ? (
          <Pressable onPress={onViewAll} accessibilityRole="button" hitSlop={6} style={[styles.viewAll, { flexDirection: row }]}>
            <Ionicons name="images-outline" size={16} color={theme.primaryInk} />
            <Text style={styles.viewAllText}>{t('designs.viewAll', { count: String(visualizations.length) })}</Text>
          </Pressable>
        ) : null}

        <View style={[styles.actions, { flexDirection: row }]}>
          <Button label={t('designs.openDesign')} variant="secondary" onPress={onOpen} style={styles.action} />
          {onRequest ? <Button label={t('designMySpace.visualize.requestThisDesign')} onPress={onRequest} style={styles.action} /> : null}
        </View>
      </View>
    </View>
  );
}

/** Every finished visualization of ONE design, newest first, each requestable. */
function VisualizationGallery({
  entry,
  token,
  onClose,
  onRequest,
}: {
  entry: DesignHistoryEntry | null;
  token: string;
  onClose: () => void;
  onRequest: (generation: DesignGeneration) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { textAlign } = useDirection();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={entry !== null} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.gallery, { paddingTop: insets.top }]}>
        <ScreenHeader title={t('designs.visualizationsTitle')} onBack={onClose} />
        <ScrollView contentContainerStyle={[styles.galleryList, { paddingBottom: Spacing.xl + insets.bottom }]}>
          {entry?.visualizations.map((generation, index) => (
            <View key={generation.id} style={styles.galleryItem}>
              <Image
                source={designGenerationImageSource(token, generation.id)}
                cachePolicy="none"
                contentFit="contain"
                transition={150}
                style={styles.galleryImage}
                accessibilityLabel={t('designMySpace.visualize.afterA11y')}
              />
              <Text style={[styles.cardMeta, { textAlign }]}>
                {[index === 0 ? t('designs.latest') : '', formatShortDate(generation.createdAt, language)].filter(Boolean).join(' · ')}
              </Text>
              <Button label={t('designMySpace.visualize.requestThisDesign')} onPress={() => onRequest(generation)} />
            </View>
          ))}
          {entry && entry.visualizations.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="image-outline" size={28} color={theme.textMuted} />
              <Text style={styles.emptyBody}>{t('designs.noVisualization')}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.softWhite },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
    stretch: { alignSelf: 'stretch', marginTop: Spacing.md },
    notice: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      color: theme.textMuted,
      backgroundColor: theme.marble,
      padding: Spacing.md,
      borderRadius: Radius.md,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
    emptyTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.lg, color: theme.text, textAlign: 'center' },
    emptyBody: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, lineHeight: 22, color: theme.textMuted, textAlign: 'center' },
    card: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      overflow: 'hidden',
    },
    image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: theme.marble },
    cardBody: { padding: Spacing.md, gap: Spacing.xs },
    swatches: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xs },
    swatch: { width: 26, height: 26, borderRadius: Radius.full, borderWidth: 1, borderColor: theme.border },
    cardTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.md, color: theme.text },
    cardMeta: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, lineHeight: 18, color: theme.textMuted },
    viewAll: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
    viewAllText: { fontFamily: FontFamily.bodySemiBold, fontSize: FontSizes.sm, color: theme.primaryInk },
    actions: { gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
    action: { flexGrow: 1 },
    gallery: { flex: 1, backgroundColor: theme.softWhite },
    galleryList: { padding: Spacing.lg, gap: Spacing.lg },
    galleryItem: { gap: Spacing.sm },
    galleryImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, backgroundColor: theme.marble },
  });
