/**
 * SERVICE REQUESTS — the pure model behind the request stage and My Requests.
 *
 * A request means ONE thing: the customer deliberately asked Varlikent to act
 * on something they already made — a saved design ("Request this design") or
 * a finished renovation plan ("Request renovation from Varlikent"). Designing
 * and planning never create one. The server stores it, files one ordinary lead
 * for it, and derives its status from that lead. This file holds the request
 * form, its per-step rules, the payload the server validates again, and a
 * defensive reader for what the server sends back.
 *
 * Pure: no React, no network, no imports — directly testable.
 */

export type ServiceRequestType = 'interior_design' | 'renovation';

/** Customer-facing status (backend: CONTACT_STATUS_TO_REQUEST_STATUS). */
export type ServiceRequestStatus = 'submitted' | 'contacted' | 'closed';

export type ServiceRequestStep =
  | 'property'
  | 'areas'
  | 'work'
  | 'budget'
  | 'photos'
  | 'contact'
  | 'review';

/**
 * The REQUEST stage of each type — only what is not already known.
 *
 *   interior_design  the design already says room, style, finishes and
 *                    lighting; the request adds the property, budget and
 *                    timing, optional extra photos, and how to reach them
 *   renovation       the plan already says everything about the work; the
 *                    request adds only how to reach them, then a review
 */
export const SERVICE_REQUEST_STEPS: Readonly<Record<ServiceRequestType, readonly ServiceRequestStep[]>> = {
  interior_design: ['property', 'budget', 'photos', 'contact', 'review'],
  renovation: ['contact', 'review'],
};

/**
 * Everything a complete request of each type must say, in the order to fix it.
 * For a renovation the first four come from the plan: a missing one sends the
 * customer back to the planner rather than into the request stage.
 */
export const SERVICE_REQUEST_REQUIRED: Readonly<Record<ServiceRequestType, readonly ServiceRequestStep[]>> = {
  interior_design: ['property', 'budget', 'contact'],
  renovation: ['property', 'areas', 'work', 'budget', 'contact'],
};

export type ServiceRequestForm = {
  type: ServiceRequestType;
  propertyType: string | null;
  /** As typed; parsed when submitting. */
  sizeSqm: string;
  district: string;
  rooms: string[];
  areas: string[];
  work: string[];
  budget: string | null;
  timeline: string | null;
  notes: string;
  name: string;
  email: string;
  phone: string;
  /** Set only when the form was opened from a design. */
  designBoardId: string | null;
  generationId: string | null;
};

export function emptyServiceRequestForm(
  type: ServiceRequestType,
  defaults: Partial<ServiceRequestForm> = {}
): ServiceRequestForm {
  return {
    type,
    propertyType: null,
    sizeSqm: '',
    district: '',
    rooms: [],
    areas: [],
    work: [],
    budget: null,
    timeline: null,
    notes: '',
    name: '',
    email: '',
    phone: '',
    designBoardId: null,
    generationId: null,
    ...defaults,
  };
}

/** Adds or removes one id from a multi-choice list. */
export function toggleChoice(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** '' when empty, a number when valid, null when invalid. */
export function parseSizeSqm(value: string): number | '' | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return '';
  const size = Number(trimmed);
  return Number.isFinite(size) && size >= 1 && size <= 100000 ? Math.round(size) : null;
}

/**
 * Why the user cannot continue past `step`, as a translation key — or null.
 * The server re-checks all of it; this only keeps the form honest early.
 */
export function stepErrorKey(form: ServiceRequestForm, step: ServiceRequestStep): string | null {
  switch (step) {
    case 'property':
      if (!form.propertyType) return 'serviceRequests.errors.propertyType';
      if (parseSizeSqm(form.sizeSqm) === null) return 'serviceRequests.errors.size';
      return null;
    case 'areas':
      return form.areas.length === 0 ? 'serviceRequests.errors.areas' : null;
    case 'work':
      return form.work.length === 0 ? 'serviceRequests.errors.work' : null;
    case 'budget':
      if (!form.budget) return 'serviceRequests.errors.budget';
      if (!form.timeline) return 'serviceRequests.errors.timeline';
      return null;
    case 'contact':
      if (!form.name.trim()) return 'serviceRequests.errors.name';
      if (!EMAIL_PATTERN.test(form.email.trim())) return 'serviceRequests.errors.email';
      if (form.phone.replace(/\D/g, '').length < 6) return 'serviceRequests.errors.phone';
      return null;
    default:
      return null;
  }
}

