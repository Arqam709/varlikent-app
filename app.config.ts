import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * THE ANDROID GOOGLE MAPS KEY, KEPT OUT OF THE REPOSITORY
 *
 * ── Why this file exists at all ──────────────────────────────────────────
 * `app.json` remains the single description of this app. Everything in it is
 * still authoritative; this file only overlays ONE value that must not be
 * written down in a tracked file — the Google Maps SDK for Android key that
 * `react-native-maps` needs before Android will draw a single map tile.
 *
 * Expo reads `app.json` first and hands it to the default export below as
 * `config`, so spreading it is a faithful copy, not a re-declaration. Nothing
 * here restates the icon, the intent filters or the plugin list, and adding a
 * key to `app.json` continues to work exactly as it did.
 *
 * ── Why not `android.config.googleMaps.apiKey` straight in app.json ──────
 * That is where the value ends up, and it is the correct destination — but
 * app.json is JSON, so the literal key would be committed. An Android Maps key
 * is extractable from any installed APK and is therefore not a true secret, yet
 * an unrestricted key in a public history is still somebody else's free quota.
 * A config file that reads the environment is the mechanism Expo provides for
 * precisely this, and it matches how the app already treats
 * EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: configuration lives in `.env`, which is
 * gitignored, and `.env.example` documents the name.
 *
 * ── Why NOT prefixed EXPO_PUBLIC_ ───────────────────────────────────────
 * EXPO_PUBLIC_* exists to inline a value into the JavaScript bundle. This value
 * is never read by JavaScript. It is consumed at BUILD time, when Expo's
 * prebuild writes it into the Android manifest as
 * `com.google.android.geo.API_KEY`. Prefixing it would ship it into the JS
 * bundle as well, for no benefit.
 *
 * ── react-native-maps 1.20.1 has no config plugin ───────────────────────
 * Newer releases ship one that takes the key as a plugin option. 1.20.1 — the
 * version Expo SDK 54 pins — predates it, so the key goes through Expo's own
 * core Android plugin via `android.config.googleMaps.apiKey`. (The SDK 54 docs
 * describe the plugin route regardless; see expo/expo#39679.) If
 * react-native-maps is ever upgraded, this overlay is the one place to revisit.
 *
 * ── When the variable is absent ─────────────────────────────────────────
 * The key is omitted rather than written as an empty string. An empty
 * `com.google.android.geo.API_KEY` in the manifest is worse than a missing one:
 * Google's SDK reports it as an authorisation failure rather than as absent
 * configuration. Omitting it means a developer without the key still gets a
 * building, running app — with a grey map surface on Android and a fully
 * working Apple Maps view on iOS, which is a legible symptom rather than a
 * mysterious one.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  if (!apiKey) return config as ExpoConfig;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey },
      },
    },
  } as ExpoConfig;
};
