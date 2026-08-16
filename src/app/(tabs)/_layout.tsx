import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { Colors, FontFamily, FontSizes, LetterSpacing } from '@/constants/theme';

/**
 * TAB LAYOUT
 *
 * Wraps every route in the `(tabs)` group with the bottom tab bar. Screens
 * OUTSIDE this group — Login and Register in `(auth)` — get no tab bar,
 * because the root Stack pushes them on top of this whole navigator.
 *
 * Four tabs: Home, Properties, Chats, Account. Order is set by the order of
 * the <Tabs.Screen> children below. No placeholder for Favourites — an empty
 * tab is worse than an absent one.
 *
 * "Chats" is deliberately not "Messages": that word belongs to the agent
 * website portal, and the customer-facing label should read the way a person
 * would describe it on their phone.
 *
 * Icons come from @expo/vector-icons, already a dependency of every Expo
 * project — nothing new installed for this.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // Each screen draws its own Varlikent header, so suppress the
        // navigator's default one.
        headerShown: false,
        tabBarActiveTintColor: Colors.brandGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.navBg,
          // A hairline rather than the platform default, matching the gold/
          // grey dividers used across the brand.
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          // Height and bottom inset are left to the navigator: it already
          // accounts for the home indicator / gesture bar via safe-area, and
          // hardcoding a height is what breaks tab bars on gesture-nav phones.
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.bodyMedium,
          fontSize: FontSizes.xs,
          letterSpacing: LetterSpacing.normal,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
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
          title: 'Properties',
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
          title: 'Chats',
          // The visible label is already "Chats"; this spells out the tab's
          // purpose for a screen reader, which reads the label alone as bare.
          tabBarAccessibilityLabel: 'Chats, your property conversations',
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
          title: 'Account',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
