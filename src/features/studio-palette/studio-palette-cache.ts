import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeCachedPalette,
  type StudioPalette,
  type StudioPaletteKey,
} from '@/features/studio-palette/studio-palette';
import { fallbackStudioPalette } from '@/features/studio-palette/studio-palette-fallback';


const CACHE_PREFIX = 'varlikent_studio_palette_v1';

export const studioPaletteCacheKey = (key: StudioPaletteKey): string => `${CACHE_PREFIX}:${key}`;

export async function readCachedStudioPalette(key: StudioPaletteKey): Promise<StudioPalette | null> {
  try {
    const raw = await AsyncStorage.getItem(studioPaletteCacheKey(key));
    if (!raw) return null;
    // Validated on READ as well as on write: a cache written by an older build
    // (or corrupted on disk) must never reach the screen unchecked.
    return normalizeCachedPalette(JSON.parse(raw), fallbackStudioPalette(key));
  } catch {
    return null;
  }
}

export async function writeCachedStudioPalette(key: StudioPaletteKey, palette: StudioPalette): Promise<void> {
  try {
    await AsyncStorage.setItem(studioPaletteCacheKey(key), JSON.stringify(palette));
  } catch {
    // A device that cannot cache still works; it just refetches next time.
  }
}

/** Called when the server reports no override exists. */
export async function clearCachedStudioPalette(key: StudioPaletteKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(studioPaletteCacheKey(key));
  } catch {
    // Ignored: the repository has already stopped showing the stale palette in
    // memory, so the worst case is one stale read on the next cold start,
    // which the next successful request corrects again.
  }
}
