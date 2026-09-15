import {
  hasLocalizedContent,
  resolveLocalizedContent,
  sanitizeLocalizedContent,
  type LocalizedContent,
} from '@/features/localization/localized-content';

/**
 * ABOUT VARLIKENT — the shared content model for the Home preview and /about.
 *
 * ── Source of truth ─────────────────────────────────────────────────────
 * The website's About CMS: `AboutContent` in MongoDB, edited at Admin → About
 * Page, served unchanged by GET /api/about. The app never edits it. This file
 * turns that response into something safe to render and to cache:
 *
 *   normalizeAboutContent(payload)   response or cache → AboutContent | null
 *   resolveAboutContent(content, language) → plain strings for one language
 *   selectAboutPreview(resolved)     the short Home version
 *
 * Localized fields stay UNRESOLVED in AboutContent (and in the cache), so a
 * language switch re-resolves instantly without another request.
 *
 * ── What is deliberately NOT here ───────────────────────────────────────
 *   team, teamLabel, teamHeading
 *       The backend has TWO team sources — AboutContent.team (shown on the
 *       website About page) and the separate TeamMember collection (/api/team,
 *       Admin → Team). Rendering either here would pick a winner silently, so
 *       Team is left to its own shared-content phase.
 *   _id, __v, createdAt, updatedAt
 *       Database bookkeeping; never cached or shown.
 *
 * ── Rules taken from the website, not invented ──────────────────────────
 *   - stats and content blocks are ordered by `order`
 *   - `imagePosition: 'none'` means the block has no image
 *   - a stat with a blank label is NOT shown: the live document stores
 *     `{ sourceLang: 'en', en: '' }` for every label today, and the app will not
 *     make up captions for the figures
 *
 * Pure: no React, no network, no storage.
 */

export type AboutImagePosition = 'left' | 'right' | 'none';

export type AboutStat = {
  value: string;
  label: LocalizedContent | null;
  order: number;
};

export type AboutContentBlock = {
  heading: LocalizedContent | null;
  paragraphs: LocalizedContent[];
  /** '' when absent, unusable on a phone, or hidden by `imagePosition: 'none'`. */
  image: string;
  imagePosition: AboutImagePosition;
  order: number;
};

export type AboutContent = {
  heroLabel: LocalizedContent | null;
  heroHeading: LocalizedContent | null;
  heroSubtext: LocalizedContent | null;
  missionLabel: LocalizedContent | null;
  missionHeading: LocalizedContent | null;
  missionParagraph1: LocalizedContent | null;
  missionParagraph2: LocalizedContent | null;
  /** '' when absent or unusable. */
  missionImage: string;
  stats: AboutStat[];
  contentBlocks: AboutContentBlock[];
};

export type ResolvedAboutStat = { value: string; label: string };

export type ResolvedAboutBlock = {
  heading: string;
  paragraphs: string[];
  image: string;
  imagePosition: AboutImagePosition;
};

/** Everything a screen renders, for one language. Blank means "omit". */
export type ResolvedAbout = {
  heroLabel: string;
  heroHeading: string;
  heroSubtext: string;
  missionLabel: string;
  missionHeading: string;
  missionParagraphs: string[];
  missionImage: string;
  stats: ResolvedAboutStat[];
  contentBlocks: ResolvedAboutBlock[];
};

export type AboutPreview = {
  heading: string;
  body: string;
  image: string;
  stats: ResolvedAboutStat[];
};

const TEXT_FIELDS = [
  'heroLabel',
  'heroHeading',
  'heroSubtext',
  'missionLabel',
  'missionHeading',
  'missionParagraph1',
  'missionParagraph2',
] as const;

const IMAGE_POSITIONS: readonly AboutImagePosition[] = ['left', 'right', 'none'];

/** The Home preview shows at most this many figures, in one row. */
export const ABOUT_PREVIEW_MAX_STATS = 4;

const english = (text: string): LocalizedContent => ({ sourceLang: 'en', en: text });

/**
 * Shown only until the cached or live About content arrives, or when neither
 * exists (a first launch with no network).
 *
 * These are the AboutContent MODEL DEFAULTS (backend/models/AboutContent.js),
 * not new copy: a brand-new About document holds exactly this text. No image
 * and no stats, because the model has no default for either that the live
 * document actually uses. Once cache or server content exists, it wins.
 */
export const FALLBACK_ABOUT_CONTENT: AboutContent = {
  heroLabel: english('Our Story'),
  heroHeading: english('About Varlikent'),
  heroSubtext: english(
    "Istanbul's premier luxury real estate agency, connecting discerning buyers and renters with exceptional properties."
  ),
  missionLabel: english('Our Mission'),
  missionHeading: english('A refined approach to luxury real estate.'),
  missionParagraph1: english(
    "We bring together market insight, local expertise, and exceptional service to help buyers and sellers make confident, premium decisions across Istanbul's most desirable neighborhoods."
  ),
  missionParagraph2: english(
    "Founded with a passion for Istanbul's unique architectural heritage and its exciting modern developments, Varlikent has been a trusted partner for international investors, expatriates, and local families seeking their ideal property."
  ),
  missionImage: '',
  stats: [],
  contentBlocks: [],
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The website accepts video URLs here; the app has no video player, so they are omitted. */
const VIDEO_URL = /\/video\/|\.(mp4|mov|webm|avi|m4v)(?:[?#]|$)/i;

/**
 * An absolute http(s) image URL, or ''.
 *
 * Site-relative paths ('/images/…') point at the website's own bundle and do
 * not exist for the app, so they are treated as missing rather than broken.
 */
export function usableAboutImage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) return '';
  if (VIDEO_URL.test(url)) return '';
  return url;
}

const orderOf = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Stable sort by `order`, keeping the original position for ties. */
const byOrder = <T extends { order: number }>(items: (T & { index: number })[]): T[] =>
  items
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ index: _index, ...item }) => item as unknown as T);

