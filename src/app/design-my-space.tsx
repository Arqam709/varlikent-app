import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import DesignBoardSummary from '@/features/design-my-space/components/design-board-summary';
import DesignChoiceCard from '@/features/design-my-space/components/design-choice-card';
import DesignMySpaceGate from '@/features/design-my-space/components/design-my-space-gate';
import DesignMaterialChoice from '@/features/design-my-space/components/design-material-choice';
import DesignSavedBoardCard from '@/features/design-my-space/components/design-saved-board-card';
import DesignStepProgress from '@/features/design-my-space/components/design-step-progress';
import DesignSwatchChoice from '@/features/design-my-space/components/design-swatch-choice';
import {
  boardFromDraft,
  createDesignBoardId,
  draftFromBoard,
  EMPTY_DESIGN_DRAFT,
  finishOptionsWithSelection,
  finishSnapshot,
  isSameFinish,
  isSameMaterial,
  isServerDesignBoardId,
  isStepComplete,
  materialOptionsWithSelection,
  materialSnapshot,
  toggleMaterial,
  type DesignBoard,
  type DesignDraft,
} from '@/features/design-my-space/design-board';
import { designConsultationRoute } from '@/features/design-my-space/design-board-serializer';
import {
  deleteDesignBoardFor,
  designBoardSaveErrorKey,
  designMySpaceAccess,
  loadDesignBoards,
  saveDesignBoardFor,
  withSavedDesignBoard,
  type DesignBoardOwner,
} from '@/features/design-my-space/design-board-sync';
import {
  DESIGN_MY_SPACE_EXIT_HREF,
  draftSignature,
  hasUnsavedChanges,
  resolveBackAction,
} from '@/features/design-my-space/design-my-space-navigation';
import {
  DESIGN_LIGHTING,
  DESIGN_ROOMS,
  DESIGN_STEPS,
  DESIGN_STYLES,
  designOptionLabelKey,
  type DesignStep,
} from '@/features/design-my-space/design-options';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useStudioPalette } from '@/features/studio-palette/use-studio-palette';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * DESIGN MY SPACE — a guided design brief, saved to the user's account.
 *
 * Six steps, a board, and a handoff to the enquiry form the app already has.
 * It is not a renderer and does not pretend to be one: the user is describing
 * a room they want, not previewing one. No AI and no 3D.
 *
 * From a board saved to the account, "Visualize in My Room" opens
 * /design-room-photo, where the user adds a private photo of the room for a
 * FUTURE visualization. Nothing here generates or claims a redesigned image.
 *
 * ── Signed-in only ──────────────────────────────────────────────────────
 * Every board belongs to an account: MongoDB holds it, and this device keeps
 * a per-user cache (design-board-sync). The route therefore decides ACCESS
 * before anything else:
 *
 *   restoring   the stored session is still being checked → a spinner; the
 *               visitor is neither gated nor shown anything yet
 *   signed out  the same full-screen sign-in gate as Favourites; no board
 *               can be listed, opened, created, edited, saved or deleted
 *   signed in   the boards of that account, in a component KEYED by the user
 *               id — so logging out unmounts it, and a different account
 *               gets a fresh one with none of the previous user's list,
 *               draft or open board in memory
 *
 * ── Why one route and not six ───────────────────────────────────────────
 * The steps share one draft and one palette, and Back between them must not
 * unwind a navigation stack the user never chose to build. So `/design-my-space`
 * is a single stack screen with three views — landing, flow, board.
 *
 * ── Back ────────────────────────────────────────────────────────────────
 * Header arrow, Android hardware Back, the step Back button and "Back to
 * Interior Design" all call ONE handler, whose rule lives in
 * design-my-space-navigation.ts: within the flow Back steps backwards; on the
 * finished board Back leaves for Interior Design (Edit Design is how you
 * return to the steps), asking first only when the board is unsaved.
 *
 * ── Where the values come from ──────────────────────────────────────────
 *   rooms, styles, lighting   app-owned vocabularies, translated (design-options)
 *   walls, floors, materials  admin-managed Studio Palette, English names
 *   the saved board           the signed-in account, cached per user
 *                             (design-board-sync)
 */

type Screen = 'landing' | 'flow' | 'board';

