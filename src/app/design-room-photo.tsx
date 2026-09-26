import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import DesignMySpaceGate from '@/features/design-my-space/components/design-my-space-gate';
import { isServerDesignBoardId } from '@/features/design-my-space/design-board';
import { designMySpaceAccess, type DesignBoardOwner } from '@/features/design-my-space/design-board-sync';
import {
  createGenerationIdempotencyKey,
  designGenerationErrorKey,
  designGenerationStatusKey,
  hasVisualizationImage,
  isActiveGenerationStatus,
  type DesignGeneration,
} from '@/features/design-my-space/design-generation';
import {
  createDesignGeneration,
  designGenerationImageSource,
  fetchDesignGenerations,
} from '@/features/design-my-space/design-generation-api';
import { roomPhotoErrorKey, type RoomPhoto } from '@/features/design-my-space/room-photo';
import {
  deleteRoomPhoto,
  fetchRoomPhotos,
  roomPhotoImageSource,
  uploadRoomPhoto,
} from '@/features/design-my-space/room-photo-api';
import {
  chooseRoomPhoto,
  takeRoomPhoto,
  type PickedRoomPhoto,
} from '@/features/design-my-space/room-photo-picker';
import { useDesignGeneration } from '@/features/design-my-space/use-design-generation';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { getSiteSettings } from '@/features/settings/settings-api';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';

/**
 * VISUALIZE IN MY ROOM — step one: a private photo of the room.
 *
 *   choose  → Take Photo / Choose From Gallery (or reuse a photo uploaded before)
 *   preview → the picked photo, the room-photo notice, explicit consent
 *   upload  → sent to the backend, which validates, strips metadata and stores it privately
 *   ready   → the stored photo, loaded back from the API for its owner only
 *
 * ready   → the stored photo, loaded back from the API for its owner only, and
 *           — when the feature is switched on — the place a visualization can
 *           be REQUESTED
 *
 * A request is queued on the server; the backend's worker runs it. The screen
 * shows the real status (queued, processing, succeeded, failed) by asking the
 * API again on a widening interval — never a made-up progress bar — and stops
 * asking as soon as the generation finishes or the screen is left. When one
 * succeeds, the generated image is loaded from the API with the user's token
 * and shown beside the original photo. While the feature switch is off, which
 * is the default, no request action is offered at all.
 *
 * ── Board context ───────────────────────────────────────────────────────
 * The saved board that opened this screen arrives as `boardId` and is kept in
 * navigation only. It is NOT stored on the photo: a room photo stays reusable
 * with any board, and a future DesignGeneration will join the two.
 *
 * ── Privacy on the device ───────────────────────────────────────────────
 * Signed-in only, keyed by user id (like Design My Space itself), so a logout
 * or account switch unmounts every photo in memory. Stored photos are loaded
 * from the API with the Bearer token and `cachePolicy="none"`: expo-image keeps
 * no memory or disk copy that another account could later be shown.
 */
export default function DesignRoomPhotoScreen() {
  const { user, token, status } = useAuth();
  const userId = user?._id ?? null;
  const router = useRouter();
  const params = useLocalSearchParams<{ boardId?: string }>();

  const access = useMemo(() => designMySpaceAccess(status, userId, token), [status, userId, token]);
  // Only a saved board's id is meaningful context; anything else is ignored.
  const boardId = typeof params.boardId === 'string' && isServerDesignBoardId(params.boardId) ? params.boardId : null;

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/design-my-space');
  }, [router]);

  if (access.state === 'signed-in') {
    return <RoomPhotoFlow key={access.owner.userId} owner={access.owner} boardId={boardId} onLeave={leave} />;
  }

  return <DesignMySpaceGate restoring={access.state === 'restoring'} onBack={leave} />;
}

type Stage =
  | { name: 'choose' }
  | { name: 'preview'; photo: PickedRoomPhoto }
  | { name: 'uploading'; photo: PickedRoomPhoto }
  | { name: 'ready'; photo: RoomPhoto };

