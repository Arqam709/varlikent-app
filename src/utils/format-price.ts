import type { ListingType } from '@/types/property';

/**
 * Price formatting, ported from the website's src/lib/formatPrice.js so both
 * clients display the same string for the same property.
 *
 * The rules look odd until you see the real data. `priceLabel` is documented
 * as a label but actually holds three different kinds of value:
 *
 *   "₺2,100,000" / "₺25,000/month"  → already fully formatted  → shown as-is
 *   "₺" / "TL" / "$" / "€"          → a currency symbol        → we format
 *   "₺5190000"                      → symbol + raw digits      → shown as-is
 *
 * The last case renders without thousand separators. That is a data-entry
 * wart, and the website shows it too — we reproduce the behaviour rather than
 * silently diverging from it.
 */

/**
 * Groups digits into thousands: 5190000 -> "5,190,000".
 *
 * Written by hand instead of `toLocaleString('en-US')` — the website's
 * approach — because number formatting depends on the JS engine's Intl data,
 * and Hermes builds vary in whether full Intl is present. A regex gives byte
 * identical output on every device instead of grouping on one phone and not
 * another.
 */
function groupThousands(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPrice(
  price: number,
  listingType: ListingType,
  priceLabel?: string
): string {
  const label = priceLabel?.trim();

  // Matches the website: a missing or zero price is not "0", it is unknown.
  if (!price) return 'Price on request';

  const amount = groupThousands(price);
  const rentSuffix = listingType === 'Rent' ? '/mo' : '';

  if (label) {
    if (label === '$') return `$${amount}${rentSuffix}`;
    if (label === '₺' || label.toUpperCase() === 'TL') return `₺${amount}${rentSuffix}`;
    if (label === '€') return `€${amount}${rentSuffix}`;

    // Anything else is treated as the finished string, verbatim.
    return label;
  }

  // No label at all defaults to USD, same as the website.
  return `$${amount}${rentSuffix}`;
}