/** The first required step with a problem, so Submit can send the user straight to it. */
export function firstInvalidStep(form: ServiceRequestForm): ServiceRequestStep | null {
  return SERVICE_REQUEST_REQUIRED[form.type].find((step) => stepErrorKey(form, step) !== null) ?? null;
}

/**
 * The JSON the server validates. Only ids and the customer's own words — never
 * a translated label — and only the block that belongs to the type.
 */
export function buildServiceRequestPayload(form: ServiceRequestForm, idempotencyKey: string) {
  const size = parseSizeSqm(form.sizeSqm);
  return {
    type: form.type,
    idempotencyKey,
    contact: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
    property: {
      type: form.propertyType,
      ...(typeof size === 'number' ? { sizeSqm: size } : {}),
      ...(form.district.trim() ? { district: form.district.trim() } : {}),
    },
    budget: form.budget,
    timeline: form.timeline,
    notes: form.notes.trim(),
    ...(form.type === 'interior_design'
      ? {
          interiorDesign: {
            rooms: form.rooms,
            ...(form.designBoardId ? { designBoardId: form.designBoardId } : {}),
            ...(form.generationId ? { generationId: form.generationId } : {}),
          },
        }
      : { renovation: { areas: form.areas, work: form.work } }),
  };
}

/**
 * A key for ONE submit attempt, kept across its retries: a lost response or a
 * double tap returns the request already made instead of filing another lead.
 * Not security-sensitive — the server scopes keys to the signed-in user.
 */
export function createServiceRequestIdempotencyKey(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `sr-${Date.now().toString(36)}-${random()}${random()}`;
}

/* ── What the server sends back ─────────────────────────────────────────── */

export type ServiceRequestDesignSnapshot = {
  room: string;
  style: string;
  wall: { label: string; color: string };
  floor: { label: string; color: string };
  materials: { name: string; color: string }[];
  lighting: string;
};

export type ServiceRequestPhoto = {
  id: string;
  kind: 'customer' | 'room_photo' | 'visualization';
  width: number;
  height: number;
};

