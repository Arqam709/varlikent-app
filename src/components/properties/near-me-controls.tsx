import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { NEAR_ME_RADII_KM, type NearMeRadiusKm } from '@/utils/near-me';

export function NearMeButton({
  active,
  busy,
  radiusKm,
  onPress,
}: {
  active: boolean;
  /** A position is being acquired — the first tap can take a second or two. */
  busy: boolean;
  /** Only meaningful while active; used for the accessibility label. */
  radiusKm: NearMeRadiusKm;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row } = useDirection();

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      /*
        The label states the CURRENT state and what pressing does, because a
        toggle whose label only names itself leaves a screen-reader user unable
        to tell whether they are about to switch it on or off.
      */
      accessibilityState={{ selected: active, busy, disabled: busy }}
      accessibilityLabel={
        active
          ? t('propertiesMap.nearMeActiveAccessibility', { km: String(radiusKm) })
          : t('propertiesMap.nearMeAccessibility')
      }
      style={[styles.pill, { flexDirection: row }, active && styles.pillActive]}>
      <Ionicons
        name={active ? 'location' : 'location-outline'}
        size={16}
        color={active ? theme.primaryText : theme.textMuted}
      />
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {t('propertiesMap.nearMe')}
      </Text>
    </Pressable>
  );
}

/* ─────────────────────────── Radius pill ─────────────────────────── */

export function RadiusButton({
  radiusKm,
  onPress,
}: {
  radiusKm: NearMeRadiusKm;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row } = useDirection();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('propertiesMap.radiusAccessibility', { km: String(radiusKm) })}
      style={[styles.pill, { flexDirection: row }]}>
      <Text style={styles.pillText}>
        {t('propertiesMap.radiusValue', { km: String(radiusKm) })}
      </Text>
      <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
    </Pressable>
  );
}

/* ─────────────────────────── Recenter ─────────────────────────── */

export function RecenterButton({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('propertiesMap.recenterAccessibility')}
      style={styles.recenter}>

      <Ionicons name="locate" size={20} color={theme.primaryInk} />
    </Pressable>
  );
}

/* ─────────────────────────── Radius selector ─────────────────────────── */

export function RadiusSheet({
  visible,
  radiusKm,
  onSelect,
  onClose,
}: {
  visible: boolean;
  radiusKm: NearMeRadiusKm;
  onSelect: (next: NearMeRadiusKm) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign } = useDirection();

  return (
    // Same construction as the filter panel: React Native's own Modal, slide
    // animation, tap-the-backdrop to dismiss. No sheet library, and no second
    // sheet idiom for the customer to learn.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View style={styles.sheet}>
          <View style={[styles.sheetHeader, { flexDirection: row }]}>
            <Text style={[styles.sheetTitle, { textAlign }]}>
              {t('propertiesMap.radiusTitle')}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          {NEAR_ME_RADII_KM.map((option) => {
            const selected = option === radiusKm;

            return (
              <Pressable
                key={option}
                onPress={() => onSelect(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('propertiesMap.radiusOptionAccessibility', {
                  km: String(option),
                })}
                style={[styles.option, { flexDirection: row }, selected && styles.optionSelected]}>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {t('propertiesMap.radiusValue', { km: String(option) })}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={18} color={theme.primaryInk} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    /*
      Floating chrome sits ON live map tiles rather than a flat ground, so each
      control carries its own elevation and border. Without them a pale pill
      disappears over a pale road.
    */
    pill: {
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      minHeight: 38,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      elevation: 3,
      shadowColor: theme.charcoal,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    /** Filled brand green while active — unmistakable against the map. */
    pillActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    pillText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: FontSizes.sm,
      color: theme.textMuted,
    },
    pillTextActive: {
      fontFamily: FontFamily.bodySemiBold,
      color: theme.primaryText,
    },

    recenter: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      elevation: 3,
      shadowColor: theme.charcoal,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },

    backdropWrap: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,30,28,0.45)' },
    sheet: {
      backgroundColor: theme.softWhite,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingBottom: Spacing.xl,
    },
    sheetHeader: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sheetTitle: {
      flex: 1,
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.lg,
      color: theme.text,
    },

    option: {
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      minHeight: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    optionSelected: { borderColor: theme.brandGreen },
    optionText: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.md,
      color: theme.text,
    },
    /* ── Empty-radius fallback card and banner ── */
    /** Floats over live tiles like the preview card, so it carries the same lift. */
    card: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      padding: Spacing.md,
      gap: Spacing.xs,
      elevation: 4,
      shadowColor: theme.charcoal,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    cardHeading: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.sm,
      color: theme.text,
    },
    cardBody: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      color: theme.textMuted,
    },
    /**
     * Subordinate to the true distance above it: this explains the gap, it is
     * not the headline. Same size as cardBody, tinted to read as a caveat.
     */
    cardOutsideBy: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      color: theme.accentText,
    },
    cardAction: {
      marginTop: Spacing.xs,
      minHeight: 40,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    cardActionPressed: { opacity: 0.9 },
    cardActionLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.sm,
      color: theme.primaryText,
    },

    /** Narrower than the card: one honest sentence, not a panel. */
    banner: {
      alignSelf: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      opacity: 0.97,
    },
    bannerText: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      color: theme.textMuted,
    },

    optionTextSelected: {
      fontFamily: FontFamily.bodySemiBold,
      color: theme.primaryInk,
    },
  });

