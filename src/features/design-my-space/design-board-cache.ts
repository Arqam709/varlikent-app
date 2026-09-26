import AsyncStorage from '@react-native-async-storage/async-storage';

import { designBoardFromServer, type DesignBoard } from '@/features/design-my-space/design-board';


const CACHE_PREFIX = 'varlikent_design_boards_account_v1';

/** A Mongo user id; anything else is not a key this cache will use. */
const USER_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function accountDesignBoardsCacheKey(userId: string): string | null {
  return USER_ID_PATTERN.test(userId) ? `${CACHE_PREFIX}:${userId}` : null;
}

/** What is written: the server's field names, so the read path is `designBoardFromServer`. */
function toStored(board: DesignBoard) {
  const { id, ...rest } = board;
  return { _id: id, ...rest };
}

export async function readCachedAccountBoards(userId: string): Promise<DesignBoard[]> {
  const key = accountDesignBoardsCacheKey(userId);
  if (!key) return [];

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const boards: DesignBoard[] = [];
    for (const entry of parsed) {
      const board = designBoardFromServer(entry);
      if (board && !boards.some((kept) => kept.id === board.id)) boards.push(board);
    }
    return boards;
  } catch {
    return [];
  }
}

/** Serializes writes, so a list refresh and a save cannot overwrite each other. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.catch(() => undefined);
  return result;
}

async function write(key: string, boards: readonly DesignBoard[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(boards.map(toStored)));
  } catch {

  }
}

/** Replaces this user's cache with an authoritative server list. */
export function writeCachedAccountBoards(userId: string, boards: readonly DesignBoard[]): Promise<void> {
  const key = accountDesignBoardsCacheKey(userId);
  if (!key) return Promise.resolve();
  return enqueue(() => write(key, boards));
}

export function updateCachedAccountBoards(
  userId: string,
  change: (boards: DesignBoard[]) => DesignBoard[]
): Promise<void> {
  const key = accountDesignBoardsCacheKey(userId);
  if (!key) return Promise.resolve();
  return enqueue(async () => write(key, change(await readCachedAccountBoards(userId))));
}

export function clearCachedAccountBoards(userId: string): Promise<void> {
  const key = accountDesignBoardsCacheKey(userId);
  if (!key) return Promise.resolve();
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      
    }
  });
}
