import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeAboutContent, type AboutContent } from '@/features/about/about-content';

export const ABOUT_CONTENT_CACHE_KEY = 'varlikent_about_content_v1';

export async function readCachedAboutContent(): Promise<AboutContent | null> {
  try {
    const raw = await AsyncStorage.getItem(ABOUT_CONTENT_CACHE_KEY);
    if (!raw) return null;
    return normalizeAboutContent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeCachedAboutContent(content: AboutContent): Promise<void> {
  try {
    await AsyncStorage.setItem(ABOUT_CONTENT_CACHE_KEY, JSON.stringify(content));
  } catch {
    // Ignored on purpose — see the failure policy above.
  }
}
