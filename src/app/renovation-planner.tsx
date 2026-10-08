import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import DesignStepProgress from '@/features/design-my-space/components/design-step-progress';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import {
  emptyRenovationPlan,
  firstIncompletePlanStep,
  planStepErrorKey,
  RENOVATION_PLAN_STEPS,
  type RenovationPlan,
} from '@/features/renovation-plan/renovation-plan';
import {
  clearRenovationPlan,
  readRenovationPlan,
  renovationPlanOwner,
  writeRenovationPlan,
} from '@/features/renovation-plan/renovation-plan-storage';
import {
  BudgetStep,
  MultiChoiceStep,
  PhotosStep,
  PropertyStep,
  StepHeading,
} from '@/features/service-requests/components/request-steps';
import SummaryCard from '@/features/service-requests/components/summary-card';
import { parseSizeSqm, toggleChoice } from '@/features/service-requests/service-request';
import { MAX_REQUEST_PHOTOS, RENOVATION_AREAS, RENOVATION_WORK } from '@/features/service-requests/service-request-options';
import { requestDetailRows } from '@/features/service-requests/service-request-presentation';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { formatShortDate } from '@/utils/format-short-date';

/**
 * PLAN YOUR RENOVATION — a planner, not a form to Varlikent.
 *
 *   property → areas → work → budget & timing → photos → YOUR PLAN
 *
 * Nothing on this screen contacts Varlikent: no request, no lead, no email.
 * The plan is kept on this device (see renovation-plan-storage) and reopens on
 * the summary next time. From the summary the customer may, if and when they
 * choose, "Request renovation from Varlikent" — which is the request stage
 * (app/service-request.tsx), a separate screen and a separate decision.
 *
 * No sign-in needed: planning is for everyone. Requesting needs an account.
 */

type View_ = { name: 'loading' } | { name: 'step'; index: number } | { name: 'summary' };

const SAVE_DELAY_MS = 400;

export default function RenovationPlannerScreen() {
  const { user, status } = useAuth();
  const owner = renovationPlanOwner(user?._id);
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const router = useRouter();

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/services/renovation');
  }, [router]);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('renovationPlanner.title')} onBack={leave} />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primaryInk} />
        </View>
      </SafeAreaView>
    );
  }

  // Keyed by owner: signing in or out swaps to that account's own plan.
  return <Planner key={owner} owner={owner} onLeave={leave} />;
}

