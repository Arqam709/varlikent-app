import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { useAuth } from '@/features/auth/auth-context';
import { getPropertyAreas } from '@/features/properties/properties-api';
import {
  createPropertyAlert,
  getPropertyAlerts,
  updatePropertyAlert,
} from '@/features/property-alerts/property-alerts-api';
import { ApiError } from '@/services/api-client';
import type { ListingType, PropertyArea, PropertyType } from '@/types/property';
import type { PropertyAlertInput } from '@/types/property-alert';

/**
 * CREATE / EDIT ALERT  →  route "/notifications/alerts/edit"
 *
 * ONE screen for both. Passing `?id=` loads that alert and saves with PATCH;
 * without it the form starts blank and saves with POST. Two separate screens
 * would be two copies of the same form drifting apart.
 */

/** Full backend enum, not just the types currently in inventory. */
const PROPERTY_TYPES: PropertyType[] = [
  'Apartment', 'Villa', 'Penthouse', 'Duplex', 'Studio', 'Office',
  'Commercial', 'Land', 'Shop', 'Warehouse', 'Hotel', 'Farm',
];

/** A MINIMUM, unlike the properties filter's exact bedroom count. */
const BED_OPTIONS = [1, 2, 3, 4, 5];

export default function EditAlertScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status, token } = useAuth();

  const isEditing = Boolean(id);

  const [listingType, setListingType] = useState<ListingType | undefined>();
  const [propertyType, setPropertyType] = useState<PropertyType | undefined>();
  const [district, setDistrict] = useState<string | undefined>();
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBeds, setMinBeds] = useState<number | undefined>();

  const [areas, setAreas] = useState<PropertyArea[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Districts come from real inventory, never a hardcoded list — the same
  // source the Properties filter panel uses.
  useEffect(() => {
    getPropertyAreas()
      .then(setAreas)
      .catch(() => {});
  }, [t]);

  /**
   * When editing, seed the form from the saved alert. The list endpoint is
   * reused rather than adding a GET-by-id the app would call exactly once.
   */
  useEffect(() => {
    if (!isEditing || !token) return;

    let cancelled = false;
    getPropertyAlerts(token)
      .then((alerts) => {
        if (cancelled) return;
        const alert = alerts.find((a) => a._id === id);
        if (alert) {
          setListingType(alert.listingType);
          setPropertyType(alert.propertyType);
          setDistrict(alert.district);
          setMinPrice(alert.minPrice !== undefined ? String(alert.minPrice) : '');
          setMaxPrice(alert.maxPrice !== undefined ? String(alert.maxPrice) : '');
          setMinBeds(alert.minBeds);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEditing, id, token]);

  const min = minPrice ? Number(minPrice) : undefined;
  const max = maxPrice ? Number(maxPrice) : undefined;

  const priceInvalid = min !== undefined && max !== undefined && min > max;

  // Mirrors the backend rule: an alert with no criteria would match every
  // property, i.e. duplicate the All New feed.
  const hasCriteria =
    listingType !== undefined ||
    propertyType !== undefined ||
    district !== undefined ||
    min !== undefined ||
    max !== undefined ||
    minBeds !== undefined;

  const handleSave = useCallback(async () => {
    if (!token || saving || priceInvalid || !hasCriteria) return;

    setSaving(true);
    setErrorMessage('');

    // Every criterion is sent, including the undefined ones — PATCH clears
    // whatever is omitted, so this is what makes removing a filter work.
    const input: PropertyAlertInput = {
      listingType,
      propertyType,
      district,
      minPrice: min,
      maxPrice: max,
      minBeds,
    };

    try {
      if (isEditing && id) await updatePropertyAlert(token, id, input);
      else await createPropertyAlert(token, input);

      // `back()` returns to the alerts list, which reloads on focus.
      if (router.canGoBack()) router.back();
      else router.replace('/notifications/alerts');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : t('alerts.saveFailed')
      );
      setSaving(false);
    }
    // `t` is listed because the catch block builds user-facing copy.
  }, [
    token, saving, priceInvalid, hasCriteria, listingType, propertyType,
    district, min, max, minBeds, isEditing, id, router, t,
  ]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/notifications/alerts');
  };

  const onPriceChange = (setter: (v: string) => void) => (text: string) =>
    setter(text.replace(/[^0-9]/g, ''));

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
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Alert' : 'New Alert'}</Text>
      </View>

      {status !== 'authenticated' ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>{t('alerts.signInToSave')}</Text>
          <Button
            label={t('common.signIn')}
            variant="primary"
            onPress={() => router.push('/login')}
            style={styles.stretch}
          />
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGreen} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              Choose what you&apos;re looking for. We&apos;ll highlight new listings that match.
            </Text>

            <Section title={t('alerts.listingType')}>
              <View style={styles.chips}>
                <Chip
                  label={t('alerts.any')}
                  selected={listingType === undefined}
                  onPress={() => setListingType(undefined)}
                />
                <Chip
                  label={t('properties.forSale')}
                  selected={listingType === 'Sale'}
                  onPress={() => setListingType('Sale')}
                />
                <Chip
                  label={t('properties.forRent')}
                  selected={listingType === 'Rent'}
                  onPress={() => setListingType('Rent')}
                />
              </View>
            </Section>

            <Section title={t('alerts.district')}>
              <View style={styles.chips}>
                <Chip
                  label={t('alerts.anyDistrict')}
                  selected={district === undefined}
                  onPress={() => setDistrict(undefined)}
                />
                {areas.map((area) => (
                  <Chip
                    key={area.district}
                    label={area.district}
                    selected={district === area.district}
                    onPress={() => setDistrict(area.district)}
                  />
                ))}
              </View>
            </Section>

            <Section title="Property Type">
              <View style={styles.chips}>
                <Chip
                  label={t('alerts.anyType')}
                  selected={propertyType === undefined}
                  onPress={() => setPropertyType(undefined)}
                />
                {PROPERTY_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    selected={propertyType === type}
                    onPress={() => setPropertyType(type)}
                  />
                ))}
              </View>
            </Section>

            <Section title="Price">
              {/* All stored prices are TRY, so the ₺ prefixes state the unit. */}
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={styles.pricePrefix}>₺</Text>
                  <TextInput
                    value={minPrice}
                    onChangeText={onPriceChange(setMinPrice)}
                    placeholder={t('filters.min')}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    style={styles.priceInput}
                    accessibilityLabel={t('filters.minPrice')}
                  />
                </View>
                <View style={styles.priceField}>
                  <Text style={styles.pricePrefix}>₺</Text>
                  <TextInput
                    value={maxPrice}
                    onChangeText={onPriceChange(setMaxPrice)}
                    placeholder={t('filters.max')}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    style={styles.priceInput}
                    accessibilityLabel={t('filters.maxPrice')}
                  />
                </View>
              </View>
              {priceInvalid ? (
                <Text style={styles.validation}>
                  Minimum price cannot be higher than maximum.
                </Text>
              ) : null}
            </Section>

            <Section title="Minimum Bedrooms">
              <View style={styles.chips}>
                <Chip
                  label={t('alerts.any')}
                  selected={minBeds === undefined}
                  onPress={() => setMinBeds(undefined)}
                />
                {BED_OPTIONS.map((count) => (
                  <Chip
                    key={count}
                    label={`${count}+`}
                    selected={minBeds === count}
                    onPress={() => setMinBeds(count)}
                  />
                ))}
              </View>
            </Section>

            {errorMessage ? <Text style={styles.validation}>{errorMessage}</Text> : null}

            {!hasCriteria ? (
              <Text style={styles.hint}>{t('alerts.needOneFilter')}</Text>
            ) : null}

            <Button
              label={isEditing ? 'Save Changes' : 'Save Alert'}
              variant="primary"
              onPress={handleSave}
              loading={saving}
              loadingLabel="Saving..."
              disabled={priceInvalid || !hasCriteria}
              style={styles.save}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  flex: { flex: 1 },
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
  },

  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  intro: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
  },

  section: { marginTop: Spacing.lg },
  sectionTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginBottom: Spacing.sm,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: theme.brandGreen, borderColor: theme.brandGreen },
  chipText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.charcoal,
  },
  chipTextSelected: { fontFamily: FontFamily.bodySemiBold, color: theme.primaryText },

  priceRow: { flexDirection: 'row', gap: Spacing.sm },
  priceField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    backgroundColor: theme.cardBg,
    paddingHorizontal: Spacing.md,
  },
  pricePrefix: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    color: theme.textMuted,
  },
  priceInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.md,
    color: theme.text,
    paddingVertical: Spacing.md,
  },
  validation: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.danger,
    marginTop: Spacing.sm,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    marginTop: Spacing.lg,
  },
  save: { marginTop: Spacing.lg },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  stateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.charcoal,
    textAlign: 'center',
  },
  stretch: { alignSelf: 'stretch', marginTop: Spacing.md },
});
