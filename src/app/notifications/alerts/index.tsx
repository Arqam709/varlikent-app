import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  deletePropertyAlert,
  describeAlert,
  getPropertyAlerts,
} from '@/features/property-alerts/property-alerts-api';
import { ApiError } from '@/services/api-client';
import type { PropertyAlert } from '@/types/property-alert';
import { formatPrice } from '@/utils/format-price';

/**
 * PROPERTY ALERTS  →  route "/notifications/alerts"
 *
 * Manage the saved descriptions of what a user is waiting for. Outside the
 * tabs, reached from the sliders icon in the Notifications header.
 *
 * Alerts describe which NEW properties are worth highlighting — they are not
 * a search over existing inventory. Browsing is what the Properties tab is
 * for, and saving an alert never turns the back catalogue into notifications.
 */

type LoadState = 'loading' | 'success' | 'error';

export default function PropertyAlertsScreen() {
  const router = useRouter();
  const { status, token } = useAuth();

  const [alerts, setAlerts] = useState<PropertyAlert[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) return;

    setLoadState('loading');
    try {
      setAlerts(await getPropertyAlerts(token));
      setLoadState('success');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
      );
      setLoadState('error');
    }
  }, [token]);

  /**
   * Reload on focus so returning from the create/edit form shows the change
   * without any shared state between the two screens.
   */
  useFocusEffect(
    useCallback(() => {
      if (status === 'authenticated') load();
    }, [status, load])
  );

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/notifications');
  };

  /**
   * Native Alert, not window.confirm — the latter does not exist in React
   * Native. Deleting an alert is destructive and unrecoverable, so it asks.
   */
  const confirmDelete = (alert: PropertyAlert) => {
    Alert.alert(
      'Delete alert?',
      `${describeAlert(alert)} will no longer be matched against new properties.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deletePropertyAlert(token, alert._id);
              // Optimistic removal; the focus reload reconciles anyway.
              setAlerts((current) => current.filter((a) => a._id !== alert._id));
            } catch (error) {
              Alert.alert(
                'Could not delete',
                error instanceof ApiError ? error.message : 'Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.charcoal} />
        </Pressable>
        <Text style={styles.headerTitle}>Property Alerts</Text>
      </View>

      {/*
        Direct navigation while signed out is possible via a deep link even
        though the Notifications gate normally comes first, so it is handled
        rather than assumed away.
      */}
      {status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.brandGreen} />
        </View>
      ) : status !== 'authenticated' ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>Sign in to manage alerts</Text>
          <Text style={styles.stateBody}>
            Property alerts are saved to your account.
          </Text>
          <Button
            label="Log In"
            variant="primary"
            onPress={() => router.push('/login')}
            style={styles.stretch}
          />
        </View>
      ) : loadState === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.brandGreen} />
        </View>
      ) : loadState === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>Unable to load alerts</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button label="Try Again" variant="primary" onPress={load} style={styles.stretch} />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text style={styles.eyebrow}>Property Updates</Text>
              <Text style={styles.introHeading}>
                Get notified about the properties you&apos;re actually looking for.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AlertCard
              alert={item}
              onEdit={() =>
                router.push({ pathname: '/notifications/alerts/edit', params: { id: item._id } })
              }
              onDelete={() => confirmDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Ionicons name="options-outline" size={28} color={Colors.brandGreen} />
              </View>
              <Text style={styles.stateHeading}>No property alerts yet</Text>
              <Text style={styles.stateBody}>
                Create an alert and we&apos;ll highlight new listings that match your search.
              </Text>
            </View>
          }
          ListFooterComponent={
            <Button
              label={alerts.length === 0 ? 'Create Alert' : 'Create New Alert'}
              variant="primary"
              onPress={() => router.push('/notifications/alerts/edit')}
              style={styles.create}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

/** One saved alert, with its criteria spelled out as removable-looking chips. */
function AlertCard({
  alert,
  onEdit,
  onDelete,
}: {
  alert: PropertyAlert;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const criteria: string[] = [];

  if (alert.listingType) criteria.push(alert.listingType === 'Rent' ? 'For Rent' : 'For Sale');
  if (alert.propertyType) criteria.push(alert.propertyType);
  if (alert.district) criteria.push(alert.district);
  if (alert.minBeds !== undefined) criteria.push(`${alert.minBeds}+ beds`);

  // Reuses the shared formatter so an alert's bounds read exactly like a
  // property price elsewhere in the app.
  if (alert.minPrice !== undefined && alert.maxPrice !== undefined) {
    criteria.push(
      `${formatPrice(alert.minPrice, 'Sale')} – ${formatPrice(alert.maxPrice, 'Sale')}`
    );
  } else if (alert.minPrice !== undefined) {
    criteria.push(`From ${formatPrice(alert.minPrice, 'Sale')}`);
  } else if (alert.maxPrice !== undefined) {
    criteria.push(`Up to ${formatPrice(alert.maxPrice, 'Sale')}`);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{describeAlert(alert)}</Text>

      <View style={styles.chips}>
        {criteria.map((text) => (
          <View key={text} style={styles.chip}>
            <Text style={styles.chipText}>{text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit alert: ${describeAlert(alert)}`}
          hitSlop={8}
          style={styles.cardAction}>
          <Ionicons name="create-outline" size={16} color={Colors.brandGreen} />
          <Text style={styles.cardActionText}>Edit</Text>
        </Pressable>

        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete alert: ${describeAlert(alert)}`}
          hitSlop={8}
          style={styles.cardAction}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={[styles.cardActionText, styles.deleteText]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.softWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.charcoal,
  },

  list: { padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 },
  intro: { marginBottom: Spacing.md },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: Colors.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  introHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: 26,
    color: Colors.charcoal,
    marginTop: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  cardTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: Colors.charcoal,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  chip: {
    backgroundColor: Colors.marble,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: Colors.brandGreen,
  },
  deleteText: { color: Colors.danger },

  create: { marginTop: Spacing.md },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: Colors.marble,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  stateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  stretch: { alignSelf: 'stretch', marginTop: Spacing.md },
});
