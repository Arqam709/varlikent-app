import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchContactInterests,
  normalizeContactInterests,
  type ContactInterest,
} from '@/features/contact/contact-interests';

/**
 * The last contact-interest list the server sent, kept on this device.
 *
 * ── Why this exists since Phase 1B ─────────────────────────────────────
 * Phase 1A deliberately had no cache: the list only changed with a backend
 * deploy, so the bundled copy was always current. Admins can now add, reorder
 * and disable interests at any moment, so the bundled copy is only a
 * baseline. Without a cache, every start on a slow network (the backend can
 * take tens of seconds to wake) or offline would show that baseline — missing
 * yesterday's new interest and still offering one that was disabled.
 *
 * ── Order of precedence ─────────────────────────────────────────────────
 *   bundled fallback  →  cached server list  →  fresh server list
 * Each step replaces the previous one only with a non-empty, normalized list,
 * and nothing waits: the screen renders the fallback immediately.
 *
 * ── Failure policy ──────────────────────────────────────────────────────
 * Same as preferences-storage.ts: a read that fails, or finds anything that
 * does not normalize to at least one valid interest, is treated as "no cache";
 * a failed write is ignored. A corrupt cache can never break the form, and the
 * next successful response overwrites it.
 *
 * Not a secret, so AsyncStorage rather than SecureStore.
 */

export const CONTACT_INTERESTS_CACHE_KEY = 'varlikent_contact_interests_v1';

export async function readCachedContactInterests(): Promise<ContactInterest[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CONTACT_INTERESTS_CACHE_KEY);
    if (!raw) return null;
    const interests = normalizeContactInterests(JSON.parse(raw));
    return interests.length > 0 ? interests : null;
  } catch {
    return null;
  }
}

export async function writeCachedContactInterests(interests: readonly ContactInterest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CONTACT_INTERESTS_CACHE_KEY, JSON.stringify({ interests }));
  } catch {
    // Ignored on purpose — see the failure policy above.
  }
}

export type ContactInterestsOrigin = 'cache' | 'server';

/**
 * Starts loading the cached and the live list in parallel and reports each
 * usable one. Returns a cancel function for an effect cleanup.
 *
 *   - the cached list is reported only if the server has not answered first,
 *     so a slow storage read can never overwrite fresher data
 *   - a server list is always written to the cache, even if the screen has
 *     already closed, so the next visit benefits
 *   - failures report nothing, leaving whatever the caller already shows
 */
export function refreshContactInterests(
  onInterests: (interests: ContactInterest[], origin: ContactInterestsOrigin) => void
): () => void {
  let active = true;
  let served = false;

  readCachedContactInterests().then((cached) => {
    if (active && cached && !served) onInterests(cached, 'cache');
  });

  fetchContactInterests().then((fresh) => {
    if (!fresh) return;
    served = true;
    void writeCachedContactInterests(fresh);
    if (active) onInterests(fresh, 'server');
  });

  return () => {
    active = false;
  };
}
