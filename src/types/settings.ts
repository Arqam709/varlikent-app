/**
 * Company settings, as returned by GET /api/settings.
 *
 * Verified against backend/models/SiteSettings.js and a live response.
 *
 * ── Why every field is optional ─────────────────────────────────────────
 * The backend schema gives each of these a `default`, so a healthy response
 * always carries them — but "the schema has a default" is a statement about
 * how documents are CREATED, not about what arrives on the wire. An owner can
 * clear a field to '' through PUT /api/settings (the live `linkedin` is empty
 * right now), and a partial or malformed body must degrade to a Contact screen
 * that hides one action rather than one that renders `tel:undefined`.
 *
 * Declaring them optional is what forces every caller to decide what to do
 * when a value is missing, which is the behaviour the Contact screen wants.
 *
 * Type declarations only — erased at build time, no runtime cost.
 */

export interface SiteSettings {
  /** e.g. "info@varlikent.com" */
  email?: string;
  /** Human-formatted, WITH spaces: "+90 533 166 49 10". Display verbatim. */
  phone?: string;
  /**
   * Stored with a leading '+' ("+905331664910"), which is NOT what wa.me
   * accepts. Normalise with `buildWhatsAppUrl` rather than interpolating.
   */
  whatsapp?: string;
  /** Full postal address, one line, already localised by whoever typed it. */
  address?: string;
  /** A share link, e.g. "https://maps.app.goo.gl/…". Opened as-is. */
  mapsUrl?: string;
  instagram?: string;
  linkedin?: string;
  /**
   * Whether Design My Space may request a room visualization.
   *
   * OFF until a provider exists: with it on and no worker running, a request
   * would queue and never finish. The room-photo screen only offers the action
   * when this is true, and the backend refuses creation regardless.
   */
  designGenerationsEnabled?: boolean;
  /**
   * Per-service switches for the website's showroom galleries. Declared
   * because the endpoint returns it; nothing in the app reads it yet.
   */
  showroomEnabled?: {
    architecture?: boolean;
    interior?: boolean;
    construction?: boolean;
    renovation?: boolean;
  };
}

/** GET /api/settings — confirmed live. */
export interface SiteSettingsResponse {
  success: true;
  settings: SiteSettings;
}
