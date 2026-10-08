import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/button';
import TextField from '@/components/ui/text-field';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { chooseRoomPhoto, takeRoomPhoto, type PickOutcome, type PickedRoomPhoto } from '@/features/design-my-space/room-photo-picker';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import ChoiceGrid from '@/features/service-requests/components/choice-grid';
import {
  BUDGETS,
  MAX_REQUEST_PHOTOS,
  PROPERTY_TYPES,
  TIMELINES,
  type RequestOption,
} from '@/features/service-requests/service-request-options';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * The step bodies shared by the RENOVATION PLANNER and the REQUEST STAGE.
 *
 * Planning and requesting are separate intentions with separate screens, but
 * the questions they share — the property, a budget and timing, photos of the
 * space — are asked with the same components, so the two can never drift.
 */

export function StepHeading({ title, body }: { title: string; body: string }) {
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();
  return (
    <View style={styles.stepHeading}>
      <Text style={[styles.stepTitle, { textAlign }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.body, { textAlign }]}>{body}</Text>
    </View>
  );
}

export function PropertyStep({
  propertyType,
  sizeSqm,
  district,
  onChange,
}: {
  propertyType: string | null;
  sizeSqm: string;
  district: string;
  onChange: (patch: { propertyType?: string; sizeSqm?: string; district?: string }) => void;
}) {
  const { t } = useLanguage();
  return (
    <>
      <StepHeading title={t('serviceRequests.steps.property')} body={t('serviceRequests.steps.propertyBody')} />
      <ChoiceGrid
        options={PROPERTY_TYPES}
        group="propertyTypes"
        selected={propertyType ? [propertyType] : []}
        onToggle={(id) => onChange({ propertyType: id })}
      />
      <TextField
        label={t('serviceRequests.fields.sizeOptional')}
        value={sizeSqm}
        onChangeText={(value) => onChange({ sizeSqm: value.replace(/[^0-9.,]/g, '').slice(0, 7) })}
        placeholder={t('serviceRequests.fields.sizePlaceholder')}
        keyboardType="numeric"
      />
      <TextField
        label={t('serviceRequests.fields.districtOptional')}
        value={district}
        onChangeText={(value) => onChange({ district: value.slice(0, 80) })}
        placeholder={t('serviceRequests.fields.districtPlaceholder')}
        autoCapitalize="words"
      />
    </>
  );
}

export function MultiChoiceStep({
  title,
  body,
  options,
  group,
  selected,
  onToggle,
}: {
  title: string;
  body: string;
  options: readonly RequestOption[];
  group: string;
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <StepHeading title={title} body={body} />
      <ChoiceGrid options={options} group={group} selected={selected} multiple onToggle={onToggle} />
    </>
  );
}

export function BudgetStep({
  budget,
  timeline,
  onChange,
}: {
  budget: string | null;
  timeline: string | null;
  onChange: (patch: { budget?: string; timeline?: string }) => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();
  return (
    <>
      <StepHeading title={t('serviceRequests.steps.budget')} body={t('serviceRequests.steps.budgetBody')} />
      <ChoiceGrid options={BUDGETS} group="budgets" selected={budget ? [budget] : []} onToggle={(id) => onChange({ budget: id })} />
      <Text style={[styles.subheading, { textAlign }]}>{t('serviceRequests.fields.timeline')}</Text>
      <ChoiceGrid
        options={TIMELINES}
        group="timelines"
        selected={timeline ? [timeline] : []}
        onToggle={(id) => onChange({ timeline: id })}
      />
    </>
  );
}

type PhotoLike = { uri: string };

/**
 * Photos of the space as it is today: camera or library, up to the request
 * limit, each removable. The pick itself reuses Design My Space's picker
 * (resized and compressed on the device before anything is uploaded).
 */
export function PhotosStep<T extends PhotoLike>({
  body,
  photos,
  disabled = false,
  onAdd,
  onRemove,
  onUnavailable,
}: {
  body: string;
  photos: readonly T[];
  disabled?: boolean;
  onAdd: (photo: PickedRoomPhoto) => void;
  onRemove: (uri: string) => void;
  /** A photo whose file is gone (the OS cleared the cache) — drop it. */
  onUnavailable?: (uri: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { textAlign, row } = useDirection();
  const full = photos.length >= MAX_REQUEST_PHOTOS;

  const add = async (pick: () => Promise<PickOutcome>) => {
    if (full) return;
    try {
      const outcome = await pick();
      if (outcome.type === 'permission-denied') {
        Alert.alert(t('serviceRequests.photos.title'), t('serviceRequests.photos.permissionDenied'));
        return;
      }
      if (outcome.type === 'picked') onAdd(outcome.photo);
    } catch {
      Alert.alert(t('serviceRequests.photos.title'), t('serviceRequests.photos.pickFailed'));
    }
  };

  return (
    <>
      <StepHeading title={t('serviceRequests.steps.photos')} body={body} />
      {photos.length > 0 ? (
        <View style={[styles.photoGrid, { flexDirection: row }]}>
          {photos.map((photo, index) => (
            <View key={photo.uri} style={styles.photoTile}>
              <Image
                source={{ uri: photo.uri }}
                contentFit="cover"
                style={styles.photoImage}
                onError={() => onUnavailable?.(photo.uri)}
                accessibilityLabel={t('serviceRequests.photos.photoA11y', { n: String(index + 1) })}
              />
              <Pressable
                onPress={() => onRemove(photo.uri)}
                accessibilityRole="button"
                accessibilityLabel={t('serviceRequests.photos.remove', { n: String(index + 1) })}
                hitSlop={8}
                disabled={disabled}
                style={styles.photoRemove}>
                <Ionicons name="close" size={16} color={theme.textOnDark} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.muted, { textAlign }]}>
        {t('serviceRequests.photos.count', { count: String(photos.length), max: String(MAX_REQUEST_PHOTOS) })}
      </Text>
      <Button
        label={t('serviceRequests.photos.take')}
        variant="secondary"
        onPress={() => void add(takeRoomPhoto)}
        disabled={full || disabled}
        icon={<Ionicons name="camera-outline" size={18} color={theme.primaryInk} />}
        style={styles.stretch}
      />
      <Button
        label={t('serviceRequests.photos.choose')}
        variant="secondary"
        onPress={() => void add(chooseRoomPhoto)}
        disabled={full || disabled}
        icon={<Ionicons name="images-outline" size={18} color={theme.primaryInk} />}
        style={styles.stretch}
      />
      <Text style={[styles.muted, { textAlign }]}>{t('serviceRequests.photos.privacy')}</Text>
    </>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    stepHeading: { gap: Spacing.xs, marginTop: Spacing.sm },
    stepTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: FontSizes.lg, color: theme.text },
    subheading: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.md,
      color: theme.text,
      marginTop: Spacing.sm,
    },
    body: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, lineHeight: 22, color: theme.textMuted },
    muted: { fontFamily: FontFamily.body, fontSize: FontSizes.xs, lineHeight: 18, color: theme.textMuted },
    stretch: { alignSelf: 'stretch' },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    photoTile: {
      width: '31%',
      aspectRatio: 1,
      borderRadius: Radius.md,
      overflow: 'hidden',
      backgroundColor: theme.marble,
    },
    photoImage: { width: '100%', height: '100%' },
    photoRemove: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 26,
      height: 26,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(30,30,28,0.7)',
    },
  });
