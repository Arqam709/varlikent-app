import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import type { PropertySecondaryFilters } from '@/features/properties/properties-api';
import type { PropertyArea, PropertyType } from '@/types/property';

/**
 * PROPERTY FILTER PANEL
 *
 * A bottom sheet built from React Native's own <Modal> — no sheet library.
 *
 * ── Draft vs applied ─────────────────────────────────────────────────────
 * Everything edited here is DRAFT state, local to this component. Nothing
 * leaves until "Apply Filters" is pressed, so tapping five options fires zero
 * requests instead of five. Closing without applying discards the draft and
 * leaves the results untouched; reopening starts again from whatever is
 * currently applied, never from an abandoned edit.
 */

/**
 * The full backend enum from models/Property.js, not the types present in
 * today's inventory. Deriving from live data would make the available choices
 * shrink as other filters narrow the list, which is exactly the trap of
 * building options out of filtered results.
 */
const PROPERTY_TYPES: PropertyType[] = [
  'Apartment',
  'Villa',
  'Penthouse',
  'Duplex',
  'Studio',
  'Office',
  'Commercial',
  'Land',
  'Shop',
  'Warehouse',
  'Hotel',
  'Farm',
];

/**
 * The backend matches bedrooms EXACTLY (`filter.beds = Number(beds)`), so
 * these are exact counts — deliberately not "3+", which the API cannot honour.
 */
const BED_OPTIONS = [1, 2, 3, 4, 5, 6];

export type AreasState = 'loading' | 'success' | 'error';

type Props = {
  visible: boolean;
  /** The currently APPLIED filters — the draft starts from these on open. */
  initialFilters: PropertySecondaryFilters;
  areas: PropertyArea[];
  areasState: AreasState;
  onRetryAreas: () => void;
  onApply: (filters: PropertySecondaryFilters) => void;
  onClose: () => void;
};

/** Prices are entered as text so the field can be emptied; parsed on apply. */
type Draft = {
  district?: string;
  propertyType?: PropertyType;
  beds?: number;
  minPrice: string;
  maxPrice: string;
};

function toDraft(filters: PropertySecondaryFilters): Draft {
  return {
    district: filters.district,
    propertyType: filters.propertyType,
    beds: filters.beds,
    minPrice: filters.minPrice !== undefined ? String(filters.minPrice) : '',
    maxPrice: filters.maxPrice !== undefined ? String(filters.maxPrice) : '',
  };
}

const EMPTY_DRAFT: Draft = { minPrice: '', maxPrice: '' };

