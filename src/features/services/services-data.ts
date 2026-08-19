import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * SERVICE STRUCTURE — deliberately contains NO display copy.
 *
 * ── Why this file was rewritten ─────────────────────────────────────────
 * It previously held ~260 lines of English titles, descriptions, capability
 * copy, process steps and closing lines as a module-level constant. A module
 * constant is evaluated ONCE at import, before React runs, so `t()` could never
 * reach it: adding `useLanguage()` to the service screens translated the page
 * chrome and left every word of actual content in English. That is the same
 * class of bug as a module-level themed StyleSheet — a value frozen at import
 * that needed to be reactive.
 *
 * Now this file holds only what genuinely does not change with language:
 * the id, the icon, and the SHAPE of each page (which optional sections exist
 * and how many items they contain). Every string lives in the translation
 * bundles under `services.items.<key>` and is resolved during render, so
 * switching language updates an open service page immediately.
 *
 * ── Key derivation ──────────────────────────────────────────────────────
 * `translationKey` exists because the route id `interior-design` is not a valid
 * bare object key in the bundles, and because a screen should not have to
 * hand-build key strings. Everything a screen needs is derived from it:
 *
 *   services.items.interiorDesign.title
 *   services.items.interiorDesign.caps.lightingDesign.desc
 */

export type ServiceId = 'architecture' | 'construction' | 'renovation' | 'interior-design';

export type ServiceStructure = {
  id: ServiceId;
  /** Segment used to build `services.items.<translationKey>.*` keys. */
  translationKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * Capability slugs in display order. The two-digit numeral shown beside each
   * one ("01", "02") is derived from the index, so it can never drift out of
   * step with the list the way a hand-written `num` field could.
   */
  capabilities: string[];
  /** Number of process steps, or 0 when this service has no process section. */
  processSteps: number;
  /** Number of before/after rows, or 0 when there is no comparison section. */
  comparisonRows: number;
  /** Whether this service has the editorial note block. */
  hasNote: boolean;
};

/**
 * The optional sections are what stop the four pages reading as one template
 * filled in four times: process on Architecture and Construction, the
 * before/after comparison on Renovation, the seismic note on Construction.
 * Interior Design has none and is shorter as a result — which is honest.
 */
export const SERVICES: ServiceStructure[] = [
  {
    id: 'architecture',
    translationKey: 'architecture',
    icon: 'compass-outline',
    capabilities: ['conceptDesign', 'structuralEngineering', 'urbanPlanning', 'projectManagement'],
    processSteps: 4,
    comparisonRows: 0,
    hasNote: false,
  },
  {
    id: 'construction',
    translationKey: 'construction',
    icon: 'construct-outline',
    capabilities: ['generalContracting', 'structuralWorks', 'mepEngineering', 'envelopeFacade'],
    processSteps: 5,
    comparisonRows: 0,
    hasNote: true,
  },
  {
    id: 'renovation',
    translationKey: 'renovation',
    icon: 'hammer-outline',
    capabilities: ['windowsDoors', 'structuralAlterations', 'electricalLighting', 'bathroomKitchen'],
    processSteps: 0,
    comparisonRows: 4,
    hasNote: false,
  },
  {
    id: 'interior-design',
    translationKey: 'interiorDesign',
    icon: 'color-palette-outline',
    capabilities: ['conceptMoodBoards', 'furnitureSourcing', 'artAccessories', 'lightingDesign'],
    processSteps: 0,
    comparisonRows: 0,
    hasNote: false,
  },
];

export const getService = (id: string | undefined): ServiceStructure | undefined =>
  SERVICES.find((service) => service.id === id);

/** Root key for a service's copy, e.g. `services.items.interiorDesign`. */
export const serviceKey = (service: ServiceStructure, field: string): string =>
  `services.items.${service.translationKey}.${field}`;

/** The "01"/"02" numeral beside a capability, derived from its position. */
export const capabilityNumeral = (index: number): string => String(index + 1).padStart(2, '0');

/**
 * The intro line under the Services heading on Home.
 *
 * A KEY rather than a string — the previous `SERVICES_INTRO` constant was the
 * single most visible symptom of the frozen-module problem.
 */
export const SERVICES_INTRO_KEY = 'services.intro';
