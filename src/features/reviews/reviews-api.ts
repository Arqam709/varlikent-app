import { normalizeReviews, type Review } from '@/features/reviews/reviews';
import { apiRequest } from '@/services/api-client';

/**
 * The request for this session, shared by every caller.
 *
 * Reviews change when an admin edits them, not while someone is using the app,
 * so one request per launch is enough. Sharing the promise also means a Home
 * screen that remounts (a language switch, a theme switch) never refetches.
 *
 * A FAILED request is not kept, so the next mount tries again rather than
 * showing nothing for the rest of the session.
 */
let pending: Promise<Review[]> | null = null;

/**
 * GET /api/reviews → the visible client reviews, normalized.
 *
 * Never throws: a network failure, a server error and an empty list all
 * resolve to `[]`, which the Home section treats as "render nothing".
 */
export function fetchReviews(): Promise<Review[]> {
  if (!pending) {
    pending = apiRequest<unknown>('/reviews')
      .then((body) => normalizeReviews(body))
      .catch(() => {
        pending = null;
        return [];
      });
  }
  return pending;
}
