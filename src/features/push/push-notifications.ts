import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * NATIVE PUSH ADAPTER
 *
 * The only file that talks to expo-notifications. Its job is to turn "this user
 * is signed in" into "the backend knows this device's push token", and to say
 * clearly when it cannot.
 *
 * Deliberately does NOT: call the Varlikent backend, read AuthContext, navigate,
 * or render anything. Same division as the Google sign-in adapter — the OS
 * conversation lives here, everything Varlikent-specific lives above it.
 *
 * ── Why nothing is cached on the device ──────────────────────────────────
 * The token is re-read on every authenticated launch and re-sent. Expo can
 * rotate it, and the backend upsert makes repetition free, so a local copy
 * could only ever go stale and be wrong in a way nothing would detect.
 */

/** Why a registration attempt produced no token. */
export type PushUnavailableReason =
  /** Simulator or emulator — push tokens require real hardware. */
  | 'not_a_device'
  /** The user declined, or the OS refused. */
  | 'permission_denied'
  /** No EAS projectId in the app config, so Expo cannot mint a token. */
  | 'not_configured'
  /** The native call failed — most often FCM credentials missing on Android. */
  | 'unavailable';

export type PushTokenResult =
  | { type: 'token'; token: string; platform: 'android' | 'ios' }
  | { type: 'unavailable'; reason: PushUnavailableReason };

/**
 * How a notification behaves while the app is OPEN.
 *
 * Android already shows nothing in the foreground unless asked, so without this
 * a notification arriving while the user is reading a listing would be silently
 * swallowed. Set at module scope so it is in place before any notification can
 * arrive, and set once — calling it per render would reinstall the handler on
 * every re-render.
 *
 * The banner is left to the OS rather than drawn by us: a hand-rolled in-app
 * toast plus the system banner is how apps end up showing the same message
 * twice.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * The EAS project this build belongs to.
 *
 * `getExpoPushTokenAsync` needs it to mint a token, and it is NOT inferred
 * automatically in a bare/dev-client build. Read from the resolved app config
 * — `easConfig` is populated by EAS builds, `expoConfig.extra.eas` is what
 * app.json declares — so the value follows the project rather than being
 * duplicated in a constant that could drift.
 */
function resolveProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
  );
}

/**
 * Android requires a channel before anything can be displayed.
 *
 * Created up front rather than lazily: a notification that arrives with no
 * channel is dropped by the OS with no visible error, which is a miserable
 * thing to debug. `MAX` importance is what makes it a heads-up banner rather
 * than a silent entry in the tray.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Varlikent',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Reads the current permission WITHOUT prompting.
 *
 * Kept separate from `getPushToken` so a caller can tell "already declined"
 * from "never asked", which is the difference between showing an explanation
 * and showing nothing at all.
 */
export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Obtains this device's Expo push token, prompting for permission if needed.
 *
 * Returns a discriminated result rather than throwing: on a simulator, or after
 * a user says no, there is no token and that is a perfectly ordinary outcome,
 * not an error the caller should have to catch.
 *
 * @param options.requestPermission When false, an undetermined permission is
 *   reported as denied instead of prompting — for callers that want to register
 *   silently only if the user has already agreed.
 */
export async function getPushToken(
  { requestPermission = true }: { requestPermission?: boolean } = {}
): Promise<PushTokenResult> {
  // An emulator cannot receive a push token at all. Checked first so the user
  // is never shown a permission dialog that could not lead anywhere.
  if (!Device.isDevice) {
    return { type: 'unavailable', reason: 'not_a_device' };
  }

  try {
    // Before the permission prompt: on Android 13+ the OS shows the channel's
    // name in its own settings, so it should exist by the time the user decides.
    await ensureAndroidChannel();

    let { status } = await Notifications.getPermissionsAsync();

    /**
     * Only ever asked when the OS still considers it undetermined. Re-requesting
     * after a denial does nothing on Android 13+ — the system silently returns
     * denied without showing anything — so a retry loop would just burn calls
     * and make the app look broken.
     */
    if (status !== 'granted' && requestPermission) {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      return { type: 'unavailable', reason: 'permission_denied' };
    }

    const projectId = resolveProjectId();
    if (!projectId) {
      return { type: 'unavailable', reason: 'not_configured' };
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });

    if (!data) {
      return { type: 'unavailable', reason: 'unavailable' };
    }

    return {
      type: 'token',
      token: data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    };
  } catch {
    /**
     * Nothing is logged here on purpose — the error can carry the token, and on
     * Android the common cause is simply that FCM credentials are not configured
     * yet, which is a deployment fact rather than a runtime fault. Callers get
     * a reason code and decide what, if anything, to show.
     */
    return { type: 'unavailable', reason: 'unavailable' };
  }
}

/** Re-exported so callers can subscribe without importing expo-notifications. */
export const addNotificationResponseListener = Notifications.addNotificationResponseReceivedListener;
export const getLastNotificationResponse = Notifications.getLastNotificationResponseAsync;
