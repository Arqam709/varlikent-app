import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * SERVICE REQUEST VOCABULARY — the choices on the Interior Design and
 * Renovation request forms.
 *
 * Every id here is the id the backend stores and validates
 * (backend/config/serviceRequests.js); tests/service-requests.test.mjs keeps
 * the two lists identical. The app shows its own translated label for each id
 * (`serviceRequests.options.<group>.<id>`) — no label ever travels to the
 * server, and the server never sends one back.
 *
 * The Renovation work list starts with the Renovation page's own four services
 * (Window & Door Replacement, Structural Alterations, Electrical & Lighting,
 * Bathroom & Kitchen), so the form speaks the same language as the page that
 * opened it.
 */

export type ServiceRequestType = 'interior_design' | 'renovation';

export const SERVICE_REQUEST_TYPES: readonly ServiceRequestType[] = ['interior_design', 'renovation'];

export type RequestOption = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const PROPERTY_TYPES: readonly RequestOption[] = [
  { id: 'apartment', icon: 'business-outline' },
  { id: 'villa', icon: 'home-outline' },
  { id: 'house', icon: 'home-outline' },
  { id: 'office', icon: 'briefcase-outline' },
  { id: 'commercial', icon: 'storefront-outline' },
  { id: 'other', icon: 'ellipsis-horizontal-outline' },
];

export const INTERIOR_ROOMS: readonly RequestOption[] = [
  { id: 'living_room', icon: 'tv-outline' },
  { id: 'bedroom', icon: 'bed-outline' },
  { id: 'kitchen', icon: 'restaurant-outline' },
  { id: 'bathroom', icon: 'water-outline' },
  { id: 'dining_room', icon: 'wine-outline' },
  { id: 'office', icon: 'briefcase-outline' },
  { id: 'whole_home', icon: 'home-outline' },
  { id: 'other', icon: 'ellipsis-horizontal-outline' },
];

export const RENOVATION_AREAS: readonly RequestOption[] = [
  { id: 'whole_property', icon: 'home-outline' },
  { id: 'kitchen', icon: 'restaurant-outline' },
  { id: 'bathroom', icon: 'water-outline' },
  { id: 'living_areas', icon: 'tv-outline' },
  { id: 'bedrooms', icon: 'bed-outline' },
  { id: 'exterior', icon: 'business-outline' },
  { id: 'other', icon: 'ellipsis-horizontal-outline' },
];

export const RENOVATION_WORK: readonly RequestOption[] = [
  { id: 'windows_doors', icon: 'grid-outline' },
  { id: 'structural', icon: 'construct-outline' },
  { id: 'electrical_lighting', icon: 'bulb-outline' },
  { id: 'kitchen_bathroom', icon: 'water-outline' },
  { id: 'flooring', icon: 'layers-outline' },
  { id: 'painting', icon: 'color-fill-outline' },
  { id: 'plumbing', icon: 'build-outline' },
  { id: 'full_renovation', icon: 'hammer-outline' },
];

export const BUDGETS: readonly RequestOption[] = [
  { id: 'under_500k', icon: 'cash-outline' },
  { id: '500k_1m', icon: 'cash-outline' },
  { id: '1m_2_5m', icon: 'cash-outline' },
  { id: 'over_2_5m', icon: 'cash-outline' },
  { id: 'undecided', icon: 'help-circle-outline' },
];

export const TIMELINES: readonly RequestOption[] = [
  { id: 'asap', icon: 'flash-outline' },
  { id: 'within_3_months', icon: 'calendar-outline' },
  { id: '3_6_months', icon: 'calendar-outline' },
  { id: 'flexible', icon: 'time-outline' },
];

/** Translation key for an option's label. */
export const optionLabelKey = (group: string, id: string): string => `serviceRequests.options.${group}.${id}`;

/** A Design My Space room id → the request's room id (backend: DESIGN_ROOM_TO_REQUEST_ROOM). */
export const DESIGN_ROOM_TO_REQUEST_ROOM: Readonly<Record<string, string>> = {
  'living-room': 'living_room',
  bedroom: 'bedroom',
  kitchen: 'kitchen',
  bathroom: 'bathroom',
  office: 'office',
};

/** Customer photos per request; the design's own images are extra. */
export const MAX_REQUEST_PHOTOS = 6;

export const MAX_REQUEST_NOTES = 2000;
