import { Linking } from 'react-native';

/**
 * OPENING SOMETHING OUTSIDE THE APP, WITH A FALLBACK.
 *
 * ── Why this does NOT ask Linking.canOpenURL first ──────────────────────
 * Because `canOpenURL` reports false NEGATIVES for exactly the schemes this
 * app needs, and it does so on both platforms for different reasons:
 *
 *   iOS      `canOpenURL` on `whatsapp://…` resolves false unless `whatsapp`
 *            is listed in the Info.plist key LSApplicationQueriesSchemes. The
 *            SDK 54 Linking docs state this outright. This app declares no
 *            infoPlist, so the answer was always false — and an
 *            `if (!supported) throw` turned that into "unavailable" even with
 *            WhatsApp installed and running on the same phone.
 *
 *   Android  since API 30, package visibility filters the
 *            `queryIntentActivities` call that backs `canOpenURL`. Without a
 *            <queries> element naming the scheme, a handler that is installed
 *            is simply invisible to the query. `mailto:` and `tel:` are
 *            affected too, so the Email button could report "no mail client"
 *            on a phone with Gmail on the home screen. Expo SDK 54's app
 *            config has NO `android.queries` key (verified against the config
 *            reference), so this could not be fixed in app.json even if we
 *            wanted to keep the check.
 *
 * `openURL` has neither problem. On iOS it calls `UIApplication.open`, which
 * has never required LSApplicationQueriesSchemes — that key governs asking,
 * not opening. On Android it calls `startActivity`, which package visibility
 * does not filter; it throws ActivityNotFoundException when there is genuinely
 * no handler, and React Native surfaces that as a rejected promise.
 *
 * So the reliable shape is: TRY to open, and treat a rejection as the real
 * answer.
 *
 * ── Why the default opener is a WRAPPER and never a bare reference ──────
 * This is not a style preference. It is the bug that shipped in the first
 * version of this file and broke every contact button on a real device.
 *
 * In React Native 0.81.5, `Linking` is `new LinkingImpl()` — a class INSTANCE
 * (node_modules/react-native/Libraries/Linking/Linking.js). `openURL` is an
 * ordinary prototype method, and its first statement dereferences `this`:
 *
 *     openURL(url: string): Promise<void> {
 *       this._validateURL(url);          // ← needs the receiver
 *       ...
 *     }
 *
 * Class bodies are always strict mode and class methods are not auto-bound, so
 * writing `open = Linking.openURL` and later calling `open(url)` invokes it
 * with `this === undefined`. That throws, SYNCHRONOUSLY, before any native
 * call happens:
 *
 *     TypeError: Cannot read properties of undefined (reading '_validateURL')
 *
 * The try/catch below then swallowed it, the loop moved on, the next candidate
 * failed the same way, and `openFirstAvailable` returned null for every URL —
 * so WhatsApp, Email and Maps all reported "could not be opened" on devices
 * where all three apps were installed and working.
 *
 * `(url) => Linking.openURL(url)` keeps it a METHOD CALL, so the receiver is
 * preserved. Never reintroduce `= Linking.openURL`; tests/open-external-url.test.mjs
 * guards both the behaviour and the spelling.
 *
 * ── Why a list rather than one URL ──────────────────────────────────────
 * "Open WhatsApp, or the web version if it is not installed" is one intention
 * with two spellings, and the decision between them can only be made by
 * attempting the first. Expressing it as an ordered candidate list keeps that
 * loop in one place instead of nesting try/catch at every call site.
 */

/**
 * Tries each URL in order and stops at the first that opens.
 *
 * @param urls Candidates in order of preference. A native scheme first, then a
 *   web equivalent, is the usual shape.
 * @param open Injectable for tests. Production uses the default, which calls
 *   `Linking.openURL` as a method — see the note above on why that matters.
 * @returns The URL that opened, or `null` when every candidate was refused —
 *   which is the caller's signal to show its own "unavailable" message rather
 *   than leaving the tap looking broken.
 */
export async function openFirstAvailable(
  urls: readonly string[],
  open: (url: string) => Promise<unknown> = (url) => Linking.openURL(url)
): Promise<string | null> {
  for (const url of urls) {
    if (!url) continue;

    try {
      await open(url);
      return url;
    } catch (error) {
      /*
       * This candidate has no handler on this device. Fall through to the next
       * one; only running out of candidates counts as a failure.
       *
       * Logged under __DEV__ only. A silent catch is what made the detached-
       * method bug above so expensive to find: every candidate failed for a
       * reason the app was actively discarding, and the only visible symptom
       * was the generic "could not be opened" message. In a production build
       * __DEV__ is false, so this costs nothing and adds no noise; in
       * development it says WHICH url failed and WHY, which is the difference
       * between "WhatsApp is not installed" (ActivityNotFoundException) and a
       * JavaScript mistake on our side (TypeError).
       */
      if (__DEV__) {
        console.warn('[open-external-url] candidate failed', {
          url,
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return null;
}
