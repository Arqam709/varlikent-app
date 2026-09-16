import { fallbackStudioPalette } from '@/features/studio-palette/studio-palette-fallback';
import {
  normalizeStudioPaletteResponse,
  type StudioPaletteKey,
  type StudioPaletteResult,
} from '@/features/studio-palette/studio-palette';
import { apiRequest } from '@/services/api-client';

/**
 * GET /api/studio-palette/:pageKey — the public endpoint the website reads.
 *
 * Never throws. The return value separates the three outcomes that matter:
 *
 *   { kind: 'palette' }   an owner's override, validated
 *   { kind: 'defaults' }  the server said `palette: null` — no override
 *   null                  no usable answer (offline, 5xx, unreadable body)
 *
 * Only the third is a failure. The second is a real instruction to go back to
 * the bundled defaults, and the repository acts on it.
 */
export async function fetchStudioPalette(key: StudioPaletteKey): Promise<StudioPaletteResult | null> {
  try {
    const response = await apiRequest<unknown>(`/studio-palette/${key}`);
    return normalizeStudioPaletteResponse(response, fallbackStudioPalette(key));
  } catch {
    return null;
  }
}