export function NearMeEmptyRadiusCard({
  radiusKm,
  /** Display-ready distance to the nearest property OUTSIDE the radius. */
  closestDistanceLabel,
  closestOutsideByLabel,
  onShowClosest,
}: {
  radiusKm: NearMeRadiusKm;
  closestDistanceLabel: string | null;
  /**
   * How far past the radius that property sits, display-ready — or null when
   * there is nothing to say.
   *
   * Carried separately from `closestDistanceLabel` rather than derived here
   * because both numbers come from the same unrounded measurement, and this
   * component does no arithmetic. Subtracting formatted strings is not
   * possible, and re-deriving from a rounded one would drift.
   */
  closestOutsideByLabel: string | null;
  onShowClosest: () => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();

  return (
    <View style={styles.card}>
      <Text style={[styles.cardHeading, { textAlign }]}>
        {t('propertiesMap.noneNearby', { km: String(radiusKm) })}
      </Text>

      {closestDistanceLabel ? (
        <>
          <Text style={[styles.cardBody, { textAlign }]}>
            {t('propertiesMap.closestProperty', { distance: closestDistanceLabel })}
          </Text>

          {/*
            The line that actually MOVES when the radius changes.

            The sentence above is a fact about the property and stays at 12.9
            whether the radius is 1, 5 or 10 km — correct, but it makes the
            radius selector look broken, because the customer changes a setting
            and the number they are reading does not budge. This one answers the
            other question: how much would the search have to widen.

            Muted and one line, so the card gains a fact rather than height.
          */}
          {closestOutsideByLabel ? (
            <Text style={[styles.cardOutsideBy, { textAlign }]}>
              {t('propertiesMap.outsideRadiusBy', { distance: closestOutsideByLabel })}
            </Text>
          ) : null}

          <Pressable
            onPress={onShowClosest}
            accessibilityRole="button"
            accessibilityLabel={t('propertiesMap.showClosestAccessibility', {
              km: String(radiusKm),
            })}
            style={({ pressed }) => [styles.cardAction, pressed && styles.cardActionPressed]}>
            <Text style={styles.cardActionLabel}>{t('propertiesMap.showClosest')}</Text>
          </Pressable>
        </>
      ) : (
        /*
          Nothing else is mappable at all, so there is no fallback to offer and
          no action to show — a "Show closest" button that reveals nothing would
          be worse than its absence.

          The wording stays vague about WHY: naming how many listings are
          private would leak exactly what the approximate setting protects.
        */
        <Text style={[styles.cardBody, { textAlign }]}>
          {t('propertiesMap.noOtherMappedProperties')}
        </Text>
      )}
    </View>
  );
}

/**
 * The banner shown while out-of-radius properties are on screen.
 *
 * Not optional decoration. Without it the map would show markers immediately
 * after saying "no properties within 5 km", which reads as a contradiction or a
 * bug. This line is what makes the fallback honest: the radius is unchanged and
 * still selected, and these pins are explicitly outside it.
 */
export function NearMeFallbackBanner({ radiusKm }: { radiusKm: NearMeRadiusKm }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { textAlign } = useDirection();

  return (
    <View style={styles.banner} accessibilityRole="text">
      <Text style={[styles.bannerText, { textAlign }]}>
        {t('propertiesMap.showingClosest', { km: String(radiusKm) })}
      </Text>
    </View>
  );
}
