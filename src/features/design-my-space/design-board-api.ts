import {
  designBoardFromServer,
  designBoardPayload,
  isServerDesignBoardId,
  type DesignBoard,
} from '@/features/design-my-space/design-board';
import { ApiError, apiRequest } from '@/services/api-client';

/**
 * DESIGN BOARD ENDPOINTS — pure network layer.
 *
 * Every call needs the signed-in user's token. The backend scopes each query by
 * the authenticated id, so there is no userId to pass and none is accepted; a
 * board id that belongs to someone else is simply a 404.
 *
 * Every board that comes back goes through `designBoardFromServer`, so nothing
 * the server sends reaches a screen unchecked.
 */

type BoardsResponse = { success: true; boards?: unknown };
type BoardResponse = { success: true; board?: unknown };

/** A write the server accepted but answered with something unusable is still a failure. */
function boardOrThrow(response: BoardResponse | null): DesignBoard {
  const board = designBoardFromServer(response?.board);
  if (!board) throw new ApiError('unknown', 'The server returned an unreadable design board.');
  return board;
}

/** GET /api/design-boards → this user's boards, most recently edited first. */
export async function fetchAccountDesignBoards(token: string): Promise<DesignBoard[]> {
  const response = await apiRequest<BoardsResponse>('/design-boards', { token });
  if (!Array.isArray(response?.boards)) {
    throw new ApiError('unknown', 'The server returned an unreadable list of design boards.');
  }

  // A single unreadable board (e.g. a room id a newer build introduced) is
  // skipped, never allowed to hide the rest.
  const boards: DesignBoard[] = [];
  for (const item of response.boards) {
    const board = designBoardFromServer(item);
    if (board) boards.push(board);
  }
  return boards;
}

/**
 * Saves a board to the account.
 *
 * A board with a server id is replaced with PUT. A board that so far exists
 * only on this device is created with POST, sending its device id as
 * `clientId` — so if the response is lost and the user taps Save again, the
 * server updates that same board instead of creating a duplicate.
 */
export async function saveAccountDesignBoard(token: string, board: DesignBoard): Promise<DesignBoard> {
  if (isServerDesignBoardId(board.id)) {
    const response = await apiRequest<BoardResponse>(`/design-boards/${board.id}`, {
      method: 'PUT',
      token,
      
      body: designBoardPayload(board),
    });
    return boardOrThrow(response);
  }

  const response = await apiRequest<BoardResponse>('/design-boards', {
    method: 'POST',
    token,
    body: { ...designBoardPayload(board), clientId: board.id },
  });
  return boardOrThrow(response);
}

/** DELETE /api/design-boards/:id — 404 when it is not (or no longer) this user's. */
export async function deleteAccountDesignBoard(token: string, id: string): Promise<void> {
  await apiRequest(`/design-boards/${id}`, { method: 'DELETE', token });
}
