import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSizes, Spacing } from '@/constants/theme';

/**
 * PLACEHOLDER HOME SCREEN
 *
 * `index.tsx` is the route for `/`, exactly like `index.html` or an index
 * route in React Router. Because it sits directly in `src/app/`, it is the
 * first screen the app opens on.
 *
 * This screen exists only to prove the new structure boots. It will be
 * replaced once we have real screens.
 *
 * Two things worth noticing, because they are the core web -> native shift:
 *
 *   1. `<View>` replaces `<div>` and `<Text>` replaces `<p>` / `<span>`.
 *      Unlike the web, text CANNOT be a direct child of a View — every string
 *      must be inside a `<Text>`, or React Native throws at runtime.
 *
 *   2. Styles are JavaScript objects, not CSS. There are no classes and no
 *      cascade: a style set on a parent View is NOT inherited by children.
 *      Also note `flex: 1` — in React Native every View is already flexbox
 *      with `flexDirection: 'column'` by default, so layout starts from
 *      flexbox rather than from block/inline.
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Varlikent</Text>
      <Text style={styles.subtitle}>Project structure ready.</Text>
    </View>
  );
}

/**
 * `StyleSheet.create` validates the style keys at build time and gives better
 * autocomplete than a bare object. Defining it outside the component means the
 * object is created once, not on every render.
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.light.textMuted,
  },
});
