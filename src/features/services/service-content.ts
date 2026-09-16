import {
  hasLocalizedContent,
  resolveLocalizedContent,
  sanitizeLocalizedContent,
  type LocalizedContent,
} from '@/features/localization/localized-content';
import { SERVICE_CONTENT_FALLBACK } from '@/features/services/service-content-fallback';
import type { ServiceId } from '@/features/services/services-data';

/**
 * SERVICE PAGE CONTENT — admin-managed copy shared with the website.
 *
 * ── Source of truth ─────────────────────────────────────────────────────
 * Admin → Page Content → Architecture / Construction / Renovation / Interior
 * Design, stored as one PageContent document per page and served publicly at
 * GET /api/page-content/:pageKey (backend/routes/pageContent.js). The website
 * service pages read the same documents through usePageContent().
 *
 * The backend owns the CONTENT; this app owns the LAYOUT. Nothing here is a
 * layout instruction — known fields are mapped onto native components in
 * app/services/[service].tsx.
 *
 * ── Parity map ──────────────────────────────────────────────────────────
 * SERVICE_PAGES classifies every field and section of the backend contract
 * (backend/config/pageContentRegistry.js) for each page:
 *
 *   sharedFields / sections   rendered by the app, same meaning as the website
 *   websiteOnly               the website's interactive or other-collection
 *                             experiences (3D viewer, renovation studio,
 *                             style filter, finish picker, stats bar, in-page
 *                             anchors) — deliberately not rendered here
 *   bundledFields             app content with NO CMS field: Construction's
 *                             service cards and process steps, which the
 *                             website also hardcodes rather than storing
 *
 * tests/service-parity.test.mjs fails when a backend field or section is
 * added and left unclassified.
 *
 * ── Precedence ──────────────────────────────────────────────────────────
 * A field the admin has saved (with text in any language) is used, resolved
 * requested language → English → sourceLang → any. Otherwise the bundled
 * fallback (service-content-fallback.ts, the app's own six-language copy) is
 * used. A section the server marks hidden is hidden — the fallback never
 * brings it back.
 */

export type ServicePageKey = 'architecture' | 'construction' | 'renovation' | 'interior-design';

/** The showroom API's category names, which differ from the route ids for Interior Design. */
export type ShowroomCategory = 'architecture' | 'construction' | 'renovation' | 'interior';

/** The backend sections this app renders natively. */
export type ServiceSectionKind = 'showroom' | 'services' | 'process' | 'transform' | 'seismic' | 'cta';

export type ServicePageMap = {
  pageKey: ServicePageKey;
  showroomCategory: ShowroomCategory;
  /** Rendered sections, in the backend contract's order (the website's order). */
  sections: readonly ServiceSectionKind[];
  /** CMS fields rendered by the app. */
  sharedFields: readonly string[];
  /** Contract fields and sections that belong to website-only experiences. */
  websiteOnly: { readonly fields: readonly string[]; readonly sections: readonly string[] };
  /** App-bundled fields with no CMS equivalent. Never read from the server. */
  bundledFields: readonly string[];
  serviceItems: number;
  processSteps: number;
  transformItems: number;
};

const numbered = (prefix: string, count: number, suffix = '') =>
  Array.from({ length: count }, (_, index) => `${prefix}${index + 1}${suffix}`);

const serviceCards = (count: number) =>
  Array.from({ length: count }, (_, index) => [`service${index + 1}Title`, `service${index + 1}Desc`]).flat();

const HERO = ['heroLabel', 'heroHeading', 'heroSubtitle', 'heroCtaPrimary'];
const CTA = ['ctaHeading', 'ctaBody', 'ctaBtn'];
const SHOWROOM = ['showroomLabel', 'showroomHeading'];

