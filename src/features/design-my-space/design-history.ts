import type { DesignBoard } from '@/features/design-my-space/design-board';
import type { DesignGeneration } from '@/features/design-my-space/design-generation';

/**
 * MY DESIGNS — a board together with the visualizations made from it.
 *
 * The backend keeps them apart on purpose (DesignBoard, DesignGeneration: a
 * visualization snapshots the board it was made from and outlives edits). To
 * the customer, though, a visualization belongs to its design, so My Designs
 * shows ONE entry per board: the board, its newest finished visualization, and
 * how many it has in total.
 *
 * Built from the two existing list endpoints and grouped here — never one
 * request per board. Pure: no React, no network.
 */

export type DesignHistoryEntry = {
  board: DesignBoard;
  /** Finished visualizations with an image, newest first. */
  visualizations: DesignGeneration[];
  /** A visualization is still being made for this board. */
  pending: boolean;
};

const newestFirst = (a: DesignGeneration, b: DesignGeneration) =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt);

/**
 * One entry per board, in the boards' own order. Visualizations whose board
 * no longer exists are dropped (the design was deleted); failed ones are not
 * shown at all — they have nothing to look at.
 */
export function groupDesignHistory(
  boards: readonly DesignBoard[],
  generations: readonly DesignGeneration[]
): DesignHistoryEntry[] {
  const byBoard = new Map<string, DesignGeneration[]>();
  for (const generation of generations) {
    const list = byBoard.get(generation.boardId) ?? [];
    list.push(generation);
    byBoard.set(generation.boardId, list);
  }

  return boards.map((board) => {
    const own = byBoard.get(board.id) ?? [];
    return {
      board,
      visualizations: own
        .filter((generation) => generation.status === 'succeeded' && generation.hasResult)
        .sort(newestFirst),
      pending: own.some((generation) => generation.status === 'queued' || generation.status === 'processing'),
    };
  });
}