function RoomPhotoFlow({
  owner,
  boardId,
  onLeave,
}: {
  owner: DesignBoardOwner;
  boardId: string | null;
  onLeave: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { row, textAlign } = useDirection();
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>({ name: 'choose' });
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [previous, setPrevious] = useState<RoomPhoto[]>([]);

  const [visualizeState, setVisualizeState] = useState<'unknown' | 'enabled' | 'disabled'>('unknown');
  const [generation, setGeneration] = useState<DesignGeneration | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  /** Which image the user is looking at once a visualization exists. */
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [resultFailed, setResultFailed] = useState(false);

  /**
   * Polling runs only while this screen is focused: navigating away or
   * backgrounding the app stops it, and coming back resumes it.
   */
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  const watch = useDesignGeneration({ token: owner.token, generation, active: focused });
  const watched = watch.generation;

  const loadPrevious = useCallback(async () => {
    try {
      setPrevious(await fetchRoomPhotos(owner.token));
    } catch {
      // Not blocking: the user can still add a new photo.
      setPrevious([]);
    }
  }, [owner.token]);

  useEffect(() => {
    void loadPrevious();
  }, [loadPrevious]);

  /**
   * The feature switch and this photo's latest request.
   *
   * Both are read per mount of the account-keyed component, so nothing from a
   * previous account can survive a logout or an account switch.
   */
  const loadVisualization = useCallback(async (photoId: string) => {
    let enabled = false;
    try {
      const settings = await getSiteSettings();
      enabled = settings.designGenerationsEnabled === true;
      setVisualizeState(enabled ? 'enabled' : 'disabled');
    } catch {
      // The switch could not be read. That is not the same as "switched off",
      // so say nothing rather than claiming the feature is unavailable.
      setVisualizeState('unknown');
      return;
    }

    if (!enabled || !boardId) return;

    try {
      const { generations } = await fetchDesignGenerations(owner.token, { limit: 20 });
      // Newest first from the server: the first match is the latest request
      // for exactly this design and this photo.
      setGeneration(generations.find((item) => item.roomPhotoId === photoId && item.boardId === boardId) ?? null);
    } catch {
      // Only the lookup for an EARLIER request failed. The action stays
      // available: a new request is still possible, and the idempotency key
      // stops a repeat tap creating a duplicate.
    }
  }, [boardId, owner.token]);

  useEffect(() => {
    if (stage.name !== 'ready') return;
    void loadVisualization(stage.photo.id);
  }, [stage, loadVisualization]);

  const formatDate = (iso: string) => {
    const locale = language === 'en' ? 'en-GB' : language;
    try {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  };

  /* ── Picking ─────────────────────────────────────────────────────────── */

  const pick = async (source: 'camera' | 'library') => {
    if (picking) return;
    setError(null);
    setPicking(true);
    try {
      // Permission is requested inside these calls, at this tap, never earlier.
      const outcome = source === 'camera' ? await takeRoomPhoto() : await chooseRoomPhoto();
      if (outcome.type === 'permission-denied') {
        setError(t(source === 'camera' ? 'designMySpace.roomPhoto.errors.permissionCamera' : 'designMySpace.roomPhoto.errors.permissionLibrary'));
      } else if (outcome.type === 'picked') {
        // Every new photo needs its own, fresh consent.
        setConsented(false);
        setStage({ name: 'preview', photo: outcome.photo });
      }
    } catch {
      setError(t('designMySpace.roomPhoto.errors.prepareFailed'));
    } finally {
      setPicking(false);
    }
  };

  /* ── Upload ──────────────────────────────────────────────────────────── */

  const upload = async () => {
    // The only path to the network, and it requires consent.
    if (stage.name !== 'preview' || !consented) return;
    const { photo } = stage;

    setError(null);
    setStage({ name: 'uploading', photo });
    try {
      const stored = await uploadRoomPhoto(owner.token, photo);
      setImageFailed(false);
      setStage({ name: 'ready', photo: stored });
      void loadPrevious();
    } catch (err) {
      // Back to the preview, never to a success state: nothing was stored.
      setStage({ name: 'preview', photo });
      setError(t(roomPhotoErrorKey(err instanceof ApiError ? err : null)));
    }
  };

  const requestVisualization = async () => {
    if (stage.name !== 'ready' || !boardId || requesting) return;

    setGenerationError(null);
    setRequesting(true);
    try {
      const created = await createDesignGeneration(owner.token, {
        boardId,
        roomPhotoId: stage.photo.id,
        // One key per attempt: a retry or a double tap returns the same
        // request instead of queueing a second.
        idempotencyKey: createGenerationIdempotencyKey(),
      });
      setShowingOriginal(false);
      setResultFailed(false);
      setGeneration(created);
    } catch (err) {
      setGenerationError(t(designGenerationErrorKey(err instanceof ApiError ? err : null)));
    } finally {
      setRequesting(false);
    }
  };

  /* ── Remove ──────────────────────────────────────────────────────────── */

  const confirmRemove = (photo: RoomPhoto) => {
    Alert.alert(t('designMySpace.roomPhoto.removeTitle'), t('designMySpace.roomPhoto.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('designMySpace.roomPhoto.remove'),
        style: 'destructive',
        onPress: async () => {
          setError(null);
          setRemoving(true);
          try {
            await deleteRoomPhoto(owner.token, photo.id);
          } catch (err) {
            // Already gone (e.g. expired, or removed on another device) is the goal.
            if (!(err instanceof ApiError && err.status === 404)) {
              setRemoving(false);
              setError(t('designMySpace.roomPhoto.errors.deleteFailed'));
              return;
            }
          }
          setRemoving(false);
          setPrevious((list) => list.filter((item) => item.id !== photo.id));
          setStage({ name: 'choose' });
        },
      },
    ]);
  };

  const openPrevious = (photo: RoomPhoto) => {
    setError(null);
    setImageFailed(false);
    setStage({ name: 'ready', photo });
  };

  /* ── Views ───────────────────────────────────────────────────────────── */

  const errorMessage = error ? (
    <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
      {error}
    </Text>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('designMySpace.roomPhoto.title')} onBack={onLeave} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Spacing.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        {!boardId ? (
          <View style={styles.block}>
            <Text style={[styles.body, { textAlign }]}>{t('designMySpace.roomPhoto.missingBoard')}</Text>
            <Button label={t('designMySpace.roomPhoto.backToDesign')} onPress={onLeave} style={styles.stretch} />
          </View>
        ) : null}

        {boardId && stage.name === 'choose' ? (
          <View style={styles.block}>
            <SectionHeader eyebrow={t('designMySpace.roomPhoto.eyebrow')} title={t('designMySpace.roomPhoto.chooseHeading')} size="lg" rule />
            <Text style={[styles.body, { textAlign }]}>{t('designMySpace.roomPhoto.intro')}</Text>

            <Button
              label={t('designMySpace.roomPhoto.takePhoto')}
              onPress={() => pick('camera')}
              disabled={picking}
              style={styles.stretch}
            />
            <Button
              label={t('designMySpace.roomPhoto.chooseFromGallery')}
              variant="secondary"
              onPress={() => pick('library')}
              disabled={picking}
              style={styles.stretch}
            />
            {picking ? <ActivityIndicator color={theme.primaryInk} /> : null}
            {errorMessage}

            {previous.length > 0 ? (
              <View style={styles.previous}>
                <SectionHeader title={t('designMySpace.roomPhoto.previousHeading')} tone="muted" />
                {previous.map((photo) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => openPrevious(photo)}
                    accessibilityRole="button"
                    accessibilityLabel={t('designMySpace.roomPhoto.previousA11y', { date: formatDate(photo.createdAt) })}
                    style={({ pressed }) => [styles.previousRow, { flexDirection: row }, pressed && styles.pressed]}>
                    <Ionicons name="image-outline" size={20} color={theme.primaryInk} />
                    <Text style={[styles.previousLabel, { textAlign }]}>
                      {t('designMySpace.roomPhoto.previousItem', { date: formatDate(photo.createdAt) })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {boardId && (stage.name === 'preview' || stage.name === 'uploading') ? (
          <View style={styles.block}>
            <SectionHeader eyebrow={t('designMySpace.roomPhoto.eyebrow')} title={t('designMySpace.roomPhoto.previewHeading')} size="lg" rule />

            {/* The picked photo is still only on this phone; nothing has been uploaded. */}
            <Image
              source={{ uri: stage.photo.uri }}
              cachePolicy="none"
              contentFit="contain"
              style={[styles.photo, { aspectRatio: stage.photo.width / stage.photo.height || 4 / 3 }]}
              accessibilityLabel={t('designMySpace.roomPhoto.previewA11y')}
            />

            <View style={styles.notice}>
              <Text style={[styles.noticeHeading, { textAlign }]}>{t('designMySpace.roomPhoto.consentHeading')}</Text>
              <Text style={[styles.body, { textAlign }]}>{t('designMySpace.roomPhoto.consentBody')}</Text>

              <Pressable
                onPress={() => setConsented((value) => !value)}
                disabled={stage.name === 'uploading'}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consented, disabled: stage.name === 'uploading' }}
                accessibilityLabel={t('designMySpace.roomPhoto.consentAccept')}
                style={[styles.consentRow, { flexDirection: row }]}>
                <Ionicons
                  name={consented ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={consented ? theme.primaryInk : theme.textMuted}
                />
                <Text style={[styles.consentLabel, { textAlign }]}>{t('designMySpace.roomPhoto.consentAccept')}</Text>
              </Pressable>
            </View>

            {errorMessage}

            <Button
              label={t('designMySpace.roomPhoto.upload')}
              loading={stage.name === 'uploading'}
              loadingLabel={t('designMySpace.roomPhoto.uploading')}
              disabled={!consented || stage.name === 'uploading'}
              onPress={upload}
              style={styles.stretch}
            />
            {stage.name === 'preview' ? (
              <Button
                label={t('designMySpace.roomPhoto.chooseAnother')}
                variant="secondary"
                onPress={() => {
                  setError(null);
                  setConsented(false);
                  setStage({ name: 'choose' });
                }}
                style={styles.stretch}
              />
            ) : null}
          </View>
        ) : null}

        {boardId && stage.name === 'ready' ? (
          <View style={styles.block}>
            <SectionHeader eyebrow={t('designMySpace.roomPhoto.eyebrow')} title={t('designMySpace.roomPhoto.readyHeading')} size="lg" rule />

            {imageFailed ? (
              <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
                {t('designMySpace.roomPhoto.errors.loadFailed')}
              </Text>
            ) : (
              <Image
                // From the API with the Bearer token — never a storage URL — and
                // never cached, so no other account can be shown this photo later.
                source={roomPhotoImageSource(owner.token, stage.photo.id)}
                cachePolicy="none"
                contentFit="contain"
                transition={150}
                onError={() => setImageFailed(true)}
                style={[styles.photo, { aspectRatio: stage.photo.width / stage.photo.height }]}
                accessibilityLabel={t('designMySpace.roomPhoto.readyA11y')}
              />
            )}

            <Text style={[styles.body, { textAlign }]}>{t('designMySpace.roomPhoto.readyBody')}</Text>
            {errorMessage}

            {boardId && visualizeState === 'enabled' ? (
              <View style={styles.notice}>
                <Text style={[styles.noticeHeading, { textAlign }]}>{t('designMySpace.visualize.heading')}</Text>

                {watched ? (
                  <>
                    {/*
                      The backend's own status, never a guess. There is no
                      progress percentage because the provider reports none.
                    */}
                    <Text
                      accessibilityRole={watched.status === 'failed' ? 'alert' : undefined}
                      style={[watched.status === 'failed' ? styles.error : styles.body, { textAlign }]}>
                      {t(designGenerationStatusKey(watched))}
                    </Text>

                    {isActiveGenerationStatus(watched.status) ? (
                      <>
                        <ActivityIndicator color={theme.primaryInk} />
                        <Text style={[styles.muted, { textAlign }]}>{t('designMySpace.visualize.pendingNote')}</Text>
                      </>
                    ) : null}

                    {/* Polling gave up; the job may still finish on the server. */}
                    {watch.timedOut && isActiveGenerationStatus(watched.status) ? (
                      <Button
                        label={t('designMySpace.visualize.checkAgain')}
                        variant="secondary"
                        loading={watch.checking}
                        disabled={watch.checking}
                        onPress={watch.refresh}
                        style={styles.stretch}
                      />
                    ) : null}

                    {hasVisualizationImage(watched) ? (
                      <>
                        {resultFailed ? (
                          <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
                            {t('designMySpace.visualize.errors.resultUnavailable')}
                          </Text>
                        ) : (
                          <Image
                            // The generated image, from the API with the
                            // Bearer token — never a storage URL — and never
                            // cached, exactly like the room photo.
                            source={
                              showingOriginal
                                ? roomPhotoImageSource(owner.token, stage.photo.id)
                                : designGenerationImageSource(owner.token, watched.id)
                            }
                            cachePolicy="none"
                            contentFit="contain"
                            transition={150}
                            onError={() => setResultFailed(true)}
                            style={[styles.photo, { aspectRatio: stage.photo.width / stage.photo.height }]}
                            accessibilityLabel={t(showingOriginal
                              ? 'designMySpace.visualize.beforeA11y'
                              : 'designMySpace.visualize.afterA11y')}
                          />
                        )}

                        {/* The simplest honest before/after: one photo at a time. */}
                        <Button
                          label={t(showingOriginal
                            ? 'designMySpace.visualize.showAfter'
                            : 'designMySpace.visualize.showBefore')}
                          variant="secondary"
                          onPress={() => setShowingOriginal((value) => !value)}
                          accessibilityHint={t('designMySpace.visualize.compareA11y')}
                          style={styles.stretch}
                        />
                        <Text style={[styles.muted, { textAlign }]}>{t('designMySpace.visualize.conceptNote')}</Text>
                      </>
                    ) : null}

                    {watch.gone ? (
                      <Text style={[styles.muted, { textAlign }]}>{t('designMySpace.visualize.errors.generic')}</Text>
                    ) : null}

                    {watched.status === 'failed' ? (
                      <Button
                        label={t('designMySpace.visualize.tryAgain')}
                        variant="secondary"
                        loading={requesting}
                        disabled={requesting}
                        onPress={requestVisualization}
                        style={styles.stretch}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <Text style={[styles.body, { textAlign }]}>{t('designMySpace.visualize.body')}</Text>
                    <Button
                      label={t('designMySpace.visualize.request')}
                      variant="secondary"
                      loading={requesting}
                      loadingLabel={t('designMySpace.visualize.requesting')}
                      disabled={requesting}
                      onPress={requestVisualization}
                      accessibilityHint={t('designMySpace.visualize.requestA11y')}
                      style={styles.stretch}
                    />
                  </>
                )}

                {generationError ? (
                  <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>{generationError}</Text>
                ) : null}
              </View>
            ) : null}

            {/*
              Switched off for this site: say so, instead of leaving the screen
              looking as though an action is missing.
            */}
            {boardId && visualizeState === 'disabled' ? (
              <Text style={[styles.muted, { textAlign }]}>{t('designMySpace.visualize.errors.unavailable')}</Text>
            ) : null}

            <Button label={t('designMySpace.roomPhoto.backToDesign')} onPress={onLeave} style={styles.stretch} />
            <Button
              label={t('designMySpace.roomPhoto.remove')}
              variant="secondary"
              loading={removing}
              disabled={removing}
              onPress={() => confirmRemove(stage.photo)}
              style={styles.stretch}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  scroll: {},
  block: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.text,
  },
  error: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.danger,
  },
  stretch: { alignSelf: 'stretch' },
  photo: {
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: theme.marble,
  },
  notice: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  noticeHeading: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
  consentRow: {
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
  },
  consentLabel: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: theme.text,
  },
  muted: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.textMuted,
  },
  previous: { gap: Spacing.xs, marginTop: Spacing.md },
  previousRow: {
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
  },
  previousLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
  pressed: { opacity: 0.7 },
});