export default function DesignMySpaceScreen() {
  const { user, token, status } = useAuth();
  const userId = user?._id ?? null;
  const leaveDesignMySpace = useLeaveDesignMySpace();

  // Memoized so the owner object — and every effect keyed on it — only
  // changes when the account or its token actually does.
  const access = useMemo(() => designMySpaceAccess(status, userId, token), [status, userId, token]);

  if (access.state === 'signed-in') {
    return <DesignMySpaceBoards key={access.owner.userId} owner={access.owner} />;
  }

  return <DesignMySpaceGate restoring={access.state === 'restoring'} onBack={leaveDesignMySpace} />;
}

/**
 * Leaves the feature for the Interior Design page — the one exit, shared by
 * the sign-in gate and the boards. `dismissTo` pops back to it when it is
 * underneath (the normal case), and replaces this screen with it when Design
 * My Space was opened without that history.
 */
function useLeaveDesignMySpace() {
  const router = useRouter();
  return useCallback(() => {
    router.dismissTo(DESIGN_MY_SPACE_EXIT_HREF);
  }, [router]);
}

/* ─────────────────────────── Signed in ─────────────────────────── */

function DesignMySpaceBoards({ owner }: { owner: DesignBoardOwner }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { row, textAlign, backIcon } = useDirection();
  const router = useRouter();
  /** Content ends above the Android navigation bar, which the app draws edge to edge. */
  const insets = useSafeAreaInsets();

  /** The admin-managed palette, with bundled defaults showing until it lands. */
  const { palette } = useStudioPalette('interior-design');

  const [screen, setScreen] = useState<Screen>('landing');
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<DesignDraft>(EMPTY_DESIGN_DRAFT);

  /** Identity of the board being built or edited, fixed when the flow starts. */
  const [boardId, setBoardId] = useState(createDesignBoardId);
  /** Set when editing a saved board, so its original creation time survives. */
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [boards, setBoards] = useState<DesignBoard[]>([]);
  /**
   * The draft's signature as it was when last saved or opened.
   * Comparing against it drives both "Save Design" / "Saved" and whether
   * leaving the board needs a confirmation.
   */
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  /** The translation key for why the last save failed, or null. */
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** The account could not be reached: the list is this user's cached copy. */
  const [showingCachedBoards, setShowingCachedBoards] = useState(false);

  /** Only the newest list load may publish, so a slow one cannot overwrite a newer one. */
  const loadRef = useRef(0);

  const step: DesignStep = DESIGN_STEPS[stepIndex];
  const unsaved = hasUnsavedChanges(savedDraft, draft);
  const isSaved = !unsaved;

  const refreshBoards = useCallback(async () => {
    const load = ++loadRef.current;
    const current = () => loadRef.current === load;

    const result = await loadDesignBoards(owner, (cached) => {
      if (current()) setBoards(cached);
    });
    if (!current()) return;

    setBoards(result.boards);
    setShowingCachedBoards(result.failed);
  }, [owner]);

  useEffect(() => {
    void refreshBoards();
  }, [refreshBoards]);

  /* ── Movement ───────────────────────────────────────────────────────── */

  const leaveDesignMySpace = useLeaveDesignMySpace();

  /**
   * THE Back handler. Every back control calls this and nothing else, so the
   * header, the hardware button and the visible links cannot disagree.
   * Always returns true: this screen has handled the press.
   */
  const handleBack = useCallback((): boolean => {
    setSaveErrorKey(null);
    const action = resolveBackAction(screen, stepIndex, unsaved);

    switch (action.type) {
      case 'previous-step':
        setStepIndex(action.stepIndex);
        break;
      case 'landing':
        setScreen('landing');
        break;
      case 'confirm-exit':
        Alert.alert(t('designMySpace.leaveTitle'), t('designMySpace.leaveBody'), [
          { text: t('designMySpace.stay'), style: 'cancel' },
          { text: t('designMySpace.leave'), style: 'destructive', onPress: leaveDesignMySpace },
        ]);
        break;
      case 'exit':
        leaveDesignMySpace();
        break;
    }
    return true;
  }, [screen, stepIndex, unsaved, t, leaveDesignMySpace]);

  /*
   * Android hardware Back, registered only while this screen is FOCUSED.
   * Contact is pushed on top of the board; a listener that stayed registered
   * underneath it would swallow Contact's own Back press.
   */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => subscription.remove();
    }, [handleBack])
  );

  const startNewDesign = () => {
    setDraft(EMPTY_DESIGN_DRAFT);
    setBoardId(createDesignBoardId());
    setCreatedAt(null);
    setSavedDraft(null);
    setSaveErrorKey(null);
    setStepIndex(0);
    setScreen('flow');
  };

  const openBoard = (board: DesignBoard) => {
    const next = draftFromBoard(board);
    setDraft(next);
    setBoardId(board.id);
    setCreatedAt(board.createdAt);
    setSavedDraft(draftSignature(next));
    setSaveErrorKey(null);
    setScreen('board');
  };

  const confirmDelete = (board: DesignBoard) => {
    const room = t(designOptionLabelKey(DESIGN_ROOMS, board.room));

    Alert.alert(t('designMySpace.deleteTitle'), t('designMySpace.deleteBody', { name: room }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('designMySpace.delete'),
        style: 'destructive',
        onPress: async () => {
          const deleted = await deleteDesignBoardFor(owner, board.id);

          // Never removed from the list unless it is really gone.
          if (!deleted) {
            Alert.alert(t('designMySpace.deleteTitle'), t('designMySpace.deleteFailed'));
            return;
          }

          setBoards((current) => current.filter((item) => item.id !== board.id));
          // Editing the board that was just deleted would save it again.
          if (board.id === boardId) startNewDesignSilently();
        },
      },
    ]);
  };

  /** Resets to the landing view without starting a flow. */
  const startNewDesignSilently = () => {
    setDraft(EMPTY_DESIGN_DRAFT);
    setBoardId(createDesignBoardId());
    setCreatedAt(null);
    setSavedDraft(null);
    setScreen('landing');
  };

  /* ── The board under construction ───────────────────────────────────── */

  /**
   * The draft as a board, or null while a required choice is missing — which
   * is what makes it impossible to reach the summary, save, or request a
   * consultation from an incomplete flow.
   *
   * Timestamps are read when this recomputes rather than on every render, and
   * `updatedAt` is replaced at the moment of saving.
   */
  const board = useMemo(
    () =>
      boardFromDraft(draft, {
        id: boardId,
        now: new Date().toISOString(),
        createdAt: createdAt ?? undefined,
      }),
    [draft, boardId, createdAt]
  );

  const handleSave = async () => {
    if (!board || saving) return;

    // Taken now: what was saved is the draft as it was when Save was pressed.
    const signature = draftSignature(draft);

    setSaving(true);
    // The reason travels with the failure, so the message can be accurate: an
    // expired session, or a server without this endpoint, is not "check your
    // connection".
    let failure: unknown = null;
    const saved = await saveDesignBoardFor(
      owner,
      { ...board, updatedAt: new Date().toISOString() },
      { onError: (error) => { failure = error; } }
    );
    setSaving(false);

    if (!saved) {
      setSaveErrorKey(designBoardSaveErrorKey(failure));
      return;
    }

    setSaveErrorKey(null);
    // A first save to an account swaps the device id for the server's, so the
    // next save updates this board instead of creating another.
    setBoardId(saved.id);
    setCreatedAt(saved.createdAt);
    setSavedDraft(signature);
    setBoards((current) => withSavedDesignBoard(current, saved, board.id));
  };

  /**
   * Room photos are for a board that exists in the account: a future
   * visualization will reference the saved board, so an unsaved or edited
   * board must be saved first. The board id travels as a route parameter; it
   * is NOT stored on the room photo, which stays reusable across boards.
   */
  const canVisualize = isSaved && isServerDesignBoardId(boardId);

  const handleVisualize = () => {
    if (!canVisualize) return;
    router.push({ pathname: '/design-room-photo', params: { boardId } });
  };

  const handleConsultation = () => {
    if (!board) return;
    // push, so Back from Contact returns to the board.
    router.push(designConsultationRoute(board, (key, values) => t(key, values)));
  };

  /* ── Views ──────────────────────────────────────────────────────────── */

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('designMySpace.title')} onBack={handleBack} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Spacing.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        {screen === 'landing' ? (
          <View style={styles.block}>
            <SectionHeader
              eyebrow={t('designMySpace.entryEyebrow')}
              title={t('designMySpace.landingHeading')}
              size="lg"
              rule
            />
            <Text style={[styles.body, { textAlign }]}>
              {t('designMySpace.landingBody')}
            </Text>

            <Button
              label={t('designMySpace.startNew')}
              onPress={startNewDesign}
              accessibilityHint={t('designMySpace.startNewA11y')}
              style={styles.stretch}
            />

            <View style={styles.saved}>
              <SectionHeader
                eyebrow={t('designMySpace.savedEyebrow')}
                title={t('designMySpace.savedHeading')}
                tone="muted"
                style={styles.savedHeader}
              />

              {showingCachedBoards ? (
                <Text accessibilityRole="alert" style={[styles.muted, { textAlign }]}>
                  {t('designMySpace.savedOffline')}
                </Text>
              ) : null}

              {boards.length === 0 ? (
                <Text style={[styles.muted, { textAlign }]}>
                  {t('designMySpace.savedEmpty')}
                </Text>
              ) : (
                <View style={styles.savedList}>
                  {boards.map((item) => (
                    <DesignSavedBoardCard
                      key={item.id}
                      board={item}
                      onOpen={() => openBoard(item)}
                      onDelete={() => confirmDelete(item)}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : null}

        {screen === 'flow' ? (
          <View style={styles.block}>
            <DesignStepProgress current={stepIndex + 1} total={DESIGN_STEPS.length} />

            <View style={styles.stepIntro}>
              <Text style={[styles.stepTitle, { textAlign }]} accessibilityRole="header">
                {t(`designMySpace.steps.${step}`)}
              </Text>
              <Text style={[styles.muted, { textAlign }]}>{t(`designMySpace.stepHints.${step}`)}</Text>
            </View>

            <View
              accessibilityRole={step === 'materials' ? undefined : 'radiogroup'}
              accessibilityLabel={t(`designMySpace.steps.${step}`)}
              style={styles.options}>
              <StepOptions
                step={step}
                draft={draft}
                palette={palette}
                onChange={(next) => {
                  setDraft(next);
                  setSaveErrorKey(null);
                }}
              />
            </View>

            {/* Side by side in reading order: Back at the leading edge, Next at the trailing. */}
            <View style={[styles.flowActions, { flexDirection: row }]}>
              <Button
                label={t('designMySpace.back')}
                variant="secondary"
                onPress={handleBack}
                style={styles.flowAction}
              />
              <Button
                label={
                  stepIndex === DESIGN_STEPS.length - 1
                    ? t('designMySpace.review')
                    : t('designMySpace.next')
                }
                // A required step cannot be skipped; materials are always complete.
                disabled={!isStepComplete(draft, step)}
                onPress={() => {
                  if (stepIndex === DESIGN_STEPS.length - 1) setScreen('board');
                  else setStepIndex((index) => index + 1);
                }}
                style={styles.flowAction}
              />
            </View>
          </View>
        ) : null}

        {screen === 'board' && board ? (
          <View style={styles.block}>
            <SectionHeader
              eyebrow={t('designMySpace.entryEyebrow')}
              title={t('designMySpace.summaryHeading')}
              size="lg"
              rule
            />

            <DesignBoardSummary board={board} />

            {saveErrorKey ? (
              <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
                {t(saveErrorKey)}
              </Text>
            ) : null}

            <View style={styles.boardActions}>
              <Button
                label={t('designMySpace.requestConsultation')}
                onPress={handleConsultation}
                accessibilityHint={t('designMySpace.requestConsultationA11y')}
                style={styles.stretch}
              />
              <Button
                label={isSaved ? t('designMySpace.savedLabel') : t('designMySpace.save')}
                variant="secondary"
                disabled={isSaved || saving}
                onPress={handleSave}
                style={styles.stretch}
              />
              <Button
                label={t('designMySpace.roomPhoto.visualizeCta')}
                variant="secondary"
                disabled={!canVisualize}
                onPress={handleVisualize}
                accessibilityHint={t('designMySpace.roomPhoto.visualizeA11y')}
                style={styles.stretch}
              />
              {!canVisualize ? (
                <Text style={[styles.muted, { textAlign }]}>{t('designMySpace.roomPhoto.saveFirst')}</Text>
              ) : null}

              {/*
                The two lightweight actions share one row: changing the board, and
                leaving it. Neither competes with the two buttons above.
              */}
              <View style={[styles.boardLinks, { flexDirection: row }]}>
                <Pressable
                  onPress={() => {
                    setStepIndex(0);
                    setScreen('flow');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('designMySpace.edit')}
                  style={({ pressed }) => [styles.link, { flexDirection: row }, pressed && styles.linkPressed]}>
                  <Ionicons name="create-outline" size={18} color={theme.primaryInk} />
                  <Text style={styles.linkLabel}>{t('designMySpace.edit')}</Text>
                </Pressable>

                <Pressable
                  onPress={handleBack}
                  accessibilityRole="button"
                  accessibilityLabel={t('designMySpace.backToService')}
                  style={({ pressed }) => [styles.link, { flexDirection: row }, pressed && styles.linkPressed]}>
                  <Ionicons name={backIcon} size={18} color={theme.textMuted} />
                  <Text style={[styles.linkLabel, styles.linkLabelMuted]}>{t('designMySpace.backToService')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────── One step's options ─────────────────────────── */

function StepOptions({
  step,
  draft,
  palette,
  onChange,
}: {
  step: DesignStep;
  draft: DesignDraft;
  palette: ReturnType<typeof useStudioPalette>['palette'];
  onChange: (draft: DesignDraft) => void;
}) {
  const { t } = useLanguage();

  switch (step) {
    case 'room':
      return (
        <>
          {DESIGN_ROOMS.map((option) => (
            <DesignChoiceCard
              key={option.id}
              label={t(option.labelKey)}
              description={t(option.descriptionKey)}
              icon={option.icon}
              selected={draft.room === option.id}
              onPress={() => onChange({ ...draft, room: option.id })}
            />
          ))}
        </>
      );

    case 'style':
      return (
        <>
          {DESIGN_STYLES.map((option) => (
            <DesignChoiceCard
              key={option.id}
              label={t(option.labelKey)}
              description={t(option.descriptionKey)}
              icon={option.icon}
              selected={draft.style === option.id}
              onPress={() => onChange({ ...draft, style: option.id })}
            />
          ))}
        </>
      );

    case 'wall':
      return (
        <>
          {/* A finish chosen before an owner changed the palette stays on offer. */}
          {finishOptionsWithSelection(palette.wallFinishes, draft.wall).map((finish) => (
            <DesignSwatchChoice
              key={`${finish.label}-${finish.color}`}
              label={finish.label}
              color={finish.color}
              selected={isSameFinish(draft.wall, finish)}
              onPress={() => onChange({ ...draft, wall: finishSnapshot(finish) })}
            />
          ))}
        </>
      );

    case 'floor':
      return (
        <>
          {finishOptionsWithSelection(palette.floorFinishes, draft.floor).map((finish) => (
            <DesignSwatchChoice
              key={`${finish.label}-${finish.color}`}
              label={finish.label}
              color={finish.color}
              selected={isSameFinish(draft.floor, finish)}
              onPress={() => onChange({ ...draft, floor: finishSnapshot(finish) })}
            />
          ))}
        </>
      );

    case 'materials':
      return (
        <>
          {materialOptionsWithSelection(palette.materials, draft.materials).map((material) => {
            const snapshot = materialSnapshot(material);
            return (
              <DesignMaterialChoice
                key={`${material.name}-${material.color}`}
                name={material.name}
                color={material.color}
                image={material.image}
                selected={draft.materials.some((chosen) => isSameMaterial(chosen, snapshot))}
                onPress={() => onChange({ ...draft, materials: toggleMaterial(draft.materials, snapshot) })}
              />
            );
          })}
        </>
      );

    case 'lighting':
      return (
        <>
          {DESIGN_LIGHTING.map((option) => (
            <DesignChoiceCard
              key={option.id}
              label={t(option.labelKey)}
              description={t(option.descriptionKey)}
              icon={option.icon}
              selected={draft.lighting === option.id}
              onPress={() => onChange({ ...draft, lighting: option.id })}
            />
          ))}
        </>
      );

    default:
      return null;
  }
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  /** Bottom padding is applied inline, with the navigation-bar inset added. */
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
  muted: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
  },
  error: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.danger,
  },

  stretch: { alignSelf: 'stretch' },

  /* ── Landing ── */
  saved: { marginTop: Spacing.md },
  savedHeader: { marginBottom: Spacing.sm },
  savedList: { gap: Spacing.sm },

  /* ── Flow ── */
  stepIntro: { gap: Spacing.xs },
  /**
   * A step question is a heading, not a page title: large enough to lead, but
   * short enough that German and Russian questions fit in two lines.
   */
  stepTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: 28,
    color: theme.text,
  },
  options: { gap: Spacing.sm },
  flowActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  flowAction: { flex: 1 },

  /* ── Board ── */
  boardActions: { gap: Spacing.sm },
  boardLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    // Text links, but still full-size touch targets.
    minHeight: 44,
    borderRadius: Radius.full,
  },
  linkPressed: { backgroundColor: theme.marble },
  linkLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: theme.primaryInk,
  },
  linkLabelMuted: { color: theme.textMuted },
});