function Planner({ owner, onLeave }: { owner: string; onLeave: () => void }) {
  const { t, language } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { textAlign, row } = useDirection();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<RenovationPlan>(emptyRenovationPlan);
  const [view, setView] = useState<View_>({ name: 'loading' });
  const [stepError, setStepError] = useState<string | null>(null);
  const loaded = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  /* ── The saved plan ─────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await readRenovationPlan(owner);
      if (cancelled) return;
      if (saved) {
        setPlan(saved);
        const incomplete = firstIncompletePlanStep(saved);
        setView(incomplete === null ? { name: 'summary' } : { name: 'step', index: RENOVATION_PLAN_STEPS.indexOf(incomplete) });
      } else {
        setView({ name: 'step', index: 0 });
      }
      loaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  // Kept as the customer goes, so leaving at any point loses nothing.
  useEffect(() => {
    if (!loaded.current) return undefined;
    const timer = setTimeout(() => void writeRenovationPlan(owner, plan), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [owner, plan]);

  const update = (patch: Partial<RenovationPlan>) => {
    setPlan((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    setStepError(null);
  };

  /* ── Movement ───────────────────────────────────────────────────────── */

  const goToStep = (index: number) => {
    setView({ name: 'step', index });
    setStepError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleBack = useCallback((): boolean => {
    if (view.name === 'step' && view.index > 0) {
      setView({ name: 'step', index: view.index - 1 });
      setStepError(null);
      return true;
    }
    onLeave();
    return true;
  }, [view, onLeave]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => subscription.remove();
    }, [handleBack])
  );

  const handleContinue = () => {
    if (view.name !== 'step') return;
    const step = RENOVATION_PLAN_STEPS[view.index];
    const errorKey = planStepErrorKey(plan, step);
    if (errorKey) {
      setStepError(t(errorKey));
      return;
    }
    const next = RENOVATION_PLAN_STEPS[view.index + 1];
    if (!next || next === 'summary') {
      setView({ name: 'summary' });
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    goToStep(view.index + 1);
  };

  /* ── Summary actions ────────────────────────────────────────────────── */

  /** The one way from a plan to Varlikent — a separate, explicit request stage. */
  const requestRenovation = async () => {
    await writeRenovationPlan(owner, plan);
    router.push({ pathname: '/service-request', params: { type: 'renovation' } });
  };

  const startOver = () => {
    Alert.alert(t('renovationPlanner.startOverTitle'), t('renovationPlanner.startOverBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('renovationPlanner.startOverConfirm'),
        style: 'destructive',
        onPress: () => {
          void clearRenovationPlan(owner);
          setPlan(emptyRenovationPlan());
          goToStep(0);
        },
      },
    ]);
  };

  /* ── Rendering ──────────────────────────────────────────────────────── */

  const size = parseSizeSqm(plan.sizeSqm);
  const facts = {
    type: 'renovation' as const,
    propertyType: plan.propertyType ?? '',
    sizeSqm: typeof size === 'number' ? size : null,
    district: plan.district.trim(),
    rooms: [],
    areas: plan.areas,
    work: plan.work,
    budget: plan.budget ?? '',
    timeline: plan.timeline ?? '',
    notes: '',
  };

  const dropPhoto = (uri: string) => update({ photos: plan.photos.filter((photo) => photo.uri !== uri) });

  const renderStep = (index: number) => {
    switch (RENOVATION_PLAN_STEPS[index]) {
      case 'property':
        return (
          <PropertyStep
            propertyType={plan.propertyType}
            sizeSqm={plan.sizeSqm}
            district={plan.district}
            onChange={(patch) => update(patch)}
          />
        );
      case 'areas':
        return (
          <MultiChoiceStep
            title={t('serviceRequests.steps.areas')}
            body={t('serviceRequests.steps.areasBody')}
            options={RENOVATION_AREAS}
            group="areas"
            selected={plan.areas}
            onToggle={(id) => update({ areas: toggleChoice(plan.areas, id) })}
          />
        );
      case 'work':
        return (
          <MultiChoiceStep
            title={t('serviceRequests.steps.work')}
            body={t('serviceRequests.steps.workBody')}
            options={RENOVATION_WORK}
            group="work"
            selected={plan.work}
            onToggle={(id) => update({ work: toggleChoice(plan.work, id) })}
          />
        );
      case 'budget':
        return <BudgetStep budget={plan.budget} timeline={plan.timeline} onChange={(patch) => update(patch)} />;
      case 'photos':
        return (
          <PhotosStep
            body={t('serviceRequests.steps.photosBodyRenovation')}
            photos={plan.photos}
            onAdd={(photo) =>
              update({
                photos:
                  plan.photos.length >= MAX_REQUEST_PHOTOS
                    ? plan.photos
                    : [...plan.photos, { uri: photo.uri, width: photo.width, height: photo.height }],
              })
            }
            onRemove={dropPhoto}
            onUnavailable={dropPhoto}
          />
        );
      default:
        return null;
    }
  };

  if (view.name === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('renovationPlanner.title')} onBack={onLeave} />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primaryInk} />
        </View>
      </SafeAreaView>
    );
  }

  const planSteps = RENOVATION_PLAN_STEPS.length - 1; // the summary is not a question

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('renovationPlanner.title')} onBack={() => handleBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {view.name === 'step' ? (
            <>
              <DesignStepProgress current={view.index + 1} total={planSteps} />
              {renderStep(view.index)}
              {stepError ? (
                <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
                  {stepError}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <StepHeading title={t('renovationPlanner.summaryTitle')} body={t('renovationPlanner.summaryBody')} />
              <SummaryCard title={t('renovationPlanner.planTitle')} rows={requestDetailRows(t, facts)} />
              <View style={styles.photosBlock}>
                <Text style={[styles.subheading, { textAlign }]}>
                  {t('renovationPlanner.photosCount', { count: String(plan.photos.length) })}
                </Text>
                {plan.photos.length > 0 ? (
                  <View style={[styles.thumbs, { flexDirection: row }]}>
                    {plan.photos.map((photo) => (
                      <Image
                        key={photo.uri}
                        source={{ uri: photo.uri }}
                        contentFit="cover"
                        style={styles.thumb}
                        onError={() => dropPhoto(photo.uri)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={[styles.savedNote, { flexDirection: row }]}>
                <Ionicons name="phone-portrait-outline" size={18} color={theme.primaryInk} />
                <Text style={[styles.savedNoteText, { textAlign }]}>
                  {t('renovationPlanner.savedNote', { date: formatShortDate(plan.updatedAt, language) })}
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Spacing.md + insets.bottom }]}>
          {view.name === 'step' ? (
            <View style={[styles.footerRow, { flexDirection: row }]}>
              {view.index > 0 ? (
                <Button label={t('common.back')} variant="secondary" onPress={() => handleBack()} style={styles.footerButton} />
              ) : null}
              <Button
                label={view.index === planSteps - 1 ? t('renovationPlanner.seePlan') : t('serviceRequests.continue')}
                onPress={handleContinue}
                style={styles.footerButton}
              />
            </View>
          ) : (
            <>
              <Button label={t('renovationPlanner.request')} onPress={() => void requestRenovation()} />
              <View style={[styles.footerRow, { flexDirection: row }]}>
                <Button label={t('renovationPlanner.edit')} variant="secondary" onPress={() => goToStep(0)} style={styles.footerButton} />
                <Button label={t('renovationPlanner.startOver')} variant="secondary" onPress={startOver} style={styles.footerButton} />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.softWhite },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
    error: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, lineHeight: 20, color: theme.danger },
    subheading: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.md, color: theme.text },
    photosBlock: { gap: Spacing.sm },
    thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    thumb: { width: 72, height: 72, borderRadius: Radius.sm, backgroundColor: theme.marble },
    savedNote: {
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: theme.marble,
    },
    savedNoteText: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSizes.sm, lineHeight: 20, color: theme.text },
    footer: {
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.navBg,
    },
    footerRow: { gap: Spacing.sm },
    footerButton: { flex: 1 },
  });
