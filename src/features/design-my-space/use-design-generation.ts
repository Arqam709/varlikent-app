import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isActiveGenerationStatus,
  type DesignGeneration,
} from '@/features/design-my-space/design-generation';
import { fetchDesignGeneration } from '@/features/design-my-space/design-generation-api';
import { ApiError } from '@/services/api-client';

/**
 * WATCHING ONE VISUALIZATION until it finishes.
 *
 * The provider takes a while and reports no progress, so the app asks the
 * backend again on a widening interval instead of pretending to know how far
 * along it is. Polling is bounded in every direction:
 *
 *   stops when the generation reaches a terminal status (succeeded/failed)
 *   stops when the generation is gone (deleted elsewhere → 404)
 *   stops when the screen is not active (navigated away, app backgrounded)
 *   stops after GENERATION_POLL_TIMEOUT_MS, leaving a "still working" state
 *
 * Nothing here decides the status: it only reads what the backend says.
 */

/**
 * The gap before each check, widening as the wait grows: quick enough to feel
 * responsive on a fast generation, slow enough not to hammer the API on a slow
 * one. The last value repeats.
 */
export const GENERATION_POLL_INTERVALS_MS = [4000, 4000, 6000, 8000, 12000, 20000];

/** After this long the app stops asking; the user can refresh by hand. */
export const GENERATION_POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** How long to wait before check number `attempt` (0-based). Pure. */
export function nextGenerationPollDelay(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), GENERATION_POLL_INTERVALS_MS.length - 1);
  return GENERATION_POLL_INTERVALS_MS[index];
}

/** Whether another check is worth making. Pure, so the rule is testable. */
export function shouldPollGeneration(
  generation: Pick<DesignGeneration, 'status'> | null,
  { active, elapsedMs }: { active: boolean; elapsedMs: number }
): boolean {
  if (!active || !generation) return false;
  if (!isActiveGenerationStatus(generation.status)) return false;
  return elapsedMs < GENERATION_POLL_TIMEOUT_MS;
}

type Options = {
  token: string;
  /** The generation to watch, or null when there is none. */
  generation: DesignGeneration | null;
  /** False while the screen is not in front of the user. */
  active: boolean;
};

export type DesignGenerationWatch = {
  generation: DesignGeneration | null;
  /** True while a check is in flight — never a fabricated progress value. */
  checking: boolean;
  /** True once polling gave up on a still-unfinished generation. */
  timedOut: boolean;
  /** Set when the generation no longer exists for this account. */
  gone: boolean;
  /** Ask again now. */
  refresh: () => void;
};

export function useDesignGeneration({ token, generation, active }: Options): DesignGenerationWatch {
  const [current, setCurrent] = useState<DesignGeneration | null>(generation);
  const [checking, setChecking] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);

  /** A manual refresh restarts the schedule. */
  const [requestedAt, setRequestedAt] = useState(0);

  // Adopt a generation handed in from outside (a new request was just created).
  useEffect(() => {
    setCurrent(generation);
    setTimedOut(false);
    setGone(false);
  }, [generation]);

  const status = current?.status ?? null;
  const id = current?.id ?? null;
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [id, requestedAt]);

  useEffect(() => {
    if (!id || !status || !isActiveGenerationStatus(status) || !active) return;

    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      if (cancelled) return;
      setChecking(true);
      try {
        const next = await fetchDesignGeneration(token, id);
        if (cancelled) return;
        setCurrent(next);
        // A finished generation ends the loop; the effect will not restart
        // because the status is no longer an active one.
        if (!isActiveGenerationStatus(next.status)) return;
      } catch (error) {
        if (cancelled) return;
        // Deleted on another device, or expired: stop, and say so.
        if (error instanceof ApiError && error.status === 404) {
          setGone(true);
          return;
        }
        // A transient network error just means the next check happens later.
      } finally {
        if (!cancelled) setChecking(false);
      }

      if (cancelled) return;
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed >= GENERATION_POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      attempt += 1;
      timer = setTimeout(check, nextGenerationPollDelay(attempt));
    };

    timer = setTimeout(check, nextGenerationPollDelay(attempt));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, status, active, token, requestedAt]);

  const refresh = useCallback(() => {
    setTimedOut(false);
    setRequestedAt(Date.now());
  }, []);

  return { generation: current, checking, timedOut, gone, refresh };
}
