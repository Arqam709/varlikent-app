import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { useAuth } from '@/features/auth/auth-context';
import {
  getNotifications,
  markNotificationsSeen,
} from '@/features/notifications/notifications-api';
import { ApiError } from '@/services/api-client';
import type { PropertyNotification } from '@/types/notification';
import { formatPrice } from '@/utils/format-price';
import { getPropertyImages } from '@/utils/property-images';
import VarlikentIcon from '../../../assets/brand/varlikent_icon_01.svg';

/**
 * NOTIFICATIONS  →  route "/notifications"
 *
 * Outside the (tabs) group, like /services and /properties/[id], so it pushes
 * over the tab bar rather than becoming a fourth tab.
 *
 * The bell always navigates here regardless of auth state — this screen, not
 * the bell, decides what to show. That keeps one navigation path and puts the
 * sign-in invitation somewhere a logged-out user can actually read it.
 */

type LoadState = 'loading' | 'success' | 'error';

/** All New = every unseen property. Matches = the subset matching an alert. */
type Tab = 'all' | 'matches';

export default function NotificationsScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const router = useRouter();
  const { status, token } = useAuth();

  const [notifications, setNotifications] = useState<PropertyNotification[]>([]);
  /** Ids the SERVER decided match an active alert — never recomputed here. */
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [tab, setTab] = useState<Tab>('all');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) return;

    setLoadState('loading');
    try {
      const feed = await getNotifications(token);
      setNotifications(feed.notifications);
      setMatchedIds(feed.matchedPropertyIds);
      setAlertCount(feed.alertCount);
      setLoadState('success');
      if (feed.notifications.length > 0) {
        markNotificationsSeen(token, feed.snapshotAt).catch(() => {});
      }
    } catch (error) {
      // A notification failure must never sign the user out.
      setErrorMessage(
        error instanceof ApiError ? error.message : t('common.somethingWentWrong')
      );
      setLoadState('error');
    }
  }, [token, t]);

  useEffect(() => {
    // Only authenticated users hit the API. A logged-out visitor sees the
    // gate below without any request being made.
    if (status === 'authenticated') load();
  }, [status, load]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={10}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={theme.charcoal} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>

        {/* Manage alerts, only useful once signed in. */}
        {status === 'authenticated' ? (
          <Pressable
            onPress={() => router.push('/notifications/alerts')}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.manageAccessibility')}
            hitSlop={10}
            style={styles.manageButton}>
            <Ionicons name="options-outline" size={20} color={theme.charcoal} />
          </Pressable>
        ) : null}
      </View>

      {status === 'loading' ? (
        // Session restore still running — showing the sign-in gate here would
        // briefly accuse a signed-in user of being logged out.
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGreen} />
        </View>
      ) : status !== 'authenticated' ? (
        <SignInGate
          onLogin={() => router.push('/login')}
          onRegister={() => router.push('/register')}
        />
      ) : loadState === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGreen} />
        </View>
      ) : loadState === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>{t('notifications.loadError')}</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button label="Try Again" variant="primary" onPress={load} style={styles.stretch} />
        </View>
      ) : (
        <>
          <View style={styles.segmented}>
            <SegmentButton
              label={t('notifications.filterAll')}
              count={notifications.length}
              active={tab === 'all'}
              onPress={() => setTab('all')}
            />
            <SegmentButton
              label={t('notifications.filterMatches')}
              count={matchedIds.length}
              active={tab === 'matches'}
              onPress={() => setTab('matches')}
            />
          </View>

          <FlatList
            data={
              tab === 'all'
                ? notifications
                : notifications.filter((item) => matchedIds.includes(item._id))
            }
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <NotificationRow
                notification={item}
                // Matched rows carry a quiet marker; the row is otherwise
                // identical in both tabs.
                matched={tab === 'all' && matchedIds.includes(item._id)}
                onPress={() =>
                  router.push({ pathname: '/properties/[id]', params: { id: item._id } })
                }
              />
            )}
            ListEmptyComponent={
              // Three different empty states, each with the advice that fits.
              // None of them is an error.
              tab === 'matches' ? (
                alertCount === 0 ? (
                  <View style={styles.centered}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="options-outline" size={28} color={theme.brandGreen} />
                    </View>
                    <Text style={styles.stateHeading}>{t('notifications.noAlertsTitle')}</Text>
                    <Text style={styles.stateBody}>
                      Create an alert and we&apos;ll highlight new listings that match your search.
                    </Text>
                    <Button
                      label={t('notifications.createAlert')}
                      variant="primary"
                      onPress={() => router.push('/notifications/alerts/edit')}
                      style={styles.stretch}
                    />
                  </View>
                ) : (
                  <View style={styles.centered}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="options-outline" size={28} color={theme.brandGreen} />
                    </View>
                    <Text style={styles.stateHeading}>{t('notifications.emptyMatches')}</Text>
                    <Text style={styles.stateBody}>
                      We&apos;ll highlight new properties that fit your saved alerts.
                    </Text>
                    <Button
                      label={t('notifications.manageAlerts')}
                      variant="secondary"
                      onPress={() => router.push('/notifications/alerts')}
                      style={styles.stretch}
                    />
                  </View>
                )
              ) : (
                <View style={styles.centered}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="notifications-outline" size={28} color={theme.brandGreen} />
                  </View>
                  <Text style={styles.stateHeading}>You&apos;re up to date</Text>
                  <Text style={styles.stateBody}>{t('notifications.emptyAll')}</Text>
                  <Button
                    label={t('chats.browseProperties')}
                    variant="secondary"
                    onPress={() => router.push('/properties')}
                    style={styles.stretch}
                  />
                </View>
              )
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

/** One half of the All New / Matches control, with its live count. */
function SegmentButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${count}`}
      style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label} {count > 0 ? `(${count})` : ''}
      </Text>
    </Pressable>
  );
}

/* ─────────────────────── Logged-out gate ─────────────────────── */

function SignInGate({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-outline" size={28} color={theme.brandGreen} />
      </View>

      <Text style={styles.gateEyebrow}>{t('notifications.eyebrow')}</Text>
      <Text style={styles.stateHeading}>{t('notifications.neverMiss')}</Text>
      <Text style={styles.stateBody}>
        Sign in or create an account to get updates when new properties are added to Varlikent.
      </Text>

      {/* Reuses the existing auth routes — no duplicate auth UI. */}
      <View style={styles.gateActions}>
        <Button label={t('common.signIn')} variant="primary" onPress={onLogin} />
        <Button label={t('common.createAccount')} variant="secondary" onPress={onRegister} />
      </View>
    </View>
  );
}

/* ─────────────────────── Notification row ─────────────────────── */

/**
 * "2h ago" / "3d ago" — relative time reads better than a date in a feed.
 *
 * `t` is a PARAMETER rather than a hook call: this is a plain helper, not a
 * component, so it cannot use useLanguage(). Passing it keeps the function pure
 * and still fully translated.
 */
function relativeTime(iso: string, t: (key: string, vars?: Record<string, string>) => string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return t('notifications.justNow');
  if (minutes < 60) return t('notifications.minutesAgo', { n: String(minutes) });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.hoursAgo', { n: String(hours) });

  const days = Math.floor(hours / 24);
  if (days < 30) return t('notifications.daysAgo', { n: String(days) });

  return new Date(then).toLocaleDateString();
}

function NotificationRow({
  notification,
  matched = false,
  onPress,
}: {
  notification: PropertyNotification;
  /** Shows the alert marker in the All New tab. Redundant inside Matches. */
  matched?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  // Same resolver as the list and detail screens — no stock photos, and the
  // brand mark stands in when a listing has no photography.
  const imageUrl = getPropertyImages(notification)[0] ?? null;
  const isRent = notification.listingType === 'Rent';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`New property listed. ${notification.title}, ${formatPrice(
        notification.price,
        notification.listingType,
        notification.priceLabel
      )}, ${notification.district}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.thumb}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbImage}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <VarlikentIcon width={24} height={22} opacity={0.18} />
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.kicker}>
            {matched ? 'Matches your alert' : 'New property listed'}
          </Text>
          <Text style={styles.time}>{relativeTime(notification.createdAt, t)}</Text>
        </View>

        <Text style={styles.price}>
          {formatPrice(notification.price, notification.listingType, notification.priceLabel)}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {notification.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {notification.district}, Istanbul · {isRent ? 'For Rent' : 'For Sale'}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.charcoal,
    // Pushes the manage-alerts icon to the right edge.
    flex: 1,
  },
  manageButton: { padding: Spacing.xs },

  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.marble,
    borderRadius: Radius.full,
    padding: 3,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  segmentActive: { backgroundColor: theme.brandGreen },
  segmentText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },
  segmentTextActive: { fontFamily: FontFamily.bodySemiBold, color: theme.primaryText },

  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  stretch: { alignSelf: 'stretch', marginTop: Spacing.md },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  gateEyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  gateActions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.lg },
  stateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.charcoal,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  rowPressed: { borderColor: theme.brandGreen, backgroundColor: theme.marble },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.marble,
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /** `flex: 1` lets long titles wrap instead of pushing the row wider. */
  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  kicker: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.brandGreen,
  },
  time: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
  price: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: theme.navy,
    marginTop: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.sm,
    lineHeight: 18,
    color: theme.charcoal,
    marginTop: 2,
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    marginTop: Spacing.xs,
  },
});
