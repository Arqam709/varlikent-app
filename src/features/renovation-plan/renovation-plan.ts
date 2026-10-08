import {
  emptyServiceRequestForm,
  stepErrorKey,
  type ServiceRequestForm,
} from '@/features/service-requests/service-request';

/**
 * A RENOVATION PLAN — the customer's own planning, before (and without) any
 * request to Varlikent.
 *
 * "Plan Your Renovation" means exactly that: property, areas, work, budget and
 * timing, and photos of the space, ending in a summary the customer can keep,
 * edit or throw away. Nothing here reaches the server. Only when the customer
 * explicitly chooses "Request renovation from Varlikent" does a plan become a
 * ServiceRequest — and that is the request stage's job, not the planner's.
 *
 * The plan reuses the request form's field shape and rules
 * (features/service-requests/service-request.ts), so a plan the planner calls
 * complete is exactly one the request stage — and the server — will accept.
 *
 * Pure: no React, no storage, no network.
 */

export type RenovationPlanStep = 'property' | 'areas' | 'work' | 'budget' | 'photos' | 'summary';

export const RENOVATION_PLAN_STEPS: readonly RenovationPlanStep[] = [
  'property',
  'areas',
  'work',
  'budget',
  'photos',
  'summary',
];

/** A photo of the space as it is today, as picked on this device. */
export type RenovationPlanPhoto = { uri: string; width: number; height: number };

export type RenovationPlan = {
  propertyType: string | null;
  /** As typed; validated like the request form's. */
  sizeSqm: string;
  district: string;
  areas: string[];
  work: string[];
  budget: string | null;
  timeline: string | null;
  photos: RenovationPlanPhoto[];
  /** ISO time of the last change, shown on the summary. */
  updatedAt: string;
};

export function emptyRenovationPlan(now: Date = new Date()): RenovationPlan {
  return {
    propertyType: null,
    sizeSqm: '',
    district: '',
    areas: [],
    work: [],
    budget: null,
    timeline: null,
    photos: [],
    updatedAt: now.toISOString(),
  };
}

/** The plan as the request form sees it: the same fields, no contact yet. */
export function planAsRequestForm(
  plan: RenovationPlan,
  contact: Partial<Pick<ServiceRequestForm, 'name' | 'email' | 'phone' | 'notes'>> = {}
): ServiceRequestForm {
  return emptyServiceRequestForm('renovation', {
    propertyType: plan.propertyType,
    sizeSqm: plan.sizeSqm,
    district: plan.district,
    areas: plan.areas,
    work: plan.work,
    budget: plan.budget,
    timeline: plan.timeline,
    ...contact,
  });
}

/** Why the customer cannot continue past a planning step, or null. Photos never block. */
export function planStepErrorKey(plan: RenovationPlan, step: RenovationPlanStep): string | null {
  if (step === 'photos' || step === 'summary') return null;
  return stepErrorKey(planAsRequestForm(plan), step);
}

/** The first planning step that still needs an answer, or null when the plan is complete. */
export function firstIncompletePlanStep(plan: RenovationPlan): RenovationPlanStep | null {
  return RENOVATION_PLAN_STEPS.find((step) => planStepErrorKey(plan, step) !== null) ?? null;
}

export const isRenovationPlanComplete = (plan: RenovationPlan): boolean => firstIncompletePlanStep(plan) === null;

/** True when the customer has answered anything at all (worth offering to resume). */
export function hasPlanContent(plan: RenovationPlan): boolean {
  return Boolean(
    plan.propertyType ||
      plan.sizeSqm.trim() ||
      plan.district.trim() ||
      plan.areas.length ||
      plan.work.length ||
      plan.budget ||
      plan.timeline ||
      plan.photos.length
  );
}

/* ── Reading a stored plan ──────────────────────────────────────────────── */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
const strOrNull = (value: unknown) => (typeof value === 'string' && value ? value : null);
const strList = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];

/**
 * A plan read back from storage, or null when it is unusable. Never throws.
 * Unknown ids survive this reader on purpose — the planner simply shows them
 * unselected, and the server refuses anything invalid at request time.
 */
export function renovationPlanFromStorage(value: unknown): RenovationPlan | null {
  if (!isObject(value)) return null;
  const photos = Array.isArray(value.photos)
    ? value.photos
        .filter(isObject)
        .map((photo) => ({
          uri: str(photo.uri, 2048),
          width: typeof photo.width === 'number' && photo.width > 0 ? photo.width : 4,
          height: typeof photo.height === 'number' && photo.height > 0 ? photo.height : 3,
        }))
        .filter((photo) => photo.uri.startsWith('file:'))
    : [];
  return {
    propertyType: strOrNull(value.propertyType),
    sizeSqm: str(value.sizeSqm, 7),
    district: str(value.district, 80),
    areas: strList(value.areas),
    work: strList(value.work),
    budget: strOrNull(value.budget),
    timeline: strOrNull(value.timeline),
    photos,
    updatedAt: typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
      ? value.updatedAt
      : new Date(0).toISOString(),
  };
}
