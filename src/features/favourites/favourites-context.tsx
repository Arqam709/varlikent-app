import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { addFavourite, removeFavourite } from './favourites-api';

/**
 * FAVOURITES — one in-memory Set, shared by every screen.
 *
 * Exists so the heart on a Home card, a Properties card, the detail screen and
 * the future Favourites screen can never disagree. Screen-local state cannot
 * do that: navigating back from a detail screen would show whatever the list
 * believed before the toggle.
 *
 * ── Where the initial state comes from ───────────────────────────────────
 * NOT from a network call. `/auth/me`, `/auth/login`, `/auth/register` and
 * `/auth/google` all return the user's `favourites` array, and `sanitizeUser`
 * already copies it onto `SafeUser`. So the ids are in AuthContext before this
 * provider mounts, and seeding from them means hearts are correct on the very
 * first paint with no request at all.
 *
 * `GET /users/favourites` is therefore reserved for the Favourites SCREEN,
 * which needs the populated property documents rather than the ids.
 *
 * ── What is deliberately not here ────────────────────────────────────────
 * No AsyncStorage or SecureStore copy. Mongo `User.favourites` is the durable
 * source of truth, shared with the website; a second cached copy could only
 * ever drift from it. And no navigation — an unauthenticated toggle reports
 * that fact back to the caller instead of importing the router, so this file
 * stays state-and-network only.
 *
 * ── Two sources of truth, on purpose ─────────────────────────────────────
 * Every mutation goes through `commitFavourites` / `commitBusy`, which write a
 * ref AND the matching state in one step. The refs are what the async toggle
 * reads; the state is what React renders. They cannot drift because nothing
 * writes one without the other. See the concurrency notes on `toggleFavourite`
 * for why the ref has to be authoritative rather than mirrored during render.
 */

/**
 * What a toggle attempt did.
 *
 * Non-error outcomes are RESULTS, not exceptions, the same way a cancelled
 * Google sign-in is. Only genuine failures throw, so a caller that wants to
 * send someone to the login screen does not have to do it from a catch block.
 */
export type ToggleFavouriteOutcome =
  /** The property is now saved. */
  | 'added'
  /** The property is no longer saved. */
  | 'removed'
  /** Nobody is signed in. The caller decides what to do about it. */
  | 'unauthenticated'
  /** A request for this same property is already in flight; the tap was ignored. */
  | 'busy';

/**
 * What the id Set looked like when a server read began.
 *
 * Opaque on purpose: the caller cannot construct or edit one, it can only pass
 * back what `snapshotFavourites()` gave it. That is what lets reconciliation
 * trust the base it is handed.
 */
export type FavouritesSnapshot = {
  readonly base: Set<string>;
  readonly generation: number;
};

type FavouritesContextValue = {
  /** Every saved property id, normalised to strings. */
  favouriteIds: Set<string>;
  isFavourite: (propertyId: string) => boolean;
  /** True while this specific property has a request in flight. */
  isFavouriteBusy: (propertyId: string) => boolean;
  /**
   * Adds or removes, optimistically.
   *
   * @throws {ApiError} when the backend rejects the change. The optimistic
   *   update is rolled back first, so state always matches the server.
   */
  toggleFavourite: (propertyId: string) => Promise<ToggleFavouriteOutcome>;
  /**
   * Records the current ids and session, to be handed back after a server read.
   * Must be called BEFORE the request, so the base predates anything the user
   * changes while it is in flight.
   */
  snapshotFavourites: () => FavouritesSnapshot;
  /**
   * Adopts an authoritative `GET /users/favourites` result.
   *
   * @returns true when it was applied; false when the snapshot belonged to a
   *   previous account/session and was therefore ignored.
   */
  reconcileFromServer: (snapshot: FavouritesSnapshot, serverIds: readonly unknown[]) => boolean;
};

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

/**
 * Builds the id Set from whatever the server sent.
 *
 * Mongo ObjectIds arrive as strings over JSON, but the array can also hold
 * nulls, and an id compared as a non-string would never match a card's
 * `property._id`. Normalising once here is what lets every lookup be a plain
 * `Set.has`.
 */
function toIdSet(rawFavourites: readonly unknown[] | undefined): Set<string> {
  if (!Array.isArray(rawFavourites)) return new Set();
  return new Set(rawFavourites.filter(Boolean).map((id) => String(id)));
}

/** Immutable Set edits, so React always sees a new reference and re-renders. */
const withId = (source: Set<string>, id: string) => new Set(source).add(id);

