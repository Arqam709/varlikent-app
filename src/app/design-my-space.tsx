import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import DesignBoardSummary from '@/features/design-my-space/components/design-board-summary';
import DesignChoiceCard from '@/features/design-my-space/components/design-choice-card';
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
  isStepComplete,
  materialOptionsWithSelection,
  materialSnapshot,
  toggleMaterial,
  type DesignBoard,
  type DesignDraft,
} from '@/features/design-my-space/design-board';
import {
  deleteDesignBoard,
  listDesignBoards,
  saveDesignBoard,
} from '@/features/design-my-space/design-board-repository';
import { designConsultationRoute } from '@/features/design-my-space/design-board-serializer';
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
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useStudioPalette } from '@/features/studio-palette/use-studio-palette';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * DESIGN MY SPACE — a guided design brief, on the device.
 *
 * Six steps, a board, and a handoff to the enquiry form the app already has.
 * It is not a renderer and does not pretend to be one: the user is describing
 * a room they want, not previewing one. No AI, no photographs of their home,
 * no camera, no 3D.
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
 *   the saved board           this device only (design-board-repository)
 *
 * Signing in is never required: this is an exploration tool, and boards live
 * in local storage precisely so an anonymous visitor can use all of it.
 */

type Screen = 'landing' | 'flow' | 'board';

export default function DesignMySpaceScreen() {
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
   * The draft's signature as it was when last saved or opened from disk.
   * Comparing against it drives both "Save Design" / "Saved" and whether
   * leaving the board needs a confirmation.
   */
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const step: DesignStep = DESIGN_STEPS[stepIndex];
  const unsaved = hasUnsavedChanges(savedDraft, draft);
  const isSaved = !unsaved;

  const refreshBoards = useCallback(async () => {
    setBoards(await listDesignBoards());
  }, []);

  useEffect(() => {
    void refreshBoards();
  }, [refreshBoards]);

  /* ── Movement ───────────────────────────────────────────────────────── */

  /**
   * Leaves the feature for the Interior Design page. `dismissTo` pops back to
   * it when it is underneath (the normal case), and replaces this screen with
   * it when Design My Space was opened without that history.
   */
  const leaveDesignMySpace = useCallback(() => {
    router.dismissTo(DESIGN_MY_SPACE_EXIT_HREF);
  }, [router]);

  /**
   * THE Back handler. Every back control calls this and nothing else, so the
   * header, the hardware button and the visible links cannot disagree.
   * Always returns true: this screen has handled the press.
   */
  const handleBack = useCallback((): boolean => {
    setSaveFailed(false);
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
    setSaveFailed(false);
    setStepIndex(0);
    setScreen('flow');
  };

  const openBoard = (board: DesignBoard) => {
    const next = draftFromBoard(board);
    setDraft(next);
    setBoardId(board.id);
    setCreatedAt(board.createdAt);
    setSavedDraft(draftSignature(next));
    setSaveFailed(false);
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
          await deleteDesignBoard(board.id);
          await refreshBoards();
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
    if (!board) return;

    const saved = await saveDesignBoard({ ...board, updatedAt: new Date().toISOString() });
    if (!saved) {
      setSaveFailed(true);
      return;
    }

    setSaveFailed(false);
    setCreatedAt(saved.createdAt);
    setSavedDraft(draftSignature(draft));
    await refreshBoards();
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
            <Text style={[styles.body, { textAlign }]}>{t('designMySpace.landingBody')}</Text>

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

              {boards.length === 0 ? (
                <Text style={[styles.muted, { textAlign }]}>{t('designMySpace.savedEmpty')}</Text>
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
                  setSaveFailed(false);
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

            {saveFailed ? (
              <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
                {t('designMySpace.saveFailed')}
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
                disabled={isSaved}
                onPress={handleSave}
                style={styles.stretch}
              />

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