export default function PropertyFilterPanel({
  visible,
  initialFilters,
  areas,
  areasState,
  onRetryAreas,
  onApply,
  onClose,
}: Props) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialFilters));

  /**
   * Re-seed the draft each time the sheet opens. Depending on `visible` (not
   * on the filters object) means an abandoned edit is discarded rather than
   * lingering until the next apply.
   */
  useEffect(() => {
    if (visible) setDraft(toDraft(initialFilters));
    // initialFilters intentionally omitted: re-seeding mid-edit would fight
    // the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const min = draft.minPrice ? Number(draft.minPrice) : undefined;
  const max = draft.maxPrice ? Number(draft.maxPrice) : undefined;
  const priceInvalid = min !== undefined && max !== undefined && min > max;

  const handleApply = () => {
    if (priceInvalid) return;
    onApply({
      district: draft.district,
      propertyType: draft.propertyType,
      beds: draft.beds,
      minPrice: min,
      maxPrice: max,
    });
  };

  /** Clears the DRAFT only — the user still confirms with Apply. */
  const handleReset = () => setDraft(EMPTY_DRAFT);

  /** Digits only: blocks minus signs, decimals and stray characters at source. */
  const onPriceChange = (key: 'minPrice' | 'maxPrice') => (text: string) =>
    setDraft((d) => ({ ...d, [key]: text.replace(/[^0-9]/g, '') }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Android hardware back closes the sheet without applying.
      onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        {/* Tapping outside dismisses, matching the platform convention. */}
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('filters.close')}
        />

        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('filters.title')}</Text>
            <View style={styles.headerActions}>
              <Pressable onPress={handleReset} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.reset}>{t('filters.reset')}</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('filters.close')}
                hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* ── District ───────────────────────────────────────────── */}
            <Section title={t('filters.district')}>
              {areasState === 'loading' ? (
                <ActivityIndicator color={theme.primaryInk} style={styles.inlineLoader} />
              ) : areasState === 'error' ? (
                // A district failure never blocks the rest of the panel.
                <View style={styles.inlineError}>
                  <Text style={styles.inlineErrorText}>{t('filters.districtsUnavailable')}</Text>
                  <Pressable onPress={onRetryAreas} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.retryLink}>{t('filters.retry')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.chips}>
                  <Chip
                    label={t('filters.anyDistrict')}
                    selected={draft.district === undefined}
                    onPress={() => setDraft((d) => ({ ...d, district: undefined }))}
                  />
                  {areas.map((area) => (
                    <Chip
                      key={area.district}
                      label={area.district}
                      // Counts are informative, not the point — kept quiet.
                      badge={String(area.count)}
                      selected={draft.district === area.district}
                      onPress={() => setDraft((d) => ({ ...d, district: area.district }))}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* ── Property type ──────────────────────────────────────── */}
            <Section title={t('filters.propertyType')}>
              <View style={styles.chips}>
                <Chip
                  label={t('filters.anyType')}
                  selected={draft.propertyType === undefined}
                  onPress={() => setDraft((d) => ({ ...d, propertyType: undefined }))}
                />
                {PROPERTY_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    selected={draft.propertyType === type}
                    onPress={() => setDraft((d) => ({ ...d, propertyType: type }))}
                  />
                ))}
              </View>
            </Section>

            {/* ── Price ──────────────────────────────────────────────── */}
            <Section title={t('filters.price')}>
              {/*
                Every stored `price` is in Turkish Lira — verified across the
                inventory — so a numeric range is directly comparable. The ₺
                prefixes make the unit explicit, because a handful of listings
                DISPLAY their price in $ or € while being stored in TRY.
              */}
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={styles.pricePrefix}>₺</Text>
                  <TextInput
                    value={draft.minPrice}
                    onChangeText={onPriceChange('minPrice')}
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
                    value={draft.maxPrice}
                    onChangeText={onPriceChange('maxPrice')}
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

            {/* ── Bedrooms ───────────────────────────────────────────── */}
            <Section title={t('filters.bedrooms')}>
              <View style={styles.chips}>
                <Chip
                  label={t('filters.any')}
                  selected={draft.beds === undefined}
                  onPress={() => setDraft((d) => ({ ...d, beds: undefined }))}
                />
                {BED_OPTIONS.map((count) => (
                  <Chip
                    key={count}
                    label={String(count)}
                    selected={draft.beds === count}
                    onPress={() => setDraft((d) => ({ ...d, beds: count }))}
                  />
                ))}
              </View>
              <Text style={styles.hint}>{t('filters.exactBedrooms')}</Text>
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={t('filters.apply')}
              variant="primary"
              onPress={handleApply}
              disabled={priceInvalid}
            />
          </View>
        </View>
      </View>
    </Modal>
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
  badge,
  selected,
  onPress,
}: {
  label: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      // Announces "selected" rather than leaving the state to visual colour.
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {badge ? (
        <Text style={[styles.chipBadge, selected && styles.chipBadgeSelected]}>{badge}</Text>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,30,28,0.45)' },
  sheet: {
    // Caps the sheet so the list stays partly visible behind it.
    maxHeight: '88%',
    backgroundColor: theme.softWhite,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  reset: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: theme.primaryInk,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
    minHeight: 40,
  },
  chipSelected: { backgroundColor: theme.brandGreen, borderColor: theme.brandGreen },
  chipText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
  chipTextSelected: { fontFamily: FontFamily.bodySemiBold, color: theme.primaryText },
  chipBadge: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
  chipBadgeSelected: { color: 'rgba(255,255,255,0.75)' },

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
    marginTop: Spacing.sm,
  },

  inlineLoader: { alignSelf: 'flex-start' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inlineErrorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },
  retryLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: theme.primaryInk,
  },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
