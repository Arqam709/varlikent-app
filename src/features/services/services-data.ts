import type Ionicons from '@expo/vector-icons/Ionicons';

import type { KnownContactInterestId } from '@/features/contact/contact-interests';

/**
 * SERVICE IDENTITY — the static, app-owned facts about each service.
 *
 * ── What lives here, and what does not ──────────────────────────────────
 * Here: the route id, the icon, the translation segment for NAVIGATION copy
 * (the title and short lines on Home, the Services list) and the Contact
 * interest the page's call to action opens.
 *
 * Not here: the service PAGE content — hero text, service cards, process
 * steps, before/after lists, the seismic note, the closing call to action.
 * That is admin-managed on the website (Admin → Page Content) and lives in
 * features/services/service-content.ts, with the app's bundled six-language
 * copy as its fallback in service-content-fallback.ts.
 *
 * `translationKey` exists because the route id `interior-design` is not a
 * valid bare object key in the bundles:
 *
 *   services.items.interiorDesign.title
 */

export type ServiceId = 'architecture' | 'construction' | 'renovation' | 'interior-design';

export type ServiceStructure = {
  id: ServiceId;
  /** Segment used to build `services.items.<translationKey>.*` navigation keys. */
  translationKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * The shared Contact interest this service opens the enquiry form with, as a
   * STABLE ID from the backend contract (backend/config/contactInterests.js),
   * sent as `/contact?interestType=<id>`.
   *
   * An id rather than the legacy value ('Interior Design'): the Contact screen
   * resolves it against the served list and submits that entry's value, and
   * falls back to General if the interest has been disabled.
   *
   *   • ONE field per entry, so the mapping cannot be written twice.
   *   • REQUIRED, so a new service cannot be added without deciding where it
   *     routes — a compile error, not a silent General.
   *   • Typed `KnownContactInterestId`, so a typo is caught by tsc.
   *
   * The import is TYPE-ONLY, so it adds no runtime edge to the contact module.
   */
  contactInterestId: KnownContactInterestId;
  /**
   * An app-only tool offered on this service's page, if it has one.
   *
   * Only Interior Design does: Design My Space, the six-step preference board
   * (features/design-my-space). It is declared HERE rather than as a condition
   * inside the service screen for the same reason `contactInterestId` is —
   * which service gets what is data about services, and the screen stays one
   * renderer for all four rather than growing a special case.
   *
   * Optional, because a service having no app-only tool is the normal case.
   */
  feature?: 'design-my-space';
  /**
   * Whether the hero shows its own consultation button. Defaults to shown.
   *
   * A MOBILE presentation choice, not content: the website keeps its hero
   * button and the Page Content is untouched. Interior Design turns it off
   * because on a phone its first action is Design My Space, and the closing
   * call to action at the bottom of the page is its one consultation button —
   * two identical "Book a Consultation" buttons on one small screen read as
   * repetition rather than emphasis.
   */
  heroContactCta?: boolean;
};

export const SERVICES: ServiceStructure[] = [
  { id: 'architecture', translationKey: 'architecture', icon: 'compass-outline', contactInterestId: 'architecture' },
  { id: 'construction', translationKey: 'construction', icon: 'construct-outline', contactInterestId: 'construction' },
  { id: 'renovation', translationKey: 'renovation', icon: 'hammer-outline', contactInterestId: 'renovation' },
  { id: 'interior-design', translationKey: 'interiorDesign', icon: 'color-palette-outline', contactInterestId: 'interior_design', feature: 'design-my-space', heroContactCta: false },
];

export const getService = (id: string | undefined): ServiceStructure | undefined =>
  SERVICES.find((service) => service.id === id);

/** True unless the service opts out of the hero consultation button. */
export const showsHeroContactCta = (service: ServiceStructure): boolean => service.heroContactCta !== false;

/** A navigation-copy key for a service, e.g. `services.items.interiorDesign.title`. */
export const serviceKey = (service: ServiceStructure, field: 'title' | 'short' | 'description'): string =>
  `services.items.${service.translationKey}.${field}`;

/** The "01"/"02" numeral beside a card or step, derived from its position. */
export const capabilityNumeral = (index: number): string => String(index + 1).padStart(2, '0');

/** The intro line under the Services heading on Home and the Services list. */
export const SERVICES_INTRO_KEY = 'services.intro';
