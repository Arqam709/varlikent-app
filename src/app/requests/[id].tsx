import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import StatusBadge from '@/features/service-requests/components/status-badge';
import SummaryCard from '@/features/service-requests/components/summary-card';
import {
  serviceRequestTypeKey,
  type ServiceRequest,
  type ServiceRequestPhoto,
} from '@/features/service-requests/service-request';
import { fetchServiceRequest, serviceRequestPhotoSource } from '@/features/service-requests/service-request-api';
import {
  designSnapshotRows,
  requestDetailRows,
  requestHeadline,
} from '@/features/service-requests/service-request-presentation';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';
import { formatShortDate } from '@/utils/format-short-date';

/**
 * ONE REQUEST, as its owner sees it.
 *
 * Everything shown is what was submitted — the design is the snapshot taken at
 * submission and the images are the request's own copies, so a board edited or
 * deleted since, or a room photo that has expired, changes nothing here.
 * Images come from the owner-only API endpoint with the Bearer token.
 */

export default function ServiceRequestDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; submitted?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const justSubmitted = params.submitted === '1';

  const router = useRouter();
  const { t, language } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { textAlign, row } = useDirection();
  const { token, status } = useAuth();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const loadRef = useRef(0);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/requests');
  };

  const load = useCallback(async () => {
    if (!token || !id) return;
    const load = ++loadRef.current;
    try {
      const result = await fetchServiceRequest(token, id);
      if (loadRef.current !== load) return;
      setRequest(result);
      setState('ready');
    } catch (error) {
      if (loadRef.current !== load) return;
      setState(error instanceof ApiError && error.status === 404 ? 'missing' : 'error');
    }
  }, [token, id]);

  // Refetched on focus: the status follows the lead, which staff may update.
  useFocusEffect(
    useCallback(() => {
      if (status === 'authenticated') void load();
    }, [status, load])
  );

  if (state !== 'ready' || !request || !token) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('requests.detailTitle')} onBack={leave} />
        <View style={styles.centered}>
          {state === 'loading' ? (
            <ActivityIndicator color={theme.primaryInk} />
          ) : (
            <>
              <Text style={styles.stateTitle}>
                {t(state === 'missing' ? 'requests.missing' : 'requests.loadError')}
              </Text>
              {state === 'error' ? <Button label={t('common.retry')} onPress={() => void load()} style={styles.stretch} /> : null}
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const designImages = request.photos.filter((photo) => photo.kind !== 'customer');
  const customerPhotos = request.photos.filter((photo) => photo.kind === 'customer');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t(serviceRequestTypeKey(request.type))} onBack={leave} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {justSubmitted ? (
          <View style={[styles.success, { flexDirection: row }]} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={22} color={theme.primaryInk} />
            <Text style={[styles.successText, { textAlign }]}>{t('serviceRequests.submittedBody')}</Text>
          </View>
        ) : null}

        <View style={styles.headerBlock}>
          <Text style={[styles.headline, { textAlign }]}>{requestHeadline(t, request)}</Text>
          <View style={[styles.metaRow, { flexDirection: row }]}>
            <StatusBadge status={request.status} />
            <Text style={styles.meta}>{formatShortDate(request.createdAt, language)}</Text>
          </View>
          <Text style={[styles.statusNote, { textAlign }]}>{t(`serviceRequests.statusNotes.${request.status}`)}</Text>
        </View>

        {request.design ? (
          <View style={styles.section}>
            {designImages.map((photo) => (
              <RequestImage key={photo.id} token={token} requestId={request.id} photo={photo} />
            ))}
            <SummaryCard title={t('serviceRequests.designTitle')} rows={designSnapshotRows(t, request.design.snapshot)} />
          </View>
        ) : null}

        <SummaryCard
          title={t('serviceRequests.detailsTitle')}
          rows={requestDetailRows(t, {
            type: request.type,
            propertyType: request.property.type,
            sizeSqm: request.property.sizeSqm,
            district: request.property.district,
            rooms: request.rooms,
            areas: request.areas,
            work: request.work,
            budget: request.budget,
            timeline: request.timeline,
            notes: request.notes,
          })}
        />

        {customerPhotos.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign }]}>{t('serviceRequests.fields.photos')}</Text>
            {customerPhotos.map((photo) => (
              <RequestImage key={photo.id} token={token} requestId={request.id} photo={photo} />
            ))}
          </View>
        ) : null}

        <SummaryCard
          title={t('serviceRequests.contactTitle')}
          rows={[
            [t('contact.nameLabel'), request.contact.name],
            [t('contact.emailFieldLabel'), request.contact.email],
            [t('contact.phoneFieldLabel'), request.contact.phone],
          ]}
        />
        <Text style={[styles.meta, { textAlign }]}>{t('serviceRequests.referenceId', { id: request.id })}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestImage({ token, requestId, photo }: { token: string; requestId: string; photo: ServiceRequestPhoto }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const { textAlign } = useDirection();
  const [failed, setFailed] = useState(false);

  const caption = t(`serviceRequests.photoKinds.${photo.kind}`);
  return (
    <View style={styles.imageBlock}>
      <Text style={[styles.imageCaption, { textAlign }]}>{caption}</Text>
      {failed ? (
        <Text style={[styles.meta, { textAlign }]}>{t('serviceRequests.photoUnavailable')}</Text>
      ) : (
        <Image
          source={serviceRequestPhotoSource(token, requestId, photo.id)}
          cachePolicy="none"
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          style={[styles.image, { aspectRatio: photo.width / photo.height }]}
          accessibilityLabel={caption}
        />
      )}
    </View>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.softWhite },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    stretch: { alignSelf: 'stretch' },
    stateTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.lg, color: theme.text, textAlign: 'center' },
    scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
    success: {
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: theme.marble,
      borderWidth: 1,
      borderColor: theme.primaryInk,
    },
    successText: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSizes.sm, lineHeight: 20, color: theme.text },
    headerBlock: { gap: Spacing.xs },
    headline: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.lg, color: theme.text },
    metaRow: { alignItems: 'center', gap: Spacing.sm },
    meta: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, color: theme.textMuted },
    statusNote: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, lineHeight: 20, color: theme.textMuted },
    section: { gap: Spacing.sm },
    sectionTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.md, color: theme.text },
    imageBlock: { gap: Spacing.xs },
    imageCaption: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.overline,
      letterSpacing: LetterSpacing.wide,
      textTransform: 'uppercase',
      color: theme.textMuted,
    },
    image: { width: '100%', borderRadius: Radius.md, backgroundColor: theme.marble },
  });
