import { useCallback, useEffect, useState } from 'react';

import { fallbackStudioPalette } from '@/features/studio-palette/studio-palette-fallback';
import {
  peekStudioPalette,
  refreshStudioPalette,
  subscribeStudioPalette,
  type StudioPaletteOrigin,
} from '@/features/studio-palette/studio-palette-repository';
import type { StudioPalette, StudioPaletteKey } from '@/features/studio-palette/studio-palette';

export type PaletteOrigin = StudioPaletteOrigin | 'fallback';

/**
 * `loading`  no server answer yet this mount
 * `ready`    the server has answered (with an override, or with "none exists")
 * `error`    the server did not answer; cached or bundled colours are showing
 */
export type PaletteStatus = 'loading' | 'ready' | 'error';

type PaletteState = {
  palette: StudioPalette;
  origin: PaletteOrigin;
  status: PaletteStatus;
};

function initialState(key: StudioPaletteKey): PaletteState {
  const entry = peekStudioPalette(key);
  if (entry) {
    return {
      palette: entry.palette,
      origin: entry.origin,
      status: entry.origin === 'server' ? 'ready' : 'loading',
    };
  }
  return { palette: fallbackStudioPalette(key), origin: 'fallback', status: 'loading' };
}

/**
 * The admin-managed palette for one page.
 *
 * Renders IMMEDIATELY — from this session's newest palette, or the bundled
 * defaults — and upgrades in the background as the cached and live palettes
 * arrive. It never blocks the screen: Design My Space stays usable offline,
 * on a cold install, and while the request is in flight.
 *
 * Fetched only by screens that actually need swatches, which is why Home and
 * the service pages do not call this.
 */
export function useStudioPalette(key: StudioPaletteKey) {
  const [state, setState] = useState<PaletteState>(() => initialState(key));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState(initialState(key));

    const unsubscribe = subscribeStudioPalette(key, (entry) => {
      setState((prev) => ({
        palette: entry.palette,
        origin: entry.origin,
        status: entry.origin === 'server' ? 'ready' : prev.status,
      }));
    });

    refreshStudioPalette(key).then((answered) => {
      if (!active || answered) return;
      setState((prev) => ({ ...prev, status: prev.origin === 'server' ? 'ready' : 'error' }));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, attempt]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading' }));
    setAttempt((count) => count + 1);
  }, []);

  return { ...state, retry };
}
