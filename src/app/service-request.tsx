import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import TextField from '@/components/ui/text-field';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import DesignStepProgress from '@/features/design-my-space/components/design-step-progress';
import { fetchAccountDesignBoards } from '@/features/design-my-space/design-board-api';
import { isServerDesignBoardId } from '@/features/design-my-space/design-board';
import { fetchDesignGeneration, designGenerationImageSource } from '@/features/design-my-space/design-generation-api';
import { hasVisualizationImage } from '@/features/design-my-space/design-generation';
import type { PickedRoomPhoto } from '@/features/design-my-space/room-photo-picker';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import {
  isRenovationPlanComplete,
  planAsRequestForm,
  type RenovationPlan,
} from '@/features/renovation-plan/renovation-plan';
import {
  clearRenovationPlan,
  readRenovationPlan,
  renovationPlanOwner,
  writeRenovationPlan,
} from '@/features/renovation-plan/renovation-plan-storage';
import { BudgetStep, PhotosStep, PropertyStep, StepHeading } from '@/features/service-requests/components/request-steps';
import SummaryCard from '@/features/service-requests/components/summary-card';
import {
  buildServiceRequestPayload,
  createServiceRequestIdempotencyKey,
  emptyServiceRequestForm,
  firstInvalidStep,
  parseSizeSqm,
  SERVICE_REQUEST_STEPS,
  serviceRequestErrorKey,
  serviceRequestTypeKey,
  stepErrorKey,
  type ServiceRequestDesignSnapshot,
  type ServiceRequestForm,
  type ServiceRequestStep,
  type ServiceRequestType,
} from '@/features/service-requests/service-request';
import { submitServiceRequest } from '@/features/service-requests/service-request-api';
import { DESIGN_ROOM_TO_REQUEST_ROOM, MAX_REQUEST_NOTES } from '@/features/service-requests/service-request-options';
import { designSnapshotRows, requestDetailRows } from '@/features/service-requests/service-request-presentation';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';
import type { UploadFile } from '@/services/api-upload';

/**
 * THE REQUEST STAGE — the customer deliberately asks Varlikent to act.
 *
 * This is the ONLY screen that creates a ServiceRequest (and with it the lead
 * and its email), and it is only ever reached from something the customer
 * already made:
 *
 *   /service-request?type=interior_design&boardId=…[&generationId=…]
 *       "Request this design" — from a saved board, with or without a
 *       visualization. There is no design-less Interior Design request; the
 *       server refuses one as well.
 *
 *   /service-request?type=renovation
 *       "Request renovation from Varlikent" — from the finished plan saved by
 *       the renovation planner (app/renovation-planner.tsx).
 *
 * It asks ONLY what is not already known: a design already says the room,
 * style, finishes and lighting; a plan already says the property, areas, work,
 * budget, timing and photos.
 *
 * One call submits everything. The idempotency key is created when the stage
 * opens and reused by every retry, so a double tap or a lost response can never
 * file two leads. On failure nothing is cleared.
 */

type DesignContext =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'ready'; snapshot: ServiceRequestDesignSnapshot; generationId: string | null; hasImage: boolean };

type PlanContext = { state: 'loading' } | { state: 'incomplete' } | { state: 'ready'; plan: RenovationPlan };

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const param = (value: unknown) => (typeof value === 'string' ? value : undefined);

export default function ServiceRequestScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { user, token, status } = useAuth();

  const type: ServiceRequestType = param(params.type) === 'renovation' ? 'renovation' : 'interior_design';
  const boardParam = param(params.boardId);
  const generationParam = param(params.generationId);
  const boardId = boardParam && isServerDesignBoardId(boardParam) ? boardParam : null;
  const generationId = generationParam && OBJECT_ID.test(generationParam) ? generationParam : null;

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const title = t(serviceRequestTypeKey(type));

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} onBack={leave} />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primaryInk} />
        </View>
      </SafeAreaView>
    );
  }

  if (status !== 'authenticated' || !token || !user) {
    // A request belongs to an account (it is listed in My Requests). The design
    // or plan the customer made is not lost by signing in.
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} onBack={leave} />
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={32} color={theme.primaryInk} />
          <Text style={styles.gateTitle}>{t('serviceRequests.gateTitle')}</Text>
          <Text style={styles.gateBody}>{t('serviceRequests.gateBody')}</Text>
          <Button label={t('common.signIn')} onPress={() => router.push('/login')} style={styles.stretch} />
          <Button label={t('common.createAccount')} variant="secondary" onPress={() => router.push('/register')} style={styles.stretch} />
        </View>
      </SafeAreaView>
    );
  }

  // Interior Design is ONLY "request this design".
  if (type === 'interior_design' && !boardId && !generationId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} onBack={leave} />
        <NeedsDesign onOpen={() => router.replace('/design-my-space')} />
      </SafeAreaView>
    );
  }

  return (
    <RequestForm
      key={`${user._id}-${type}-${boardId ?? ''}-${generationId ?? ''}`}
      type={type}
      token={token}
      userId={user._id}
      defaults={{ name: user.name ?? '', email: user.email ?? '' }}
      boardId={boardId}
      generationId={generationId}
      title={title}
      onLeave={leave}
    />
  );
}

