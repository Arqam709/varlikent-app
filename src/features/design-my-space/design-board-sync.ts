import {
  deleteAccountDesignBoard,
  fetchAccountDesignBoards,
  saveAccountDesignBoard,
} from '@/features/design-my-space/design-board-api';
import type { DesignBoard } from '@/features/design-my-space/design-board';
import {
  clearCachedAccountBoards,
  readCachedAccountBoards,
  updateCachedAccountBoards,
  writeCachedAccountBoards,
} from '@/features/design-my-space/design-board-cache';
import type { AuthStatus } from '@/features/auth/auth-context';
import { ApiError } from '@/services/api-client';

/**
 * DESIGN BOARDS FOR A SIGNED-IN USER — the one place that decides how.
 *
 * Design My Space is an account feature. Every board belongs to the signed-in
 * user and lives on the server (design-board-api.ts), with a per-user cache
 * (design-board-cache.ts) so the list appears instantly and survives being
 * offline. There is no signed-out mode: `designMySpaceAccess` is what the
 * screen asks before rendering anything.
 *
 * The screen asks this module and never calls storage or HTTP itself.
 *
 * ── Sync rules (V1, deliberately simple) ────────────────────────────────
 *   Load    cached boards first, then the server. A server answer replaces
 *           the list and the cache; a failed request leaves the cached list
 *           showing and says so (`origin: 'cache'`, `failed: true`).
 *   Save    goes to the server. Only the server's response is shown or
 *           cached. A failed request returns null — nothing is written
 *           locally and nothing is queued for later.
 *   Delete  the same: gone locally only once the server confirms. A 404 means
 *           it is already gone (deleted on another device), which counts.
 *
 * ── Boards from the old signed-out version ──────────────────────────────
 * Earlier builds let signed-out visitors keep boards on the device under
 * `varlikent_design_boards_v1`. Nothing reads, writes, uploads or deletes that
 * entry now: the app cannot know whether the person signing in made those
 * boards. It stays on the phone, unreachable, so a future explicit "Save these
 * designs to your account" flow can still read it (its records are
 * `normalizeDesignBoard`-compatible) and upload each one with
 * `saveAccountDesignBoard` — the device id travels as `clientId`, so repeating
 * that import can never duplicate a board.
 */

/** Whose boards: always a signed-in account. */
export type DesignBoardOwner = { userId: string; token: string };

/**
 * `cache`   this account's last known server list — NOT confirmed this time
 * `server`  confirmed by the server just now
 */
export type DesignBoardsOrigin = 'cache' | 'server';

export type DesignBoardsLoad = {
  boards: DesignBoard[];
  origin: DesignBoardsOrigin;
  /** True when the server was asked and did not answer usefully. */
  failed: boolean;
};

/**
 * `restoring`  the stored session is still being checked — neither signed in
 *              nor signed out yet, so nothing is shown and nothing is gated
 * `signed-out` show the sign-in gate; no board can be read or written
 * `signed-in`  the boards of exactly this account
 */
export type DesignMySpaceAccess =
  | { state: 'restoring' }
  | { state: 'signed-out' }
  | { state: 'signed-in'; owner: DesignBoardOwner };

export function designMySpaceAccess(
  status: AuthStatus,
  userId: string | null | undefined,
  token: string | null | undefined
): DesignMySpaceAccess {
  if (status === 'loading') return { state: 'restoring' };
  if (status === 'authenticated' && userId && token) {
    return { state: 'signed-in', owner: { userId, token } };
  }
  return { state: 'signed-out' };
}