export type ServiceRequest = {
  id: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  createdAt: string;
  contact: { name: string; email: string; phone: string };
  property: { type: string; sizeSqm: number | null; district: string };
  budget: string;
  timeline: string;
  notes: string;
  rooms: string[];
  areas: string[];
  work: string[];
  design: { boardId: string | null; generationId: string | null; snapshot: ServiceRequestDesignSnapshot } | null;
  photos: ServiceRequestPhoto[];
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const STATUSES: readonly ServiceRequestStatus[] = ['submitted', 'contacted', 'closed'];
const PHOTO_KINDS: readonly ServiceRequestPhoto['kind'][] = ['customer', 'room_photo', 'visualization'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const idOrNull = (value: unknown): string | null =>
  typeof value === 'string' && OBJECT_ID.test(value) ? value : null;

function snapshotFromServer(value: unknown): ServiceRequestDesignSnapshot | null {
  if (!isObject(value) || !isObject(value.wall) || !isObject(value.floor)) return null;
  const snapshot = {
    room: str(value.room),
    style: str(value.style),
    wall: { label: str(value.wall.label), color: str(value.wall.color) },
    floor: { label: str(value.floor.label), color: str(value.floor.color) },
    materials: Array.isArray(value.materials)
      ? value.materials
          .filter(isObject)
          .map((material) => ({ name: str(material.name), color: str(material.color) }))
          .filter((material) => material.name)
      : [],
    lighting: str(value.lighting),
  };
  return snapshot.room && snapshot.style ? snapshot : null;
}

/** One request from the API, or null when it is unusable. Never throws. */
export function serviceRequestFromServer(value: unknown): ServiceRequest | null {
  if (!isObject(value)) return null;
  const id = idOrNull(value._id);
  const type = value.type === 'interior_design' || value.type === 'renovation' ? value.type : null;
  if (!id || !type) return null;

  const status = STATUSES.includes(value.status as ServiceRequestStatus)
    ? (value.status as ServiceRequestStatus)
    : 'submitted';
  const contact = isObject(value.contact) ? value.contact : {};
  const property = isObject(value.property) ? value.property : {};
  const interior = isObject(value.interiorDesign) ? value.interiorDesign : null;
  const renovation = isObject(value.renovation) ? value.renovation : null;
  const design = interior && isObject(interior.design) ? interior.design : null;
  const snapshot = design ? snapshotFromServer(design.snapshot) : null;

  return {
    id,
    type,
    status,
    createdAt: str(value.createdAt),
    contact: { name: str(contact.name), email: str(contact.email), phone: str(contact.phone) },
    property: {
      type: str(property.type),
      sizeSqm: typeof property.sizeSqm === 'number' ? property.sizeSqm : null,
      district: str(property.district),
    },
    budget: str(value.budget),
    timeline: str(value.timeline),
    notes: str(value.notes),
    rooms: interior ? strList(interior.rooms) : [],
    areas: renovation ? strList(renovation.areas) : [],
    work: renovation ? strList(renovation.work) : [],
    design: design && snapshot
      ? { boardId: idOrNull(design.boardId), generationId: idOrNull(design.generationId), snapshot }
      : null,
    photos: Array.isArray(value.photos)
      ? value.photos
          .filter(isObject)
          .map((photo) => ({
            id: idOrNull(photo._id) ?? '',
            kind: PHOTO_KINDS.includes(photo.kind as ServiceRequestPhoto['kind'])
              ? (photo.kind as ServiceRequestPhoto['kind'])
              : 'customer',
            width: typeof photo.width === 'number' && photo.width > 0 ? photo.width : 4,
            height: typeof photo.height === 'number' && photo.height > 0 ? photo.height : 3,
          }))
          .filter((photo) => photo.id)
      : [],
  };
}

/** Translation keys for the type and status labels. */
export const serviceRequestTypeKey = (type: ServiceRequestType) => `serviceRequests.types.${type}`;
export const serviceRequestStatusKey = (status: ServiceRequestStatus) => `serviceRequests.statuses.${status}`;

/** The error a failed submit should show, as a translation key. */
export function serviceRequestErrorKey(error: { code?: string; kind?: string } | null | undefined): string {
  switch (error?.code) {
    case 'DESIGN_NOT_FOUND':
    case 'DESIGN_REQUIRED':
      return 'serviceRequests.errors.designMissing';
    case 'VISUALIZATION_NOT_READY':
      return 'serviceRequests.errors.visualizationNotReady';
    case 'REQUEST_DAILY_LIMIT':
      return 'serviceRequests.errors.dailyLimit';
    case 'TOO_MANY_PHOTOS':
      return 'serviceRequests.errors.tooManyPhotos';
    case 'PHOTO_STORAGE_FAILED':
      return 'serviceRequests.errors.photoStorage';
    case 'PHOTO_FILE_TOO_LARGE':
    case 'PHOTO_UNREADABLE':
    case 'PHOTO_UNSUPPORTED_FORMAT':
    case 'PHOTO_DIMENSIONS_TOO_LARGE':
    case 'PHOTO_TOO_SMALL':
    case 'PHOTO_ASPECT_RATIO':
      return 'serviceRequests.errors.photoInvalid';
    case 'VALIDATION_FAILED':
      return 'serviceRequests.errors.validation';
    default:
      break;
  }
  if (error?.kind === 'network' || error?.kind === 'timeout') return 'serviceRequests.errors.network';
  return 'serviceRequests.errors.generic';
}
