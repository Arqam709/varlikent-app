/**
 * Turning stored company settings into openable URLs.
 *
 * Pure functions, no React and no Linking call, so every rule below is unit
 * testable without a device — see tests/contact-links.test.mjs.
 *
 * ── Why each builder can return null ────────────────────────────────────
 * The settings document is admin-editable and every field can be cleared to an
 * empty string. A builder that returns a string come what else eventually
 * produces `tel:undefined`, which opens the dialer with nothing in it — worse
 * than a button that was never rendered. `null` is the signal to render no
 * control at all, which is what the Contact screen does with it.
 */

/** Digits, plus an optional leading '+'. Everything else is presentation. */
const KEEP_PHONE_CHARS = /[^\d+]/g;

const text = (value: string | undefined | null): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * `tel:` for the company phone.
 *
 * Spaces, dashes and parentheses are stripped because a dialer treats them
 * inconsistently — the website does the same thing with `.replace(/\s/g,'')`,
 * and this widens it to the other separators a human might type into the admin
 * form. The leading '+' is KEPT: it is what makes the number dialable from
 * outside Turkey, which matters for an agency selling to overseas buyers.
 */
export function buildTelUrl(phone: string | undefined | null): string | null {
  const raw = text(phone);
  if (!raw) return null;

  const cleaned = raw.replace(KEEP_PHONE_CHARS, '');
  // A '+' on its own is not a number. Require at least one digit.
  if (!/\d/.test(cleaned)) return null;

  return `tel:${cleaned}`;
}

/**
 * `mailto:` for the company address.
 *
 * Deliberately no subject or body. The website's plain `mailto:` is what
 * customers already get, and a pre-filled subject would put an untranslated
 * English string into a Turkish or Arabic customer's outgoing mail.
 *
 * The check is a sanity test, not RFC validation: the value is typed by an
 * administrator, and the backend already stores it as a plain string. All this
 * rules out is an obviously unusable value producing a dead button.
 */
export function buildMailtoUrl(email: string | undefined | null): string | null {
  const raw = text(email);
  if (!raw) return null;
  // One '@', something before it, something with a dot after it, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;

  return `mailto:${raw}`;
}

/**
 * A country code plus a subscriber number is at least ~8 digits anywhere.
 * Rejects a stray '+' or a placeholder like '0' without pretending to validate
 * real numbering plans.
 */
const MIN_MSISDN_DIGITS = 8;

/** The native deep link. Opens the installed app straight into the chat. */
const whatsappAppUrl = (digits: string) => `whatsapp://send?phone=${digits}`;

/** The universal link. Bounces through the browser to the app, or to the store. */
const whatsappWebUrl = (digits: string) => `https://wa.me/${digits}`;

/**
 * Pulls a subscriber number out of a link an administrator pasted.
 *
 * Handles both shapes WhatsApp publishes: `wa.me/<digits>` and
 * `…?phone=<digits>`. Returns '' when there is no number to find, in which
 * case the pasted link is still honoured — just without a native counterpart.
 */
function digitsFromWhatsAppLink(link: string): string {
  const phoneParam = /[?&]phone=\+?(\d{6,})/i.exec(link);
  if (phoneParam) return phoneParam[1];

  const waMePath = /wa\.me\/\+?(\d{6,})/i.exec(link);
  if (waMePath) return waMePath[1];

  return '';
}

/**
 * WhatsApp candidates, in the order they should be attempted.
 *
 * ── Why two URLs and not one ────────────────────────────────────────────
 * `https://wa.me/…` was what this returned before, and it works — but it works
 * by opening the BROWSER first, which then hands off to WhatsApp. The customer
 * sees a web page flash past, and on a device with no default browser it can
 * dead-end entirely. Tapping "WhatsApp" should open WhatsApp.
 *
 * `whatsapp://send?phone=…` opens the installed app directly into the chat. It
 * is also the one that fails when WhatsApp is absent, which is why it cannot be
 * the ONLY candidate — hence the ordered pair. `openFirstAvailable` attempts
 * the native scheme and falls back to the web link, which on a phone without
 * WhatsApp lands on a page offering to install it.
 *
 * ── Normalisation ───────────────────────────────────────────────────────
 * Both forms want DIGITS ONLY, in full international form, with no '+' and no
 * spaces. The stored value is `+905331664910`; the website interpolates it raw
 * and so emits `wa.me/+905331664910`. WhatsApp tolerates that today, but it is
 * not the documented format and not something to copy.
 *
 *   '+905331664910'  →  ['whatsapp://send?phone=905331664910',
 *                        'https://wa.me/905331664910']
 *
 * @returns Candidates in preference order, or an EMPTY ARRAY when the setting
 *   holds nothing usable — the caller's signal to render no button at all.
 */
export function buildWhatsAppUrls(whatsapp: string | undefined | null): string[] {
  const raw = text(whatsapp);
  if (!raw) return [];

  // An administrator who pasted a whole link meant it, so it is never
  // rewritten. A native scheme is already the most direct form there is.
  if (/^whatsapp:/i.test(raw)) return [raw];

  if (/^https?:/i.test(raw)) {
    // Honour the link, but still prefer the app when a number can be read out
    // of it — otherwise pasting a wa.me link would silently downgrade every
    // customer to the browser route.
    const digits = digitsFromWhatsAppLink(raw);
    return digits ? [whatsappAppUrl(digits), raw] : [raw];
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length < MIN_MSISDN_DIGITS) return [];

  return [whatsappAppUrl(digits), whatsappWebUrl(digits)];
}

/**
 * The office location link.
 *
 * Prefers the admin-configured `mapsUrl`, because that is a share link chosen
 * by someone who knows exactly which pin is correct — a Google short link
 * resolves to the real place, whereas a text search can land on a
 * similarly-named street in another district.
 *
 * Falls back to a geo query built from the address ONLY when no link is
 * configured, so the section still offers directions rather than showing a
 * dead address. `https://` rather than the `geo:` scheme because geo: has no
 * handler on many devices, while an https maps URL always opens something.
 *
 * Only http(s) links are honoured. A cleared field, or a value that is not a
 * web link, yields null and the screen renders the address with no action.
 */
export function buildMapsUrl(
  mapsUrl: string | undefined | null,
  address: string | undefined | null
): string | null {
  const link = text(mapsUrl);
  if (link && /^https?:\/\//i.test(link)) return link;

  const place = text(address);
  if (!place) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}
