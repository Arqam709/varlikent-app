import {
  DESIGN_LIGHTING,
  DESIGN_ROOMS,
  DESIGN_STYLES,
  designOptionLabelKey,
} from '@/features/design-my-space/design-options';
import type { SummaryRow } from '@/features/service-requests/components/summary-card';
import type { ServiceRequestDesignSnapshot, ServiceRequestType } from '@/features/service-requests/service-request';
import { optionLabelKey } from '@/features/service-requests/service-request-options';

/**
 * How a request reads to its customer — on the form's Review step and in My
 * Requests. Labels come from the app's own translations for every id, and the
 * design snapshot reuses Design My Space's labels, so a board reads the same
 * here as where it was made.
 */

type Translate = (key: string, values?: Record<string, string>) => string;

/** The facts both the form and a stored request can describe. */
export type RequestFacts = {
  type: ServiceRequestType;
  propertyType: string;
  sizeSqm: number | null;
  district: string;
  rooms: readonly string[];
  areas: readonly string[];
  work: readonly string[];
  budget: string;
  timeline: string;
  notes: string;
};

const list = (t: Translate, group: string, ids: readonly string[]) =>
  ids.map((id) => t(optionLabelKey(group, id))).join(', ');

export function requestDetailRows(t: Translate, facts: RequestFacts): SummaryRow[] {
  const property = [
    facts.propertyType ? t(optionLabelKey('propertyTypes', facts.propertyType)) : '',
    facts.sizeSqm ? t('serviceRequests.sizeValue', { size: String(facts.sizeSqm) }) : '',
    facts.district,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows: SummaryRow[] = [[t('serviceRequests.fields.property'), property]];
  if (facts.type === 'interior_design') {
    rows.push([t('serviceRequests.fields.rooms'), list(t, 'rooms', facts.rooms)]);
  } else {
    rows.push([t('serviceRequests.fields.areas'), list(t, 'areas', facts.areas)]);
    rows.push([t('serviceRequests.fields.work'), list(t, 'work', facts.work)]);
  }
  rows.push([t('serviceRequests.fields.budget'), facts.budget ? t(optionLabelKey('budgets', facts.budget)) : '']);
  rows.push([t('serviceRequests.fields.timeline'), facts.timeline ? t(optionLabelKey('timelines', facts.timeline)) : '']);
  rows.push([t('serviceRequests.fields.notes'), facts.notes]);
  return rows;
}

export function designSnapshotRows(t: Translate, snapshot: ServiceRequestDesignSnapshot): SummaryRow[] {
  const label = (options: Parameters<typeof designOptionLabelKey>[0], id: string) => {
    const key = designOptionLabelKey(options, id);
    return key ? t(key) : id;
  };
  return [
    [t('designMySpace.fields.room'), label(DESIGN_ROOMS, snapshot.room)],
    [t('designMySpace.fields.style'), label(DESIGN_STYLES, snapshot.style)],
    [t('designMySpace.fields.wall'), snapshot.wall.label],
    [t('designMySpace.fields.floor'), snapshot.floor.label],
    [
      t('designMySpace.fields.materials'),
      snapshot.materials.length > 0
        ? snapshot.materials.map((material) => material.name).join(', ')
        : t('designMySpace.noMaterials'),
    ],
    [t('designMySpace.fields.lighting'), label(DESIGN_LIGHTING, snapshot.lighting)],
  ];
}

/**
 * The one line a request is listed under in My Requests:
 *   Interior Design from a design → "Living Room — Warm Modern"
 *   Interior Design, direct       → "Living Room, Kitchen"
 *   Renovation                    → "Kitchen + Bathroom"
 */
export function requestHeadline(
  t: Translate,
  request: {
    type: ServiceRequestType;
    rooms: readonly string[];
    areas: readonly string[];
    design: { snapshot: ServiceRequestDesignSnapshot } | null;
  }
): string {
  if (request.type === 'renovation') {
    return request.areas.map((id) => t(optionLabelKey('areas', id))).join(' + ');
  }
  const rooms = request.rooms.map((id) => t(optionLabelKey('rooms', id))).join(', ');
  if (request.design) {
    const key = designOptionLabelKey(DESIGN_STYLES, request.design.snapshot.style);
    return key ? `${rooms} — ${t(key)}` : rooms;
  }
  return rooms;
}
