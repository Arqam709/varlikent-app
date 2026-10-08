import AsyncStorage from '@react-native-async-storage/async-storage';

import { renovationPlanFromStorage, type RenovationPlan } from '@/features/renovation-plan/renovation-plan';

/**
 * WHERE A RENOVATION PLAN LIVES: on this device, one per account.
 *
 * A plan is the customer's own notes, not a business record, so it is not sent
 * anywhere until they choose to request the renovation — and then the REQUEST
 * (with its own copies of the photos) is what Varlikent keeps. Saving it
 * locally lets "Plan Your Renovation" reopen where they left off.
 *
 * One plan per account: `guest` while signed out, the user id once signed in,
 * so two people sharing a phone do not see each other's plans.
 *
 * Photos are stored as the picker's local file references. They live in the
 * app's cache, which the operating system may clear; the planner drops any it
 * can no longer display, and the rest of the plan is unaffected.
 */

const PREFIX = 'varlikent_renovation_plan_v1';
const USER_ID = /^[0-9a-f]{24}$/i;

export const renovationPlanOwner = (userId: string | null | undefined): string =>
  userId && USER_ID.test(userId) ? userId : 'guest';

const keyFor = (owner: string) => `${PREFIX}:${owner}`;

export async function readRenovationPlan(owner: string): Promise<RenovationPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(owner));
    return raw ? renovationPlanFromStorage(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Never throws: a plan that cannot be saved is still on screen. */
export async function writeRenovationPlan(owner: string, plan: RenovationPlan): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(owner), JSON.stringify(plan));
  } catch {
    // Storage full or unavailable: the plan simply is not kept for next time.
  }
}

export async function clearRenovationPlan(owner: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(owner));
  } catch {
    // Nothing to do: the worst case is a stale plan offered next time.
  }
}
