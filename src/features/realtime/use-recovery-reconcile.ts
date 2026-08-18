import { useEffect, useRef } from 'react';

/**
 * Runs `reconcile` once per missed-events signal, and never on the first connect.
 *
 * ── Why this is centralised ─────────────────────────────────────────────
 * Both the Chats inbox and the open thread need to reconcile after a reconnect
 * or a foreground, and each would otherwise hand-roll the same three details:
 * skip version 0, do not stack concurrent runs, and do not lose a signal that
 * arrived mid-run. Getting any of them wrong stays invisible until a flaky
 * network or a busy app-switcher produces a burst of duplicate requests.
 *
 * ── Signal storms ───────────────────────────────────────────────────────
 * A bad connection produces connect/disconnect/connect in seconds, and a user
 * flicking through the app switcher produces active/inactive/active just as
 * fast — and a wake that also reconnects bumps the counter twice by itself.
 * Rather than firing a request per signal, an in-flight run absorbs later ones
 * into a single pending re-run, so N rapid signals cost at most two
 * reconciliations and the last one always reflects the final state.
 *
 * Completion-driven rather than debounced: no timers, so nothing can fire after
 * the screen has gone.
 *
 * `reconcile` must be a stable useCallback and should swallow its own errors —
 * a failed reconciliation must leave the existing UI intact, never blank it.
 */
export function useRecoveryReconcile(recoveryVersion: number, reconcile: () => Promise<void>) {
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    // 0 means "first connect": every screen has just loaded through REST, so
    // there is nothing to catch up on and reconciling would only duplicate work.
    if (!recoveryVersion) return undefined;

    let cancelled = false;

    const run = async () => {
      if (inFlightRef.current) {
        pendingRef.current = true;
        return;
      }

      inFlightRef.current = true;
      try {
        await reconcile();
      } catch {
        // Deliberately ignored. Reconciliation is best-effort; existing state
        // stays on screen and the next signal or pull-to-refresh tries again.
      } finally {
        inFlightRef.current = false;

        if (pendingRef.current && !cancelled) {
          pendingRef.current = false;
          run();
        }
      }
    };

    run();

    return () => {
      // Stops a queued re-run from firing after unmount or sign-out.
      cancelled = true;
      pendingRef.current = false;
    };
  }, [recoveryVersion, reconcile]);
}
