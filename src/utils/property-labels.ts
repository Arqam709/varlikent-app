/**
 * Translation KEYS for the recurring property labels.
 *
 * ── Why keys rather than strings ────────────────────────────────────────
 * `t` comes from a React hook, and this is an ordinary utility module — it must
 * not import hooks. So these return the KEY and the caller does `t(key)`. That
 * keeps the module pure and testable while the string itself still resolves at
 * render time, which is what makes it react to a language change.
 *
 * ── Why it exists at all ────────────────────────────────────────────────
 * The Sale/Rent/Featured badge ternary was written out FOUR separate times
 * (property-card, home-featured-properties, properties/[id], messages/[id]),
 * each with its own copy of the English strings. Four copies means four places
 * to forget when the rule changes — and the website rule is not obvious: a
 * rental never shows the Featured badge even when the flag is set.
 */

/** Backend enum, sent to the API. Never translated. */
export type ListingType = 'Sale' | 'Rent';

/**
 * Which badge a listing shows.
 *
 * The rule mirrors the website: Rent wins, then Featured, then Sale — and
 * Featured is suppressed for rentals.
 */
export function listingBadgeKey(listingType: string | undefined, featured?: boolean): string {
  const isRent = listingType === 'Rent';
  if (isRent) return 'properties.forRent';
  return featured ? 'properties.featured' : 'properties.forSale';
}

/** "For Sale" / "For Rent" only — no Featured state. */
export function listingTypeKey(listingType: string | undefined): string {
  return listingType === 'Rent' ? 'properties.forRent' : 'properties.forSale';
}

/**
 * Singular/plural bedroom label.
 *
 * English distinguishes Bed/Beds. Turkish and Arabic do not inflect the same
 * way, so their bundles simply repeat the correct single form for both keys —
 * the branch stays here rather than leaking grammar rules into components.
 */
export function bedsKey(count: number): string {
  return count === 1 ? 'properties.bed' : 'properties.beds';
}

export function bathsKey(count: number): string {
  return count === 1 ? 'properties.bath' : 'properties.baths';
}
