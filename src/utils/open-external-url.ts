import { Linking } from 'react-native';

export async function openFirstAvailable(
  urls: readonly string[],
  open: (url: string) => Promise<unknown> = (url) => Linking.openURL(url)
): Promise<string | null> {
  for (const url of urls) {
    if (!url) continue;

    try {
      await open(url);
      return url;
    } catch (error) {
     
      if (__DEV__) {
        console.warn('[open-external-url] candidate failed', {
          url,
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return null;
}
