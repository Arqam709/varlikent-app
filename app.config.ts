
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  const plugins: NonNullable<ExpoConfig['plugins']> = [
    ...(config.plugins ?? []),
    'react-native-nitro-google-signin',
  ];

  if (mapsKey) {
    plugins.push([
      'react-native-maps',
      {
        androidGoogleMapsApiKey: mapsKey,
      },
    ]);
  } else {
    plugins.push('react-native-maps');
  }

  return {
    ...config,
    name: config.name ?? 'Varlikent',
    slug: config.slug ?? 'varlikent-app',
    plugins,
  };
};