const withoutId = (source: Set<string>, id: string) => {
  const next = new Set(source);
  next.delete(id);
  return next;
};

export function FavouritesProvider({ children }: { children: React.ReactNode }) {
  const { user, token, status } = useAuth();

  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => toIdSet(user?.favourites));
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());

  /**
   * The authoritative copies, updated synchronously.
   *
   * NOT mirrored from state during render. That distinction is the entire
   * point: `setBusyIds` only SCHEDULES an update, so a ref refreshed at render
   * time still holds the pre-tap value when a second tap arrives in the same
   * batch. Both taps would then read an empty busy set and both would fire a
   * request. Writing the ref inside the commit helpers closes that window,
   * because the guard and the write happen in the same synchronous step.
   */
  const favouritesRef = useRef(favouriteIds);
  const busyRef = useRef(busyIds);

  /** Auth is read at tap time; mirroring it per render is correct and enough. */
  const authRef = useRef({ token, status });
  authRef.current = { token, status };

  /**
   * Identifies the account/session a request was started under.
   *
   * Incremented on every account change, which orphans everything already in
   * flight. An orphaned request can still complete — we cannot recall a POST
   * the server has already received — but it must not touch the new session's
   * React state. The durable truth for the new session comes from Mongo via
   * `user.favourites`, not from a stale response.
   */
  const sessionRef = useRef(0);

  /**
   * Which account the Set was last seeded for.
   *
   * This is why an unrelated auth render cannot clobber a local toggle.
   * AuthContext hands out a NEW user object on every `applyUser` — which the
   * account screens call after a profile, avatar or theme save — so an effect
   * keyed on `user` alone would re-run and overwrite the Set with whatever
   * `favourites` that unrelated response happened to carry. If a toggle were
   * mid-flight, that response could easily predate our write.
   *
   * Keying the effect on `user` keeps the lint rule honest about what it reads,
   * while this guard makes the body a no-op unless the ACCOUNT actually
   * changed.
   */
  const seededAccountRef = useRef<string | null>(user?._id ?? null);

  /** Writes the ref and the state together, so they can never disagree. */
  const commitFavourites = useCallback((next: Set<string>) => {
    favouritesRef.current = next;
    setFavouriteIds(next);
  }, []);

  const commitBusy = useCallback((next: Set<string>) => {
    busyRef.current = next;
    setBusyIds(next);
  }, []);

  useEffect(() => {
    const accountId = user?._id ?? null;

    // Same account (or still nobody): leave local state exactly as it is.
    if (seededAccountRef.current === accountId) return;

    seededAccountRef.current = accountId;

    // Everything currently in flight belongs to the outgoing session. Bumping
    // the generation is what makes their late completions no-ops.
    sessionRef.current += 1;

    // Covers all three transitions with one assignment: signing in seeds from
    // the account, switching accounts replaces the previous user's ids, and
    // logging out leaves `user` null so `toIdSet` yields an empty Set.
    commitFavourites(toIdSet(user?.favourites));

    // Cleared through the same helper, so `busyRef` is emptied too and the new
    // session can immediately toggle a property the old one was still busy on.
    commitBusy(new Set());
  }, [user, commitFavourites, commitBusy]);

  const isFavourite = useCallback(
    (propertyId: string) => favouriteIds.has(String(propertyId)),
    [favouriteIds]
  );

  const isFavouriteBusy = useCallback(
    (propertyId: string) => busyIds.has(String(propertyId)),
    [busyIds]
  );

  /**
   * `toggleFavourite` keeps a stable identity across renders.
   *
   * To be clear about what that does and does not buy: it does NOT stop
   * consumers re-rendering on a toggle. Every consumer of this context
   * re-renders whenever the context value changes, and it changes on every
   * toggle because `favouriteIds` is a new Set. What a stable callback does
   * give is a safe dependency for a child's `useEffect` or `useCallback`, and
   * a prop that does not defeat `React.memo` on its own.
   */
  const toggleFavourite = useCallback(
    async (propertyId: string): Promise<ToggleFavouriteOutcome> => {
      const id = String(propertyId);
      const { token: currentToken, status: currentStatus } = authRef.current;

      // Checked before any optimistic change, so a signed-out tap leaves the
      // UI exactly as it was. Navigation is the caller's job.
      if (currentStatus !== 'authenticated' || !currentToken) return 'unauthenticated';

      // Synchronously authoritative: `commitBusy` below writes `busyRef` before
      // this function yields, so a second tap in the same batch sees the id
      // already present and stops here. Per-property, so a different property
      // is unaffected.
      if (busyRef.current.has(id)) return 'busy';

      // Snapshot the session this request belongs to.
      const generation = sessionRef.current;
      const wasFavourite = favouritesRef.current.has(id);

      // ── Optimistic ────────────────────────────────────────────────────
      // Safe specifically because both endpoints are idempotent: `$addToSet`
      // cannot duplicate and `$pull` cannot fail on an absent id, so a retry
      // or a racing duplicate can never corrupt the server's array.
      commitFavourites(
        wasFavourite ? withoutId(favouritesRef.current, id) : withId(favouritesRef.current, id)
      );
      commitBusy(withId(busyRef.current, id));

      try {
        if (wasFavourite) {
          await removeFavourite(currentToken, id);
        } else {
          await addFavourite(currentToken, id);
        }

        return wasFavourite ? 'removed' : 'added';
      } catch (error) {
        /**
         * Roll back only if this request still owns the session.
         *
         * Without the guard, a failed sign-out-era request would write its old
         * value into a logged-out or different account's Set — restoring a
         * favourite that belongs to somebody else. The error still propagates:
         * the caller that started it can report it, and if that screen is gone
         * nobody is listening anyway.
         */
        if (sessionRef.current === generation) {
          commitFavourites(
            wasFavourite ? withId(favouritesRef.current, id) : withoutId(favouritesRef.current, id)
          );
        }

        throw error;
      } finally {
        /**
         * Same ownership test, for a subtler reason. After an account switch
         * the new session may have started its OWN request for this same
         * property. An unguarded clear here would wipe that new request's busy
         * flag, unlocking a control that is still waiting on the network.
         */
        if (sessionRef.current === generation) {
          commitBusy(withoutId(busyRef.current, id));
        }
      }
    },
    [commitFavourites, commitBusy]
  );

  const snapshotFavourites = useCallback(
    (): FavouritesSnapshot => ({
      // The ref, not the state, so the base is exactly what is true at call
      // time even if a toggle in the same batch has not rendered yet.
      base: favouritesRef.current,
      generation: sessionRef.current,
    }),
    []
  );

  /**
   * Merges an authoritative server snapshot with anything that changed locally
   * while the request was in flight.
   *
   * ── Why a plain replace would be wrong ───────────────────────────────
   * `GET /users/favourites` describes the account at the moment the server
   * answered it, which may be older than what the user has since done on the
   * phone. Overwriting with it would silently undo a favourite added mid-flight
   * — the exact class of async state race Phase 7B.1 removed from this file,
   * and it must not come back through reconciliation.
   *
   * ── The rule ──────────────────────────────────────────────────────────
   * Start from the server's answer, then re-apply every id whose membership
   * changed locally since the snapshot. Those ids are precisely the symmetric
   * difference of base and current, and for each of them the LOCAL value wins,
   * because a local change is newer than the response.
   *
   * Remote and local edits to DIFFERENT properties therefore both survive: the
   * server decides every id nobody touched locally, and the device decides the
   * handful it did.
   */
  const reconcileFromServer = useCallback(
    (snapshot: FavouritesSnapshot, serverIds: readonly unknown[]): boolean => {
      // A read that began under a different account must never write to this
      // one. Same generation test the toggle uses, for the same reason.
      if (snapshot.generation !== sessionRef.current) return false;

      const server = toIdSet(serverIds);
      const current = favouritesRef.current;
      const { base } = snapshot;

      const next = new Set(server);

      // Ids whose local membership moved since the read started.
      for (const id of base) {
        if (!current.has(id)) next.delete(id); // removed locally → stay removed
      }
      for (const id of current) {
        if (!base.has(id)) next.add(id); // added locally → stay added
      }

      commitFavourites(next);
      return true;
    },
    [commitFavourites]
  );

  const value = useMemo<FavouritesContextValue>(
    () => ({
      favouriteIds,
      isFavourite,
      isFavouriteBusy,
      toggleFavourite,
      snapshotFavourites,
      reconcileFromServer,
    }),
    [
      favouriteIds,
      isFavourite,
      isFavouriteBusy,
      toggleFavourite,
      snapshotFavourites,
      reconcileFromServer,
    ]
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

/** Reads the favourites state. Throws if used outside FavouritesProvider. */
export function useFavourites(): FavouritesContextValue {
  const context = useContext(FavouritesContext);
  if (!context) {
    throw new Error('useFavourites must be used within a FavouritesProvider');
  }
  return context;
}
