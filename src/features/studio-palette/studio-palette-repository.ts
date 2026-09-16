import {
  clearCachedStudioPalette,
  readCachedStudioPalette,
  writeCachedStudioPalette,
} from '@/features/studio-palette/studio-palette-cache';
import { fetchStudioPalette } from '@/features/studio-palette/studio-palette-api';
import { fallbackStudioPalette } from '@/features/studio-palette/studio-palette-fallback';
import type {
  StudioPalette,
  StudioPaletteKey,
  StudioPaletteResult,
} from '@/features/studio-palette/studio-palette';

/**
 * ONE palette source per page, shared by everything that reads it.
 *
 * The same shape as features/about/about-repository.ts, keyed by page:
 *
 *   - `latest` is the newest palette seen this session, so a screen that
 *     mounts later starts from it with no blank step.
 *   - Concurrent refreshes share ONE in-flight request per page.
 *   - Every mounted reader is told when a newer palette arrives.
 *
 * Precedence is bundled defaults → cached override → server, and it only moves
 * FORWARD: a cache read that finishes after the server has answered is
 * discarded, so slow storage can never overwrite fresher data.
 *
 * ── The reset case, which is the subtle one ─────────────────────────────
 * `palette: null` is a successful answer meaning "no override exists". It is
 * handled exactly like receiving a new palette — it publishes (the bundled
 * defaults) with origin 'server' — and additionally DELETES the cache entry.
 * Without that, a device would keep serving an override an owner had already
 * reset, indefinitely, because every later cache read would re-publish it.
 *
 * No React here; use-studio-palette.ts is the hook over it.
 */

export type StudioPaletteOrigin = 'cache' | 'server';

export type StudioPaletteEntry = {
  palette: StudioPalette;
  origin: StudioPaletteOrigin;
  /** False when `palette` is the bundled table rather than an owner's override. */
  isOverride: boolean;
};

const latest = new Map<StudioPaletteKey, StudioPaletteEntry>();
const inflight = new Map<StudioPaletteKey, Promise<StudioPaletteResult | null>>();
const applied = new Map<StudioPaletteKey, StudioPaletteResult>();
const listeners = new Map<StudioPaletteKey, Set<(entry: StudioPaletteEntry) => void>>();

function publish(key: StudioPaletteKey, entry: StudioPaletteEntry) {
  latest.set(key, entry);
  for (const listener of listeners.get(key) ?? []) listener(entry);
}

/** The newest palette seen this session for one page, if any. */
export function peekStudioPalette(key: StudioPaletteKey): StudioPaletteEntry | null {
  return latest.get(key) ?? null;
}

/** Called with every newer palette for one page. Returns the unsubscribe function. */
export function subscribeStudioPalette(
  key: StudioPaletteKey,
  listener: (entry: StudioPaletteEntry) => void
): () => void {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

function loadFromServer(key: StudioPaletteKey): Promise<StudioPaletteResult | null> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = fetchStudioPalette(key).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, request);
  return request;
}

/**
 * Loads the cached override (once per page per session) and the live palette in
 * parallel, publishing each usable result.
 *
 * Resolves `true` when the server answered — INCLUDING when it answered that
 * no override exists — and `false` when it did not answer usefully. Never
 * rejects.
 */
export function refreshStudioPalette(key: StudioPaletteKey): Promise<boolean> {
  if (!latest.has(key)) {
    void readCachedStudioPalette(key).then((cached) => {
      // The server may have answered while storage was being read.
      if (cached && latest.get(key)?.origin !== 'server') {
        publish(key, { palette: cached, origin: 'cache', isOverride: true });
      }
    });
  }

  return loadFromServer(key).then((result) => {
    if (!result) return false;

    // Two callers sharing one request publish and write it once.
    if (applied.get(key) === result) return true;
    applied.set(key, result);

    if (result.kind === 'defaults') {
      publish(key, { palette: fallbackStudioPalette(key), origin: 'server', isOverride: false });
      void clearCachedStudioPalette(key);
      return true;
    }

    publish(key, { palette: result.palette, origin: 'server', isOverride: true });
    void writeCachedStudioPalette(key, result.palette);
    return true;
  });
}

/** Test seam: forget this session's palettes, requests and subscribers. */
export function resetStudioPaletteMemory(): void {
  latest.clear();
  inflight.clear();
  applied.clear();
  listeners.clear();
}