function normalizeStats(value: unknown): AboutStat[] {
  if (!Array.isArray(value)) return [];

  const stats: (AboutStat & { index: number })[] = [];
  value.forEach((raw, index) => {
    if (!isPlainObject(raw)) return;
    const figure =
      typeof raw.value === 'string' ? raw.value.trim() : typeof raw.value === 'number' ? String(raw.value) : '';
    // A caption without a figure is not a statistic.
    if (!figure) return;
    stats.push({ value: figure, label: sanitizeLocalizedContent(raw.label), order: orderOf(raw.order, index), index });
  });
  return byOrder(stats);
}

function normalizeBlocks(value: unknown): AboutContentBlock[] {
  if (!Array.isArray(value)) return [];

  const blocks: (AboutContentBlock & { index: number })[] = [];
  value.forEach((raw, index) => {
    if (!isPlainObject(raw)) return;

    const imagePosition = IMAGE_POSITIONS.includes(raw.imagePosition as AboutImagePosition)
      ? (raw.imagePosition as AboutImagePosition)
      : 'right';
    const heading = sanitizeLocalizedContent(raw.heading);
    const paragraphs = Array.isArray(raw.paragraphs)
      ? raw.paragraphs.map(sanitizeLocalizedContent).filter((p): p is LocalizedContent => p !== null)
      : [];
    const image = imagePosition === 'none' ? '' : usableAboutImage(raw.image);

    // A block with nothing to show in any language is dropped here.
    if (!hasLocalizedContent(heading) && !paragraphs.some(hasLocalizedContent) && !image) return;

    blocks.push({ heading, paragraphs, image, imagePosition, order: orderOf(raw.order, index), index });
  });
  return byOrder(blocks);
}

/**
 * GET /api/about's body — or a cached AboutContent — made safe to render.
 *
 * Accepts `{ success, about }` or the about object itself. Returns null when
 * the payload is not an About document at all, or has no text in any
 * language, so callers keep what they already show instead of blanking it.
 */
export function normalizeAboutContent(payload: unknown): AboutContent | null {
  if (!isPlainObject(payload)) return null;

  const raw = 'about' in payload ? payload.about : payload;
  if (!isPlainObject(raw)) return null;

  const content: AboutContent = {
    heroLabel: sanitizeLocalizedContent(raw.heroLabel),
    heroHeading: sanitizeLocalizedContent(raw.heroHeading),
    heroSubtext: sanitizeLocalizedContent(raw.heroSubtext),
    missionLabel: sanitizeLocalizedContent(raw.missionLabel),
    missionHeading: sanitizeLocalizedContent(raw.missionHeading),
    missionParagraph1: sanitizeLocalizedContent(raw.missionParagraph1),
    missionParagraph2: sanitizeLocalizedContent(raw.missionParagraph2),
    missionImage: usableAboutImage(raw.missionImage),
    stats: normalizeStats(raw.stats),
    contentBlocks: normalizeBlocks(raw.contentBlocks),
  };

  const hasText = TEXT_FIELDS.some((field) => hasLocalizedContent(content[field])) || content.contentBlocks.length > 0;
  return hasText ? content : null;
}

/** Plain strings for one language. Blank fields, stats and paragraphs are removed. */
export function resolveAboutContent(content: AboutContent, language: string): ResolvedAbout {
  const text = (value: unknown) => resolveLocalizedContent(value, language);

  return {
    heroLabel: text(content.heroLabel),
    heroHeading: text(content.heroHeading),
    heroSubtext: text(content.heroSubtext),
    missionLabel: text(content.missionLabel),
    missionHeading: text(content.missionHeading),
    missionParagraphs: [text(content.missionParagraph1), text(content.missionParagraph2)].filter(Boolean),
    missionImage: content.missionImage,
    stats: content.stats
      .map((stat) => ({ value: stat.value, label: text(stat.label) }))
      // A figure with no caption in any language is omitted, never captioned by the app.
      .filter((stat) => stat.value !== '' && stat.label !== ''),
    contentBlocks: content.contentBlocks
      .map((block) => ({
        heading: text(block.heading),
        paragraphs: block.paragraphs.map(text).filter(Boolean),
        image: block.image,
        imagePosition: block.imagePosition,
      }))
      .filter((block) => block.heading !== '' || block.paragraphs.length > 0 || block.image !== ''),
  };
}

/**
 * The short Home version: one heading, one paragraph, the mission image and up
 * to four captioned figures. Null when there is nothing worth a section.
 */
export function selectAboutPreview(about: ResolvedAbout): AboutPreview | null {
  const heading = about.missionHeading || about.heroHeading;
  const body = about.heroSubtext || about.missionParagraphs[0] || '';
  if (!heading && !body) return null;

  return {
    heading,
    body,
    image: about.missionImage,
    stats: about.stats.slice(0, ABOUT_PREVIEW_MAX_STATS),
  };
}

/** True when the full screen has anything to show besides figures. */
export function hasAboutScreenContent(about: ResolvedAbout): boolean {
  return Boolean(
    about.heroHeading ||
      about.heroSubtext ||
      about.missionHeading ||
      about.missionParagraphs.length > 0 ||
      about.contentBlocks.length > 0
  );
}
