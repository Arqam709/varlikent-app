import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { initialsOf } from '@/features/account/account-api';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <View style={staticStyles.section}>
      <Text
        style={[
          staticStyles.sectionTitle,
          { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
        ]}>
        {title}
      </Text>
      <View
        style={[
          staticStyles.sectionBody,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        {children}
      </View>
    </View>
  );
}

/* ── Row ──────────────────────────────────────────────────────────────── */

export function SettingsRow({
  label,
  icon,
  value,
  onPress,
  isLast = false,
  destructive = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Optional trailing text, e.g. the current language on the Language row. */
  value?: string;
  onPress: () => void;
  isLast?: boolean;
  destructive?: boolean;
}) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  const tint = destructive ? theme.danger : theme.text;
  const iconTint = destructive ? theme.danger : theme.primaryInk;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [
        staticStyles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.marble },
      ]}>
      <Ionicons name={icon} size={20} color={iconTint} />

      <Text
        style={[
          staticStyles.rowLabel,
          { color: tint, textAlign: isRTL ? 'right' : 'left' },
        ]}
        numberOfLines={1}>
        {label}
      </Text>

      {value ? (
        <Text style={[staticStyles.rowValue, { color: theme.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {/* Points the way navigation actually goes, which is left in Arabic. */}
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={theme.textMuted}
      />
    </Pressable>
  );
}

/* ── Profile header ───────────────────────────────────────────────────── */

export function ProfileHeader({
  name,
  email,
  avatar,
  roleLabel,
  onPress,
}: {
  name: string;
  email: string;
  avatar?: string;
  roleLabel: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  const body = (
    <View
      style={[
        staticStyles.profileCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}>
      <View style={[staticStyles.avatar, { backgroundColor: theme.primary }]}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={staticStyles.avatarImage}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`${name} profile photo`}
          />
        ) : (
          <Text style={[staticStyles.avatarInitials, { color: theme.primaryText }]}>
            {initialsOf(name, email)}
          </Text>
        )}
      </View>

      <View style={staticStyles.profileText}>
        <Text
          style={[staticStyles.profileName, { color: theme.text, textAlign: isRTL ? 'right' : 'left' }]}
          numberOfLines={1}>
          {name}
        </Text>
        <Text
          style={[
            staticStyles.profileEmail,
            { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}>
          {email}
        </Text>
        <View
          style={[
            staticStyles.badge,
            { backgroundColor: theme.marble, borderColor: theme.border },
          ]}>
          <Text style={[staticStyles.badgeText, { color: theme.primaryInk }]}>{roleLabel}</Text>
        </View>
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
      {body}
    </Pressable>
  );
}

/* ── Screen chrome shared by every account detail screen ──────────────── */

export function AccountHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { theme } = useTheme();
  const { isRTL, t } = useLanguage();

  return (
    <View
      style={[
        staticStyles.header,
        { borderBottomColor: theme.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={10}
        style={staticStyles.backButton}>
        <Ionicons
          name={isRTL ? 'chevron-forward' : 'chevron-back'}
          size={22}
          color={theme.text}
        />
      </Pressable>
      <Text
        style={[
          staticStyles.headerTitle,
          { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
        ]}
        numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}


export function ScreenIntro({ text }: { text: string }) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <Text
      style={[
        staticStyles.intro,
        { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
      ]}>
      {text}
    </Text>
  );
}

/** Inline success / error feedback. Colour carries meaning, text carries detail. */
export function StatusMessage({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <Text
      accessibilityRole="alert"
      style={[
        staticStyles.status,
        {
          color: tone === 'success' ? theme.success : theme.danger,
          textAlign: isRTL ? 'right' : 'left',
        },
      ]}>
      {text}
    </Text>
  );
}

/** Selection control shared by the Language and Appearance screens. */
export function SelectionIndicator({ selected }: { selected: boolean }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        staticStyles.radioOuter,
        // textMuted, not border: an unselected radio must stay visible, and
        // the hairline border token measures ~1.4:1 on the dark surface.
        { borderColor: selected ? theme.primaryInk : theme.textMuted },
      ]}>
      {selected ? (
        <View style={[staticStyles.radioInner, { backgroundColor: theme.primaryInk }]} />
      ) : null}
    </View>
  );
}

/* ── Layout-only styles (never theme colours) ─────────────────────────── */

const staticStyles = StyleSheet.create({
  section: { marginTop: Spacing.lg },
  sectionTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionBody: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },

  row: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    // 56 keeps every row above the 44pt minimum touch target with room to spare.
    minHeight: 56,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
  },
  rowValue: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    maxWidth: '40%',
  },

  profileCard: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.lg,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
  },
  profileEmail: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
  },

  header: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
  },

  intro: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  status: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.xs,
    marginTop: Spacing.sm,
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 11, height: 11, borderRadius: Radius.full },
});

export { staticStyles as accountStyles };
export type { ThemePalette };

