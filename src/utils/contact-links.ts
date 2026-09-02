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

export function buildMailtoUrl(email: string | undefined | null): string | null {
  const raw = text(email);
  if (!raw) return null;
  // One '@', something before it, something with a dot after it, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;

  return `mailto:${raw}`;
}


const MIN_MSISDN_DIGITS = 8;

/** The native deep link. Opens the installed app straight into the chat. */
const whatsappAppUrl = (digits: string) => `whatsapp://send?phone=${digits}`;

/** The universal link. Bounces through the browser to the app, or to the store. */
const whatsappWebUrl = (digits: string) => `https://wa.me/${digits}`;

function digitsFromWhatsAppLink(link: string): string {
  const phoneParam = /[?&]phone=\+?(\d{6,})/i.exec(link);
  if (phoneParam) return phoneParam[1];

  const waMePath = /wa\.me\/\+?(\d{6,})/i.exec(link);
  if (waMePath) return waMePath[1];

  return '';
}

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