export const SERVICE_PAGES: Readonly<Record<ServiceId, ServicePageMap>> = {
  architecture: {
    pageKey: 'architecture',
    showroomCategory: 'architecture',
    sections: ['showroom', 'services', 'process', 'cta'],
    sharedFields: [
      ...HERO,
      ...SHOWROOM,
      'servicesLabel', 'servicesHeading', ...serviceCards(4),
      'processLabel', 'processHeading', ...numbered('processStep', 4),
      ...CTA,
    ],
    websiteOnly: { fields: ['heroCtaSecondary'], sections: ['stats'] },
    bundledFields: [],
    serviceItems: 4,
    processSteps: 4,
    transformItems: 0,
  },
  construction: {
    pageKey: 'construction',
    showroomCategory: 'construction',
    sections: ['services', 'process', 'seismic', 'showroom', 'cta'],
    sharedFields: [
      ...HERO,
      'servicesLabel', 'servicesHeading',
      'processLabel', 'processHeading',
      'seismicLabel', 'seismicHeading', 'seismicBody',
      ...SHOWROOM,
      ...CTA,
    ],
    websiteOnly: {
      fields: ['heroCtaSecondary', 'viewerLabel', 'viewerHeading', 'viewerDesc', 'progressLabel', 'completionLabel'],
      sections: ['viewer'],
    },
    bundledFields: [...serviceCards(4), ...numbered('processStep', 5)],
    serviceItems: 4,
    processSteps: 5,
    transformItems: 0,
  },
  renovation: {
    pageKey: 'renovation',
    showroomCategory: 'renovation',
    sections: ['transform', 'services', 'showroom', 'cta'],
    sharedFields: [
      ...HERO,
      'transformLabel', 'transformHeading', 'beforeTitle', 'afterTitle',
      ...numbered('beforeItem', 4), ...numbered('afterItem', 4),
      'servicesLabel', 'servicesHeading', ...serviceCards(4),
      ...SHOWROOM,
      ...CTA,
    ],
    websiteOnly: {
      fields: ['heroCtaSecondary', 'studioLabel', 'studioHeading', 'studioDesc', 'paletteLabel', 'paletteHeading'],
      sections: ['studio', 'palette'],
    },
    bundledFields: [],
    serviceItems: 4,
    processSteps: 0,
    transformItems: 4,
  },
  'interior-design': {
    pageKey: 'interior-design',
    showroomCategory: 'interior',
    sections: ['showroom', 'services', 'cta'],
    sharedFields: [...HERO, ...SHOWROOM, 'servicesLabel', 'servicesHeading', ...serviceCards(4), ...CTA],
    websiteOnly: {
      fields: [
        'heroCtaSecondary', 'stylesLabel', 'stylesHeading', 'stylesFilterHint',
        'finishesLabel', 'finishesHeading', 'previewLabel', 'paletteHeading',
      ],
      sections: ['styles', 'finishes', 'palette'],
    },
    bundledFields: [],
    serviceItems: 4,
    processSteps: 0,
    transformItems: 0,
  },
};

/** The admin-saved content of one service page, made safe to render and cache. */
export type ServiceContent = {
  pageKey: ServicePageKey;
  /** Only shared fields that hold text in at least one language. */
  fields: Readonly<Record<string, LocalizedContent>>;
  /** Sections the admin switched off. */
  hiddenSections: readonly ServiceSectionKind[];
};

export type ResolvedServiceHero = { label: string; heading: string; subtitle: string; ctaPrimary: string };

export type ResolvedServiceSection =
  | { kind: 'showroom'; label: string; heading: string }
  | { kind: 'services'; label: string; heading: string; items: { title: string; desc: string }[] }
  | { kind: 'process'; label: string; heading: string; steps: string[] }
  | {
      kind: 'transform';
      label: string;
      heading: string;
      beforeTitle: string;
      afterTitle: string;
      before: string[];
      after: string[];
    }
  | { kind: 'seismic'; label: string; heading: string; body: string }
  | { kind: 'cta'; heading: string; body: string; button: string };

