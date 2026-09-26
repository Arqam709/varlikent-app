export type Review = {
  id: string;
  name: string;
  /** The client's role or company line, e.g. "Investment Executive". May be ''. */
  role: string;
  text: string;
  /** Whole stars, 1–5. */
  rating: number;
  /** An absolute http(s) URL, or '' — the card then shows the name's initial. */
  avatar: string;
};

/**
 * How many reviews Home shows.
 *
 * The website shows three in a grid. A swipeable row can carry a few more
 * without adding height, but past six it stops being a preview.
 */
export const HOME_REVIEW_LIMIT = 6;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Rounded and clamped to 1–5; anything unusable is the schema default, 5. */
function usableRating(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 5;
  return Math.min(5, Math.max(1, Math.round(value)));
}

/** The same rule About images follow: absolute http(s) or nothing. */
function usableAvatar(value: unknown): string {
  const url = text(value);
  return /^https?:\/\/\S+$/i.test(url) ? url : '';
}

export function normalizeReviews(payload: unknown, limit = HOME_REVIEW_LIMIT): Review[] {
  const list = (payload as { reviews?: unknown } | null)?.reviews;
  if (!Array.isArray(list)) return [];

  const reviews: Review[] = [];

  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const raw = entry as Record<string, unknown>;

    const name = text(raw.name);
    const body = text(raw.text);
    if (!name || !body) return;

    reviews.push({
      id: text(raw._id) || `review-${index}`,
      name,
      role: text(raw.role),
      text: body,
      rating: usableRating(raw.rating),
      avatar: usableAvatar(raw.avatar),
    });
  });

  //only return the first six reviews, as the website only shows that many in a grid. A swipeable row can carry a few more without adding height, but past six it stops being a preview.
  return reviews.slice(0, Math.max(0, limit));
}

/** The letter shown when a review has no avatar. */
export function reviewInitial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';
}
