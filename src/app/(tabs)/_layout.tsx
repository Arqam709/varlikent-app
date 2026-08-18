import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { FontFamily, FontSizes, LetterSpacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';

/**
 * TAB LAYOUT
 *
 * Four tabs: Home, Properties, Chats, Account.
 *
 * ── Why this file previously stayed white in every theme ────────────────
 * `screenOptions` read `Colors.navBg` — the STATIC Signature palette exported
 * from constants/theme, whose `navBg` is '#ffffff'. Because that binding never
 * changes, the bar rendered white under Dark Luxury, Heritage Navy and Forest
 * Green regardless of what the provider held. It now reads the ACTIVE palette
 * through `useTheme()`, so all four surfaces follow the theme:
 * background, active tint, inactive tint and the hairline separator.
 *
 * There is deliberately no per-theme branching here. One set of token lookups
 * covers all five themes, and a sixth theme would need no change to this file.
 *
 * ── Labels ──────────────────────────────────────────────────────────────
 * Titles come from `t()` rather than literals, so the bar translates with the
 * rest of the app. Expo Router re-renders this component when the language
 * context changes, so labels switch immediately without a remount.
 *
 * ── Direction ───────────────────────────────────────────────────────────
 * Tab ORDER is deliberately NOT reversed for Arabic. A bottom tab bar is a
 * fixed set of destinations rather than a line of text, and both iOS and
 * Android keep tab order stable in RTL locales; reversing it would move Home
 * out from under the user's thumb for no benefit. Only reading-order content
 * flips elsewhere in the app.
 */
export default function TabLayout() {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        // Each screen draws its own Varlikent header, so suppress the
        // navigator's default one.
        headerShown: false,

        // navActive / navInactive rather than primary / textMuted: the bar
        // draws on `navBg`, which is DARK in three of the five themes, and the
        // light-surface tokens measured 2.88:1 and 1.72:1 against it.
        tabBarActiveTintColor: theme.navActive,
        tabBarInactiveTintColor: theme.navInactive,

        tabBarStyle: {
          backgroundColor: theme.navBg,
          // A hairline rather than the platform default, matching the gold/
          // grey dividers used across the brand.
          borderTopWidth: 1,
          borderTopColor: theme.border,
          // Height and bottom inset are left to the navigator: it already
          // accounts for the home indicator / gesture bar via safe-area, and
          // hardcoding a height is what breaks tab bars on gesture-nav phones.
        },

        // Keeps the area behind a screen the theme's own ground, so a short
        // screen never reveals a white gap under a dark theme.
        sceneStyle: { backgroundColor: theme.background },

        tabBarLabelStyle: {
          fontFamily: FontFamily.bodyMedium,
          fontSize: FontSizes.xs,
          letterSpacing: LetterSpacing.normal,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          // Filled when active, outline when not — the standard iOS/Android
          // idiom, and it reads as intentional rather than a missing state.
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: t('tabs.properties'),
          // `business` reads as buildings/listings — the clearest fit in the
          // Ionicons set for a property catalogue.
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'business' : 'business-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: t('tabs.chats'),
          // The visible label is already "Chats"; this spells out the tab's
          // purpose for a screen reader, which reads the label alone as bare.
          tabBarAccessibilityLabel: t('tabs.chatsAccessibility'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
