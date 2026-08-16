/**
 * METRO CONFIGURATION
 *
 * Metro is React Native's bundler — the rough equivalent of Vite on the
 * website. Until now the project had no metro.config.js at all, because Expo's
 * defaults were fine. This file exists for exactly one reason: to let us
 * `import` an .svg file and get back a React component.
 *
 * Web equivalent: adding a plugin to vite.config.js so `import Logo from
 * './logo.svg?react'` works.
 */

const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  // Start from Expo's defaults rather than a blank config, so we keep
  // everything Expo Router / expo-font / the asset pipeline rely on.
  const config = getDefaultConfig(__dirname);
  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    // Run .svg files through the transformer, which turns the XML into React
    // component source code built on react-native-svg. The `/expo` entry point
    // is the Expo-specific build of that transformer.
    babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
  };

  config.resolver = {
    ...resolver,
    // Metro sorts every file into one of two buckets. `assetExts` files are
    // copied into the app as opaque binaries (this is how our .ttf fonts and
    // .png images work). `sourceExts` files are parsed and transformed as code.
    //
    // `svg` starts in assetExts, so these two lines MOVE it across:
    //   1. remove svg from the "binary blob" list ...
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    //   2. ... and add it to the "this is source code" list.
    // Without both, the import silently returns a number (the asset handle)
    // instead of a component, and rendering it fails.
    sourceExts: [...resolver.sourceExts, 'svg'],
  };

  return config;
})();