function NeedsDesign({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.centered}>
      <Ionicons name="color-palette-outline" size={32} color={theme.primaryInk} />
      <Text style={styles.gateTitle}>{t('serviceRequests.needsDesignTitle')}</Text>
      <Text style={styles.gateBody}>{t('serviceRequests.needsDesignBody')}</Text>
      <Button label={t('services.primaryActions.designMySpace.label')} onPress={onOpen} style={styles.stretch} />
    </View>
  );
}

function RequestForm({
  type,
  token,
  userId,
  defaults,
  boardId,
  generationId,
  title,
  onLeave,
}: {
  type: ServiceRequestType;
  token: string;
  userId: string;
  defaults: Partial<ServiceRequestForm>;
  boardId: string | null;
  generationId: string | null;
  title: string;
  onLeave: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { textAlign, row } = useDirection();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<ServiceRequestForm>(() =>
    emptyServiceRequestForm(type, { ...defaults, designBoardId: boardId, generationId })
  );
  /** Extra photos added at request time (Interior Design). */
  const [extraPhotos, setExtraPhotos] = useState<PickedRoomPhoto[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [design, setDesign] = useState<DesignContext>({ state: 'loading' });
  const [planContext, setPlanContext] = useState<PlanContext>({ state: 'loading' });

  const idempotencyKey = useRef(createServiceRequestIdempotencyKey());
  const inFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const steps = SERVICE_REQUEST_STEPS[type];
  const step = steps[stepIndex];
  const planOwner = renovationPlanOwner(userId);

  const update = (patch: Partial<ServiceRequestForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setStepError(null);
  };

  /* ── What this request is FROM ──────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    if (type === 'renovation') {
      void (async () => {
        let plan = await readRenovationPlan(planOwner);
        // A plan made before signing in follows the customer into their account.
        if (!plan) {
          const guest = await readRenovationPlan('guest');
          if (guest) {
            plan = guest;
            await writeRenovationPlan(planOwner, guest);
            await clearRenovationPlan('guest');
          }
        }
        if (cancelled) return;
        if (!plan || !isRenovationPlanComplete(plan)) {
          setPlanContext({ state: 'incomplete' });
          return;
        }
        setPlanContext({ state: 'ready', plan });
        setForm((current) => ({ ...planAsRequestForm(plan), name: current.name, email: current.email, phone: current.phone, notes: current.notes }));
      })();
      return () => {
        cancelled = true;
      };
    }

    const prefill = (snapshot: ServiceRequestDesignSnapshot) => {
      const room = DESIGN_ROOM_TO_REQUEST_ROOM[snapshot.room];
      if (room) setForm((current) => ({ ...current, rooms: [room] }));
    };

    void (async () => {
      try {
        if (generationId) {
          const generation = await fetchDesignGeneration(token, generationId);
          if (cancelled) return;
          if (generation.status !== 'succeeded') throw new Error('not ready');
          setDesign({ state: 'ready', snapshot: generation.board, generationId: generation.id, hasImage: hasVisualizationImage(generation) });
          setForm((current) => ({ ...current, designBoardId: generation.boardId }));
          prefill(generation.board);
          return;
        }
        const boards = await fetchAccountDesignBoards(token);
        if (cancelled) return;
        const board = boards.find((item) => item.id === boardId);
        if (!board) throw new Error('missing');
        setDesign({ state: 'ready', snapshot: board, generationId: null, hasImage: false });
        prefill(board);
      } catch {
        if (!cancelled) setDesign({ state: 'missing' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [type, token, boardId, generationId, planOwner]);

  /* ── Movement ───────────────────────────────────────────────────────── */

  const goTo = (index: number) => {
    setStepIndex(index);
    setStepError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleBack = useCallback((): boolean => {
    if (submitting) return true;
    if (stepIndex > 0) {
      setStepIndex((index) => index - 1);
      setStepError(null);
      return true;
    }
    onLeave();
    return true;
  }, [stepIndex, submitting, onLeave]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => subscription.remove();
    }, [handleBack])
  );

  const handleContinue = () => {
    const errorKey = stepErrorKey(form, step);
    if (errorKey) {
      setStepError(t(errorKey));
      return;
    }
    goTo(stepIndex + 1);
  };

  const openPlanner = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/renovation-planner');
  };

  /* ── Submit ─────────────────────────────────────────────────────────── */

  const photosToSend = (): UploadFile[] => {
    if (type === 'renovation' && planContext.state === 'ready') {
      return planContext.plan.photos.map((photo, index) => ({ uri: photo.uri, name: `plan-${index + 1}.jpg`, type: 'image/jpeg' }));
    }
    return extraPhotos;
  };

  const handleSubmit = async () => {
    if (inFlight.current) return;

    const invalid = firstInvalidStep(form);
    if (invalid) {
      if (steps.includes(invalid)) {
        goTo(steps.indexOf(invalid));
        setStepError(t(stepErrorKey(form, invalid) ?? 'serviceRequests.errors.validation'));
      } else {
        // A plan field: the plan, not this stage, is where it is answered.
        setPlanContext({ state: 'incomplete' });
      }
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const request = await submitServiceRequest(token, buildServiceRequestPayload(form, idempotencyKey.current), photosToSend());
      // The plan has become a request; it is kept in My Requests from now on.
      if (type === 'renovation') await clearRenovationPlan(planOwner);
      router.replace({ pathname: '/requests/[id]', params: { id: request.id, submitted: '1' } });
    } catch (error) {
      // Nothing is cleared: answers, photos and the idempotency key all stay.
      setSubmitError(t(serviceRequestErrorKey(error instanceof ApiError ? error : null)));
      if (error instanceof ApiError && ['DESIGN_NOT_FOUND', 'DESIGN_REQUIRED', 'VISUALIZATION_NOT_READY'].includes(error.code ?? '')) {
        setDesign({ state: 'missing' });
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  /* ── Blocking states ────────────────────────────────────────────────── */

  const blocking =
    (type === 'interior_design' && design.state !== 'ready') || (type === 'renovation' && planContext.state !== 'ready');

  if (blocking) {
    const loading = design.state === 'loading' && type === 'interior_design' ? true : planContext.state === 'loading' && type === 'renovation';
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} onBack={onLeave} />
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.primaryInk} />
          </View>
        ) : type === 'renovation' ? (
          <View style={styles.centered}>
            <Ionicons name="clipboard-outline" size={32} color={theme.primaryInk} />
            <Text style={styles.gateTitle}>{t('serviceRequests.planIncompleteTitle')}</Text>
            <Text style={styles.gateBody}>{t('serviceRequests.planIncompleteBody')}</Text>
            <Button label={t('services.primaryActions.renovationPlanner.label')} onPress={openPlanner} style={styles.stretch} />
          </View>
        ) : (
          <View style={styles.centered}>
            <Ionicons name="color-palette-outline" size={32} color={theme.primaryInk} />
            <Text style={styles.gateTitle}>{t('serviceRequests.needsDesignTitle')}</Text>
            <Text style={styles.gateBody}>{t('serviceRequests.designMissing')}</Text>
            <Button label={t('services.primaryActions.designMySpace.label')} onPress={() => router.replace('/design-my-space')} style={styles.stretch} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  /* ── Steps ──────────────────────────────────────────────────────────── */

  const facts = {
    type,
    propertyType: form.propertyType ?? '',
    sizeSqm: typeof parseSizeSqm(form.sizeSqm) === 'number' ? (parseSizeSqm(form.sizeSqm) as number) : null,
    district: form.district.trim(),
    rooms: form.rooms,
    areas: form.areas,
    work: form.work,
    budget: form.budget ?? '',
    timeline: form.timeline ?? '',
    notes: form.notes.trim(),
  };

  const designCard =
    design.state === 'ready' ? (
      <View style={styles.designCard}>
        <Text style={[styles.designEyebrow, { textAlign }]}>{t('serviceRequests.fromDesign')}</Text>
        {design.generationId && design.hasImage ? (
          <Image
            source={designGenerationImageSource(token, design.generationId)}
            cachePolicy="none"
            contentFit="cover"
            transition={150}
            style={styles.designImage}
            accessibilityLabel={t('designMySpace.visualize.afterA11y')}
          />
        ) : null}
        <SummaryCard title={t('serviceRequests.designTitle')} rows={designSnapshotRows(t, design.snapshot)} />
        <Text style={[styles.muted, { textAlign }]}>{t('serviceRequests.designNote')}</Text>
      </View>
    ) : null;

  const renderStep = (current: ServiceRequestStep) => {
    switch (current) {
      case 'property':
        return (
          <>
            {designCard}
            <PropertyStep propertyType={form.propertyType} sizeSqm={form.sizeSqm} district={form.district} onChange={(patch) => update(patch)} />
          </>
        );
      case 'budget':
        return <BudgetStep budget={form.budget} timeline={form.timeline} onChange={(patch) => update(patch)} />;
      case 'photos':
        return (
          <PhotosStep
            body={t('serviceRequests.steps.photosBody')}
            photos={extraPhotos}
            disabled={submitting}
            onAdd={(photo) => setExtraPhotos((current) => [...current, photo])}
            onRemove={(uri) => setExtraPhotos((current) => current.filter((photo) => photo.uri !== uri))}
          />
        );
      case 'contact':
        return (
          <>
            <StepHeading title={t('serviceRequests.steps.contact')} body={t('serviceRequests.steps.contactBody')} />
            <TextField
              label={t('contact.nameLabel')}
              value={form.name}
              onChangeText={(value) => update({ name: value.slice(0, 120) })}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
            <TextField
              label={t('contact.emailFieldLabel')}
              value={form.email}
              onChangeText={(value) => update({ email: value.slice(0, 254) })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label={t('contact.phoneFieldLabel')}
              value={form.phone}
              onChangeText={(value) => update({ phone: value.slice(0, 40) })}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
            <TextField
              label={t('serviceRequests.fields.notesOptional')}
              value={form.notes}
              onChangeText={(value) => update({ notes: value.slice(0, MAX_REQUEST_NOTES) })}
              placeholder={t(type === 'renovation' ? 'serviceRequests.fields.notesPlaceholderRenovation' : 'serviceRequests.fields.notesPlaceholder')}
              multiline
            />
          </>
        );
      case 'review':
        return (
          <>
            <StepHeading title={t('serviceRequests.steps.review')} body={t('serviceRequests.steps.reviewBody')} />
            {designCard}
            <SummaryCard
              title={t(type === 'renovation' ? 'renovationPlanner.planTitle' : 'serviceRequests.detailsTitle')}
              rows={requestDetailRows(t, facts)}
            />
            {type === 'renovation' ? (
              <Button label={t('renovationPlanner.edit')} variant="secondary" onPress={openPlanner} disabled={submitting} style={styles.stretch} />
            ) : null}
            <SummaryCard
              title={t('serviceRequests.contactTitle')}
              rows={[
                [t('contact.nameLabel'), form.name.trim()],
                [t('contact.emailFieldLabel'), form.email.trim()],
                [t('contact.phoneFieldLabel'), form.phone.trim()],
                [t('serviceRequests.fields.photos'), String(photosToSend().length)],
              ]}
            />
            {submitError ? (
              <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
                {submitError}
              </Text>
            ) : null}
          </>
        );
      default:
        return null;
    }
  };

  const isLast = stepIndex === steps.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={title} onBack={() => handleBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <DesignStepProgress current={stepIndex + 1} total={steps.length} />
          {renderStep(step)}
          {stepError ? (
            <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
              {stepError}
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { flexDirection: row, paddingBottom: Spacing.md + insets.bottom }]}>
          {stepIndex > 0 ? (
            <Button label={t('common.back')} variant="secondary" onPress={() => handleBack()} disabled={submitting} style={styles.footerButton} />
          ) : null}
          <Button
            label={isLast ? t('serviceRequests.submit') : t('serviceRequests.continue')}
            onPress={isLast ? handleSubmit : handleContinue}
            loading={isLast && submitting}
            loadingLabel={t('serviceRequests.submitting')}
            disabled={submitting}
            style={styles.footerButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.softWhite },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    stretch: { alignSelf: 'stretch' },
    gateTitle: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.lg,
      color: theme.text,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    gateBody: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      lineHeight: 22,
      color: theme.textMuted,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
    muted: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, lineHeight: 18, color: theme.textMuted },
    error: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, lineHeight: 20, color: theme.danger },
    designCard: { gap: Spacing.sm },
    designEyebrow: { fontFamily: FontFamily.bodySemiBold, fontSize: FontSizes.overline, color: theme.primaryInk, textTransform: 'uppercase' },
    designImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, backgroundColor: theme.marble },
    footer: {
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.navBg,
    },
    footerButton: { flex: 1 },
  });