/** Newest activity first — the order the Saved Designs list shows. */
export function sortDesignBoards(boards: readonly DesignBoard[]): DesignBoard[] {
  return [...boards].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/**
 * A list with one confirmed save applied. `previousId` is the board's id
 * before the save, which differs from `saved.id` on a first save (new board
 * id → server id).
 */
export function withSavedDesignBoard(
  boards: readonly DesignBoard[],
  saved: DesignBoard,
  previousId: string = saved.id
): DesignBoard[] {
  return sortDesignBoards([
    saved,
    ...boards.filter((board) => board.id !== saved.id && board.id !== previousId),
  ]);
}

/**
 * This account's boards.
 *
 * `onCached` receives the cached list as soon as it is read (even when empty),
 * before the network answers. Never rejects.
 */
export async function loadDesignBoards(
  owner: DesignBoardOwner,
  onCached?: (boards: DesignBoard[]) => void
): Promise<DesignBoardsLoad> {
  const cached = sortDesignBoards(await readCachedAccountBoards(owner.userId));
  onCached?.(cached);

  try {
    const boards = sortDesignBoards(await fetchAccountDesignBoards(owner.token));
    await writeCachedAccountBoards(owner.userId, boards);
    return { boards, origin: 'server', failed: false };
  } catch {
    return { boards: cached, origin: 'cache', failed: true };
  }
}

/**
 * Why a save failed, as a translation key.
 *
 * One "check your connection" message for every failure is actively
 * misleading. A request that REACHED the server and was refused — an expired
 * session, a backend deployment without this endpoint, a server error — has
 * nothing to do with the connection, and saying so hides the real problem.
 */
export function designBoardSaveErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    // 401/403: the session, not the network.
    if (error.kind === 'auth') return 'designMySpace.saveFailedSession';
    // The request never got a response. This one really is the connection.
    if (error.kind === 'network' || error.kind === 'timeout') return 'designMySpace.saveFailed';
  }
  // Everything else — a 404 from a backend that does not have this endpoint,
  // a 5xx, an unreadable body — is the server, not the phone.
  return 'designMySpace.saveFailedServer';
}

/**
 * A short, safe line for the development console: never the token, the board,
 * the response body or anything personal.
 */
function reportBoardFailure(action: string, error: unknown): void {
  // `__DEV__` is a React Native global; guard its EXISTENCE too, so this can
  // never throw in an environment that does not define it (tests, tooling).
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const detail = error instanceof ApiError
    ? [error.kind, error.status, error.code, error.message].filter(Boolean).join(' · ')
    : 'non-API error';
  console.warn(`[design-boards] ${action} failed — ${detail}`);
}

/**
 * Saves one board to the account. Returns the server's copy — with the
 * server's id and timestamps — or `null` when it was not saved.
 *
 * `onError` receives the reason, so the screen can say what actually went
 * wrong instead of guessing.
 */
export async function saveDesignBoardFor(
  owner: DesignBoardOwner,
  board: DesignBoard,
  { onError }: { onError?: (error: unknown) => void } = {}
): Promise<DesignBoard | null> {
  let saved: DesignBoard;
  try {
    saved = await saveAccountDesignBoard(owner.token, board);
  } catch (error) {
    reportBoardFailure('save', error);
    onError?.(error);
    return null;
  }

  await updateCachedAccountBoards(owner.userId, (boards) => withSavedDesignBoard(boards, saved, board.id));
  return saved;
}

/** Deletes one board from the account. `true` once it is gone. */
export async function deleteDesignBoardFor(
  owner: DesignBoardOwner,
  id: string,
  { onError }: { onError?: (error: unknown) => void } = {}
): Promise<boolean> {
  try {
    await deleteAccountDesignBoard(owner.token, id);
  } catch (error) {
    // Already gone from the account (e.g. deleted on another device) is the
    // outcome the user asked for. Anything else is a real failure.
    if (!(error instanceof ApiError && error.status === 404)) {
      reportBoardFailure('delete', error);
      onError?.(error);
      return false;
    }
  }

  await updateCachedAccountBoards(owner.userId, (boards) => boards.filter((board) => board.id !== id));
  return true;
}

/** Removes a signed-out account's cached boards from this device. */
export function forgetAccountDesignBoards(userId: string): Promise<void> {
  return clearCachedAccountBoards(userId);
}
