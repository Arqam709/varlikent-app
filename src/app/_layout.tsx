import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * ROOT LAYOUT
 *
 * Expo Router renders this component around EVERY screen in the app.
 * A file named `_layout.tsx` is not a screen itself — it is the wrapper for
 * all routes that sit beside it or below it in the folder tree.
 *
 * Web equivalent: the component that holds `<BrowserRouter>` plus whatever
 * global providers you wrap `<App />` in — or a layout route in React Router.
 *
 * `<Stack>` is the navigator. On mobile, screens are pushed onto a stack and
 * popped off, which is what produces the native slide animation and the
 * hardware back button / swipe-back gesture. There is no browser URL bar and
 * no browser history, so this stack IS the history.
 *
 * Later this file becomes the most important file in the app: the AuthProvider
 * (Step 6) wraps the navigator here, and the `<Stack.Protected>` guards
 * (Step 7) live here too. For now it stays deliberately bare.
 */
export default function RootLayout() {
  return (
    <>
      <Stack />
      <StatusBar style="auto" />
    </>
  );
}
