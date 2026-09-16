import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeDesignBoard, type DesignBoard } from '@/features/design-my-space/design-board';

/**
 * SAVED DESIGN BOARDS — this device, this app, no account required.
 *
 * ── Why local storage and not the backend ───────────────────────────────
 * There is no DesignBoard collection, and this MVP deliberately does not add
 * one. A board is a personal exploration tool: it must work for a signed-out
 * visitor, offline, and before anyone has decided they want to talk to
 * Varlikent. AsyncStorage gives all three for free. What it does not give is
 * sync between devices — an accepted limitation until boards are worth a
 * server-side model, at which point local boards can be uploaded on sign-in.
 *
 * ── Read policy ─────────────────────────────────────────────────────────
 * Every record is validated on read. An unreadable store, an entry written by
 * a future version, and a corrupted record all resolve to "that record does
 * not exist" — never to a thrown error on a screen the user is looking at.
 *
 * ── Write policy ────────────────────────────────────────────────────────
 * Saving is read-modify-write on one key, so concurrent saves are serialized
 * through `queue`. Without it, saving two boards in quick succession could
 * interleave and lose one.
 */

export const DESIGN_BOARDS_KEY = 'varlikent_design_boards_v1';

/** Newest activity first — what the Saved Designs list shows. */
function byRecency(a: DesignBoard, b: DesignBoard): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

async function readAll(): Promise<DesignBoard[]> {
  try {
    const raw = await AsyncStorage.getItem(DESIGN_BOARDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const boards: DesignBoard[] = [];
    for (const entry of parsed) {
      const board = normalizeDesignBoard(entry);
      // A duplicate id can only come from a damaged store; the first wins.
      if (board && !boards.some((kept) => kept.id === board.id)) boards.push(board);
    }
    return boards;
  } catch {
    return [];
  }
}

/** Serializes writes so two saves cannot read the same list and overwrite each other. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  // Keeps the chain alive after a rejection without swallowing it for the caller.
  queue = result.catch(() => undefined);
  return result;
}

/** Every saved board, newest first. `[]` when there are none or storage failed. */
export async function listDesignBoards(): Promise<DesignBoard[]> {
  return (await readAll()).sort(byRecency);
}

/** One board, or `null` if it is not saved on this device. */
export async function getDesignBoard(id: string): Promise<DesignBoard | null> {
  return (await readAll()).find((board) => board.id === id) ?? null;
}

/**
 * Creates or updates one board, matched by id.
 *
 * Returns the saved board, or `null` if it was invalid or storage rejected the
 * write — the screen reports that rather than claiming a save that did not
 * happen.
 */
export async function saveDesignBoard(board: DesignBoard): Promise<DesignBoard | null> {
  const valid = normalizeDesignBoard(board);
  if (!valid) return null;

  return enqueue(async () => {
    const boards = await readAll();
    const index = boards.findIndex(({ id }) => id === valid.id);

    if (index >= 0) boards[index] = valid;
    else boards.push(valid);

    try {
      await AsyncStorage.setItem(DESIGN_BOARDS_KEY, JSON.stringify(boards));
      return valid;
    } catch {
      return null;
    }
  });
}

/** Removes one board. `true` when it is gone, including when it never existed. */
export async function deleteDesignBoard(id: string): Promise<boolean> {
  return enqueue(async () => {
    const boards = await readAll();
    const remaining = boards.filter((board) => board.id !== id);

    try {
      await AsyncStorage.setItem(DESIGN_BOARDS_KEY, JSON.stringify(remaining));
      return true;
    } catch {
      return false;
    }
  });
}