export type ResolvedServicePage = { hero: ResolvedServiceHero; sections: ResolvedServiceSection[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * GET /api/page-content/:pageKey's body — or a cached ServiceContent — made
 * safe for one service.
 *
 * Keeps only this page's shared text fields, drops Mongo internals and unknown
 * keys, rejects a cached entry for a different page, and records which
 * rendered sections are hidden. Returns null for anything that is not a
 * PageContent document, so callers keep what they already show.
 *
 * `{ fields: {}, sections: {} }` — a page nobody has edited yet — is a VALID
 * document: everything visible, nothing overridden.
 */
export function normalizeServiceContent(serviceId: ServiceId, payload: unknown): ServiceContent | null {
  const map = SERVICE_PAGES[serviceId];
  if (!map || !isPlainObject(payload)) return null;
  if (payload.success === false) return null;
  if (!('fields' in payload) && !('sections' in payload)) return null;
  if (payload.pageKey !== undefined && payload.pageKey !== map.pageKey) return null;

  const rawFields = isPlainObject(payload.fields) ? payload.fields : {};
  const fields: Record<string, LocalizedContent> = {};

  for (const key of map.sharedFields) {
    const raw = rawFields[key];
    // A text field carrying another stored type (e.g. an image) is not usable here.
    if (isPlainObject(raw) && raw.type !== undefined && raw.type !== 'text') continue;
    const clean = sanitizeLocalizedContent(raw);
    if (clean !== null && hasLocalizedContent(clean)) fields[key] = clean;
  }

  const rawSections = isPlainObject(payload.sections) ? payload.sections : {};
  const hiddenSections = map.sections.filter((section) => rawSections[section] === false);

  return { pageKey: map.pageKey, fields, hiddenSections };
}

/** The cacheable form: the same shape the API returns, so one normalizer reads both. */
export function serializeServiceContent(content: ServiceContent) {
  return {
    pageKey: content.pageKey,
    fields: content.fields,
    sections: Object.fromEntries(content.hiddenSections.map((section) => [section, false])),
  };
}

/**
 * Everything the service screen renders, for one language.
 *
 * `content` null means no server or cached document yet: every section is
 * visible and every field comes from the bundled fallback. Blank strings mean
 * "omit"; sections with nothing to show are dropped entirely.
 */
export function resolveServicePage(
  serviceId: ServiceId,
  content: ServiceContent | null,
  language: string
): ResolvedServicePage {
  const map = SERVICE_PAGES[serviceId];
  const fallback = SERVICE_CONTENT_FALLBACK[serviceId] ?? {};
  const text = (key: string) => resolveLocalizedContent(content?.fields[key] ?? fallback[key], language);
  const list = (keys: string[]) => keys.map(text).filter(Boolean);
  const hidden = new Set(content?.hiddenSections ?? []);

  const sections: ResolvedServiceSection[] = [];

  for (const kind of map.sections) {
    if (hidden.has(kind)) continue;

    if (kind === 'showroom') {
      sections.push({ kind, label: text('showroomLabel'), heading: text('showroomHeading') });
    } else if (kind === 'services') {
      const items = Array.from({ length: map.serviceItems }, (_, index) => ({
        title: text(`service${index + 1}Title`),
        desc: text(`service${index + 1}Desc`),
      })).filter((item) => item.title !== '');
      const heading = text('servicesHeading');
      if (items.length > 0 || heading) sections.push({ kind, label: text('servicesLabel'), heading, items });
    } else if (kind === 'process') {
      const steps = list(numbered('processStep', map.processSteps));
      const heading = text('processHeading');
      if (steps.length > 0 || heading) sections.push({ kind, label: text('processLabel'), heading, steps });
    } else if (kind === 'transform') {
      const before = list(numbered('beforeItem', map.transformItems));
      const after = list(numbered('afterItem', map.transformItems));
      if (before.length > 0 || after.length > 0) {
        sections.push({
          kind,
          label: text('transformLabel'),
          heading: text('transformHeading'),
          beforeTitle: text('beforeTitle'),
          afterTitle: text('afterTitle'),
          before,
          after,
        });
      }
    } else if (kind === 'seismic') {
      const heading = text('seismicHeading');
      const body = text('seismicBody');
      if (heading || body) sections.push({ kind, label: text('seismicLabel'), heading, body });
    } else if (kind === 'cta') {
      const button = text('ctaBtn');
      const heading = text('ctaHeading');
      if (button && heading) sections.push({ kind, heading, body: text('ctaBody'), button });
    }
  }

  return {
    hero: {
      label: text('heroLabel'),
      heading: text('heroHeading'),
      subtitle: text('heroSubtitle'),
      ctaPrimary: text('heroCtaPrimary'),
    },
    sections,
  };
}
