import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// One level deeper than before: this file moved into the (tabs) group, so the
// relative hop to the project root gained a `../`. The `@/` imports are alias
// based and were unaffected by the move.
import HomeDiscovery from '@/components/home/home-discovery';
import HomeFeaturedProperties from '@/components/home/home-featured-properties';
import HomeHero from '@/components/home/home-hero';
import HomeServicesPreview from '@/components/home/home-services-preview';
import { Colors, FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { getUnreadCount } from '@/features/notifications/notifications-api';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';


export default function HomeScreen() {
  const router = useRouter();
  const { status, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Refresh the badge whenever Home comes into focus.
   *
   * `useFocusEffect` covers every moment that matters — first mount, tabbing
   * back from Properties or Account, and returning from /notifications (where
   * the count should drop to zero) — without any polling. Depending on
   * `status` and `token` means it also re-runs when the user signs in or out.
   */
  useFocusEffect(
    useCallback(() => {
      // Anonymous users never see a count, and no request is made for them.
      if (status !== 'authenticated' || !token) {
        setUnreadCount(0);
        return;
      }

      let cancelled = false;
      getUnreadCount(token)
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        // A failed badge is not worth surfacing — Home must keep working.
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }, [status, token])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {/* ── Brand header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <VarlikentIcon width={26} height={24} />
            <Text style={styles.wordmark}>VARLIKENT</Text>
          </View>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications'
            }
            hitSlop={10}
            style={({ pressed }) => [styles.bell, pressed && styles.bellPressed]}>
            <Ionicons name="notifications-outline" size={22} color={Colors.charcoal} />

            {/* Never rendered for anonymous users — unreadCount stays 0. */}
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <HomeHero />
        <HomeDiscovery />
        <HomeFeaturedProperties />
        <HomeServicesPreview />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.softWhite,
  },
  /**
   * No horizontal padding here — that would inset the hero image and stop it
   * bleeding to the screen edges. Padding is applied per-section instead.
   */
  scroll: {
    flexGrow: 1,
    paddingBottom: Spacing.lg,
  },

  // ── Header ───────────────────────────────────────────────────────
  /** ~56dp tall: 24dp icon + 16dp padding top and bottom. */
  /** Brand on the left, bell on the right. */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wordmark: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.sm,
    color: Colors.charcoal,
    letterSpacing: 3,
  },
  /** `overflow: 'visible'` so the badge can sit proud of the icon. */
  bell: {
    padding: Spacing.xs,
    overflow: 'visible',
  },
  bellPressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    lineHeight: 12,
    color: Colors.primaryText,
  },

});
