import { fetchAboutContent } from '@/features/about/about-api';
import { readCachedAboutContent, writeCachedAboutContent } from '@/features/about/about-cache';
import type { AboutContent } from '@/features/about/about-content';

/**
 * ONE About source for the whole app.
 *
 * The Home preview and the /about screen both read through here, so there is
 * a single fetch, a single cache and a single in-memory copy rather than two
 * screens each keeping their own:
 *
 *   - `latest` is the newest document seen this session. A screen that mounts
 *     later (tapping Learn More) starts from it, with no blank frame.
 *   - Concurrent refreshes share one in-flight request.
 *   - Every mounted reader is told when newer content arrives.
 *
 * Precedence is bundled fallback → cached → server, and it only moves forward:
 * a cache read that finishes after server content has arrived is discarded,
 * so slow storage can never overwrite fresher data.
 *
 * No React here; use-about-content.ts is the hook over it. Not a global
 * Context: this is the only state it holds, and nothing else needs to share it.
 */

export type AboutContentOrigin = 'cache' | 'server';

export type AboutContentEntry = { content: AboutContent; origin: AboutContentOrigin };

let latest: AboutContentEntry | null = null;
let inflight: Promise<AboutContent | null> | null = null;
const listeners = new Set<(entry: AboutContentEntry) => void>();

function publish(entry: AboutContentEntry) {
  latest = entry;
  for (const listener of listeners) listener(entry);
}

/** The newest content seen this session, if any. */
export function peekAboutContent(): AboutContentEntry | null {
  return latest;
}

/** Called with every newer document. Returns the unsubscribe function. */
export function subscribeAboutContent(listener: (entry: AboutContentEntry) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function loadFromServer(): Promise<AboutContent | null> {
  if (!inflight) {
    inflight = fetchAboutContent().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * Loads the cached copy (once per session) and the live one in parallel,
 * publishing each usable result. Resolves `true` when the server answered with
 * usable content, `false` otherwise. Never rejects.
 */
export function refreshAboutContent(): Promise<boolean> {
  if (latest === null) {
    void readCachedAboutContent().then((cached) => {
      // Server content may have arrived while storage was being read.
      if (cached && latest?.origin !== 'server') publish({ content: cached, origin: 'cache' });
    });
  }

  return loadFromServer().then((fresh) => {
    if (!fresh) return false;
    // Two callers sharing one request publish and write it once.
    if (latest?.content !== fresh) {
      publish({ content: fresh, origin: 'server' });
      void writeCachedAboutContent(fresh);
    }
    return true;
  });
}

/** Test seam: forget the session's memory and any in-flight request. */
export function resetAboutContentMemory(): void {
  latest = null;
  inflight = null;
  listeners.clear();
}
