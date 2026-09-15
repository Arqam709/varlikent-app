import { useCallback, useEffect, useState } from 'react';

import { FALLBACK_ABOUT_CONTENT, type AboutContent } from '@/features/about/about-content';
import {
  peekAboutContent,
  refreshAboutContent,
  subscribeAboutContent,
  type AboutContentOrigin,
} from '@/features/about/about-repository';

export type AboutOrigin = AboutContentOrigin | 'fallback';

/**
 * `loading`  no server answer yet this mount
 * `ready`    server content is showing
 * `error`    the server did not answer; cached or bundled content is showing
 */
export type AboutStatus = 'loading' | 'ready' | 'error';

type AboutState = { content: AboutContent; origin: AboutOrigin; status: AboutStatus };

function initialState(): AboutState {
  const latest = peekAboutContent();
  if (latest) {
    return { content: latest.content, origin: latest.origin, status: latest.origin === 'server' ? 'ready' : 'loading' };
  }
  return { content: FALLBACK_ABOUT_CONTENT, origin: 'fallback', status: 'loading' };
}

/**
 * The About document for any screen that shows it.
 *
 * Renders IMMEDIATELY — from this session's newest content, or the bundled
 * model defaults — and upgrades in the background as cached and live content
 * arrive. Nothing about it ever blocks the screen that uses it.
 *
 * Content stays unresolved; callers resolve it for the current language with
 * `resolveAboutContent`, so switching language needs no refetch.
 */
export function useAboutContent() {
  const [state, setState] = useState<AboutState>(initialState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeAboutContent((entry) => {
      setState((prev) => ({
        content: entry.content,
        origin: entry.origin,
        status: entry.origin === 'server' ? 'ready' : prev.status,
      }));
    });

    refreshAboutContent().then((ok) => {
      if (!active || ok) return;
      setState((prev) => ({ ...prev, status: prev.origin === 'server' ? 'ready' : 'error' }));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading' }));
    setAttempt((count) => count + 1);
  }, []);

  return { ...state, retry };
}
