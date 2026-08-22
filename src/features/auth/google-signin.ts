import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from 'react-native-nitro-google-signin';

import { GOOGLE_WEB_CLIENT_ID } from '@/constants/config';

/**
 * NATIVE GOOGLE SIGN-IN ADAPTER
 *
 * The only file in the app that talks to the Google SDK. Its entire job is to
 * turn a tap into either an ID token or a controlled outcome, and then get out
 * of the way.
 *
 * Deliberately does NOT: call the Varlikent backend, touch SecureStore, read or
 * write AuthContext, navigate, or persist anything. Keeping it that narrow is
 * what makes the trust boundary easy to check — everything security-relevant
 * happens on the server, and this module cannot accidentally participate.
 *
 * ── What the ID token is, and is not ─────────────────────────────────────
 * The token returned here is a one-shot proof of Google identity, spent on a
 * single POST and then dropped. It is NOT the Varlikent session. The session is
 * the JWT the backend issues in exchange, and that is the only credential the
 * app persists. Nothing here writes the Google token anywhere.
 */

/** Why a Google sign-in failed, in terms the UI can translate. */
export type GoogleSignInFailureCode =
  /** No web client ID configured — a build/config problem, not the user's fault. */
  | 'not_configured'
  /** Android: Play Services missing or too old to sign in. */
  | 'play_services'
  /**
   * Google rejected the app itself: wrong SHA-1, wrong package name, or the
   * Android client ID mistakenly used as `webClientId`. Always a setup bug.
   */
  | 'developer_error'
  /** Google reported success but handed back no usable ID token. */
  | 'no_id_token'
  /** Anything else the native SDK raised. */
  | 'unknown';

/**
 * A Google sign-in that did not produce a token, for a reason we recognise.
 *
 * Carries a `code` rather than a message because the message has to be
 * translated, and translation belongs in the screen where `t()` lives.
 */
export class GoogleSignInFailure extends Error {
  readonly code: GoogleSignInFailureCode;

  constructor(code: GoogleSignInFailureCode, message: string) {
    super(message);
    this.name = 'GoogleSignInFailure';
    this.code = code;
  }
}

/**
 * Outcome of a sign-in attempt.
 *
 * Cancellation is a RESULT, not an error, because that is what it is: the user
 * looked at the account sheet and decided not to. Modelling it as a thrown
 * error would push every caller into a try/catch that has to remember not to
 * show a message for one particular case.
 */
export type GoogleSignInResult =
  | { type: 'success'; idToken: string }
  | { type: 'cancelled' };

/**
 * Nitro's `configure` is synchronous and idempotent, but there is no reason to
 * repeat it on every tap.
 */
let configured = false;

function ensureConfigured(): void {
  if (configured) return;

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new GoogleSignInFailure(
      'not_configured',
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set'
    );
  }

  /**
   * Explicitly NOT `webClientId: 'autoDetect'`. autoDetect reads
   * `default_web_client_id`, which only exists when the Google Services Gradle
   * plugin has processed a google-services.json — and Varlikent deliberately
   * has no Firebase and no such file. Naming the client outright is both the
   * supported path for that setup and the more legible one.
   *
   * Nothing else is configured on purpose:
   *   offlineAccess  omitted — we never exchange a serverAuthCode, so leaving
   *                  it false means the SDK cannot even return one.
   *   scopes         omitted — authentication needs only the default OpenID
   *                  identity claims. Asking for Drive/Calendar/Contacts here
   *                  would put a scarier consent screen in front of a login.
   *   autoSelect     omitted — defaults to false, so the account picker is
   *                  always shown rather than silently reusing an account.
   */
  GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/**
 * True when the native SDK *threw* because the user dismissed the sign-in UI.
 *
 * Cancellation reaches this module two different ways. The explicit sign-in
 * flow normally reports it as a response (`type: 'cancelled'`), but some
 * Android paths surface the same user action as a thrown SIGN_IN_CANCELLED
 * instead. Both are the same event — someone looked at the account sheet and
 * backed out — so both have to produce the same silent outcome. Treating only
 * the response form as cancellation would put an error banner in front of a
 * user who simply changed their mind.
 */
function isCancellationThrow(error: unknown): boolean {
  return isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED;
}

/** Maps a native SDK throw onto our own codes, discarding SDK internals. */
function toFailure(error: unknown): GoogleSignInFailure {
  if (error instanceof GoogleSignInFailure) return error;

  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return new GoogleSignInFailure('play_services', 'Play Services unavailable');
    }
    if (error.code === statusCodes.DEVELOPER_ERROR) {
      return new GoogleSignInFailure(
        'developer_error',
        // The SDK documents this code as meaning a wrong/missing SHA-1, a
        // package-name mismatch, or the Android client ID passed as
        // webClientId. Recording which three things to check is the whole
        // value of not collapsing it into 'unknown'.
        'Google rejected the app configuration (SHA-1, package name or webClientId)'
      );
    }
    return new GoogleSignInFailure('unknown', `native error: ${error.code}`);
  }

  return new GoogleSignInFailure('unknown', 'unexpected native Google error');
}

/**
 * Runs the explicit Google sign-in flow and returns the resulting ID token.
 *
 * Only ever called from a deliberate user action. There is no startup call, no
 * call on screen mount, and no silent `signIn()` — an account picker the user
 * did not ask for is worse than no Google button at all.
 *
 * @throws {GoogleSignInFailure} for configuration, Play Services and SDK errors.
 */
export async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  try {
    ensureConfigured();

    // Android-only in practice; a no-op on iOS. Checked before showing any UI
    // so an unusable device fails with an explanation rather than a dialog that
    // cannot complete. `false` suppresses Google's own resolution dialog in
    // favour of our own message, keeping error presentation in one place.
    await GoogleOneTapSignIn.checkPlayServices(false);

    /**
     * `presentExplicitSignIn` is the "Sign in with Google" flow — the one that
     * shows the account chooser every time. The alternative, `signIn()`, is the
     * low-friction path that may reuse an authorised account without asking,
     * which is the wrong behaviour behind a button the user pressed on purpose.
     */
    const response = await GoogleOneTapSignIn.presentExplicitSignIn();

    if (isCancelledResponse(response)) {
      return { type: 'cancelled' };
    }

    if (!isSuccessResponse(response)) {
      // 'noSavedCredentialFound' lands here. From an explicit flow it means the
      // sheet closed without an account being chosen, which is a cancellation
      // in every way the user would recognise.
      return { type: 'cancelled' };
    }

    const idToken = response.data.idToken;

    /**
     * A success without a token is a failure. There is deliberately no fallback
     * to `response.data.user` — the email, name and Google id sitting right
     * there are client-supplied values the backend must never be asked to
     * trust. Only the signed token proves anything.
     */
    if (!idToken) {
      throw new GoogleSignInFailure('no_id_token', 'Google returned no ID token');
    }

    return { type: 'success', idToken };
  } catch (error) {
    // Checked before toFailure so a cancellation can never be dressed up as an
    // error. No request has been made at this point and none will be.
    if (isCancellationThrow(error)) {
      return { type: 'cancelled' };
    }

    // Nothing is logged here on purpose. The token, the Google subject and the
    // account email must not reach the console, and the native error objects
    // can carry more than their type suggests.
    throw toFailure(error);
  }
}
