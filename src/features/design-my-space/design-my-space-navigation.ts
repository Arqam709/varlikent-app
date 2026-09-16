import type { DesignDraft } from '@/features/design-my-space/design-board';

/**
 * WHAT "BACK" MEANS IN DESIGN MY SPACE — decided in one place.
 *
 * Four controls can ask to go back: the header arrow, the Android hardware
 * button, the Back button under a step, and "Back to Interior Design" on the
 * board. They must never disagree, so none of them decides anything; each one
 * calls the screen's single handler, which asks `resolveBackAction`.
 *
 *   flow, step > 1   → the previous step (wizard navigation)
 *   flow, step 1     → the landing view
 *   board            → leave the feature for the Interior Design page,
 *                      confirming first only if the board has unsaved changes
 *   landing          → leave the feature
 *
 * The board deliberately does NOT step back into the flow any more. It has an
 * explicit "Edit Design" action for that, so Back on the board can mean "I am
 * done here".
 */

export type DesignMySpaceView = 'landing' | 'flow' | 'board';

/** Where leaving the feature lands: the service page that offers it. */
export const DESIGN_MY_SPACE_EXIT_HREF = '/services/interior-design' as const;

export type DesignBackAction =
  | { type: 'previous-step'; stepIndex: number }
  | { type: 'landing' }
  | { type: 'exit' }
  | { type: 'confirm-exit' };

export function resolveBackAction(
  view: DesignMySpaceView,
  stepIndex: number,
  hasUnsavedChanges: boolean
): DesignBackAction {
  if (view === 'flow') {
    return stepIndex > 0 ? { type: 'previous-step', stepIndex: stepIndex - 1 } : { type: 'landing' };
  }
  if (view === 'board') {
    return hasUnsavedChanges ? { type: 'confirm-exit' } : { type: 'exit' };
  }
  return { type: 'exit' };
}

/** A comparable fingerprint of a draft, taken when it is opened from or written to disk. */
export function draftSignature(draft: DesignDraft): string {
  return JSON.stringify(draft);
}

/**
 * Whether the board on screen differs from what is saved on this device.
 *
 * `savedSignature` is null for a board that has never been saved, which is
 * always "unsaved" — a completed brand-new board is exactly the work a user
 * would be upset to lose by pressing Back.
 */
export function hasUnsavedChanges(savedSignature: string | null, draft: DesignDraft): boolean {
  return savedSignature === null || savedSignature !== draftSignature(draft);
}
