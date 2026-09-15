/**
 * DISTANCE, FORMATTED FOR READING.
 *
 * ── What this returns, and what it deliberately does not ────────────────
 * The NUMBER only — "12.8", "0.4", "1,5" — never the unit and never a phrase.
 * The unit and the wording live in the translation bundles, because they are
 * not interchangeable across the six languages: English appends "km away",
 * Turkish "km uzaklıkta", Arabic puts the preposition first as "على بُعد … كم",
 * and the unit itself is written km / км / كم / کلومیٹر. A formatter that
 * returned "12.8 km away" would have to be rewritten per language, which is
 * exactly what t() already does properly.
 *
 * ── Straight-line, and nothing more ─────────────────────────────────────
 * The value handed in comes from `haversineDistanceKm` — great-circle distance
 * between two points on a sphere. It is NOT driving distance, NOT walking
 * distance and NOT travel time. UI copy therefore says "away", never "drive"
 * or "minutes". Real routes belong to a navigation provider, which is a later
 * phase.
 *
 * ── Latin digits on purpose ─────────────────────────────────────────────
 * `numberingSystem: 'latn'` is forced. Left to itself, `Intl` renders Arabic
 * as ١٢٫٨ — correct in isolation, but this string sits directly beneath a price
 * rendered by `formatPrice`, which groups thousands by hand and emits Western
 * digits in every language ("$13,250,000"). One card showing ١٢٫٨ above
 * 13,250,000 looks like a rendering fault rather than a choice. The decimal
 * SEPARATOR is still localised, so Turkish, German and Russian correctly read
 * "12,8" — which is the part that actually changes meaning.
 *
 * Pure: no React, no imports, no clock.
 */

/**
 * Below this, the display floors rather than rounding to zero.
 *
 * A property 40 m away would otherwise format as "0.0", which reads as "here"
 * and looks like a bug. Flooring to 0.1 km overstates the distance by at most
 * 60 m, always in the harmless direction, and keeps every value non-zero.
 */
const MINIMUM_DISPLAY_KM = 0.1;

/** One decimal place. Anything finer is precision the measurement cannot claim. */
const FRACTION_DIGITS = 1;

/**
 * A distance in kilometres, as a locale-formatted number string.
 *
 * @param distanceKm raw, UNROUNDED kilometres. Rounding happens here, for
 *   display only — never before a radius comparison, which would move the
 *   boundary by up to half a unit.
 * @param locale BCP-47 tag, e.g. the app's active language code.
 * @returns the number alone. Pair it with a translated unit/phrase.
 *   Non-finite input returns an empty string, so a caller that forgets to
 *   check renders nothing rather than "NaN km away".
 */
export function formatDistanceKm(distanceKm: number, locale: string): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '';

  const value = Math.max(distanceKm, MINIMUM_DISPLAY_KM);

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: FRACTION_DIGITS,
      maximumFractionDigits: FRACTION_DIGITS,
      // See the note above: Western digits, localised separator.
      numberingSystem: 'latn',
    }).format(value);
  } catch {
    /*
      Hermes ships Intl through the platform's ICU, and the available options
      vary by Android version. A missing numbering system or an unknown locale
      throws — and a distance label is not worth a crash, so this degrades to a
      plain decimal point. Turkish would read "12.8" instead of "12,8": less
      polished, still perfectly legible, and still the correct number.
    */
    return value.toFixed(FRACTION_DIGITS);
  }
}
