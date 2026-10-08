import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import StatusBadge from '@/features/service-requests/components/status-badge';
import {
  serviceRequestTypeKey,
  type ServiceRequest,
  type ServiceRequestType,
} from '@/features/service-requests/service-request';
import { fetchServiceRequests } from '@/features/service-requests/service-request-api';
import { requestHeadline } from '@/features/service-requests/service-request-presentation';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { formatShortDate } from '@/utils/format-short-date';

/**
 * MY REQUESTS (Account → My Requests) — Interior Design and Renovation
 * together, newest first.
 *
 * History, not a place to start something: new requests are made FROM a
 * design (Design My Space) or a plan (the renovation planner), on the service
 * pages. One list rather than one per type — a customer thinks "what have I
 * asked Varlikent for", not "which form did I use"; a type filter appears only
 * when there is more than one type to filter. The status on each row comes
 * from the server, which derives it from the lead Varlikent staff work in.
 */

type Filter = 'all' | ServiceRequestType;

export default function MyRequestsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row } = useDirection();
  const { token, status } = useAuth();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const loadRef = useRef(0);
  /** After the first successful load, returning to the screen refreshes silently. */
  const hasLoadedRef = useRef(false);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!token) return;
      const load = ++loadRef.current;
      if (mode === 'refresh') setRefreshing(true);
      try {
        const list = await fetchServiceRequests(token);
        if (loadRef.current !== load) return;
        setRequests(list);
        setState('ready');
        hasLoadedRef.current = true;
      } catch {
        // A failed refresh keeps the list already on screen.
        if (loadRef.current === load) setState((current) => (current === 'ready' ? current : 'error'));
      } finally {
        setRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      if (status === 'authenticated') void load(hasLoadedRef.current ? 'silent' : 'initial');
    }, [status, load])
  );

  const types = useMemo(() => new Set(requests.map((request) => request.type)), [requests]);
  const visible = filter === 'all' ? requests : requests.filter((request) => request.type === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('requests.title')} onBack={leave} />

      {state === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primaryInk} />
        </View>
      ) : state === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{t('requests.loadError')}</Text>
          <Button label={t('common.retry')} onPress={() => void load('initial')} style={styles.stretch} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(request) => request.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load('refresh')}
              tintColor={theme.brandGreen}
              colors={[theme.primaryInk]}
            />
          }
          ListHeaderComponent={
            types.size > 1 ? (
              <View style={[styles.filters, { flexDirection: row }]}>
                {(['all', 'interior_design', 'renovation'] as const).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setFilter(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: filter === value }}
                    style={[styles.filter, filter === value && styles.filterSelected]}>
                    <Text style={[styles.filterText, filter === value && styles.filterTextSelected]}>
                      {value === 'all' ? t('common.all') : t(serviceRequestTypeKey(value))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={32} color={theme.primaryInk} />
              <Text style={styles.emptyTitle}>{t('requests.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('requests.emptyBody')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <RequestRow
              request={item}
              onPress={() => router.push({ pathname: '/requests/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RequestRow({ request, onPress }: { request: ServiceRequest; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { row, textAlign, forwardIcon } = useDirection();

  const type = t(serviceRequestTypeKey(request.type));
  const headline = requestHeadline(t, request);
  const date = formatShortDate(request.createdAt, language);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[type, headline, date].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.row, { flexDirection: row }, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <Ionicons
          name={request.type === 'renovation' ? 'hammer-outline' : 'color-palette-outline'}
          size={20}
          color={theme.primaryInk}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowType, { textAlign }]}>{type}</Text>
        <Text style={[styles.rowTitle, { textAlign }]} numberOfLines={2}>
          {headline}
        </Text>
        <View style={[styles.rowMeta, { flexDirection: row }]}>
          <StatusBadge status={request.status} />
          {date ? <Text style={styles.rowDate}>{date}</Text> : null}
        </View>
      </View>
      <Ionicons name={forwardIcon} size={18} color={theme.textMuted} />
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.softWhite },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
    stretch: { alignSelf: 'stretch', marginTop: Spacing.sm },
    filters: { gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.xs },
    filter: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      minHeight: 36,
      justifyContent: 'center',
    },
    filterSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
    filterText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSizes.sm, color: theme.text },
    filterTextSelected: { color: theme.primaryText },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
    emptyTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.lg, color: theme.text, textAlign: 'center' },
    emptyBody: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      lineHeight: 22,
      color: theme.textMuted,
      textAlign: 'center',
    },
    row: {
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    rowPressed: { backgroundColor: theme.marble },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.marble,
    },
    rowBody: { flex: 1, gap: 4 },
    rowType: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.overline,
      letterSpacing: LetterSpacing.wide,
      textTransform: 'uppercase',
      color: theme.primaryInk,
    },
    rowTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.md, color: theme.text },
    rowMeta: { alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
    rowDate: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: theme.textMuted },
  });
