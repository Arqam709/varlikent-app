import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * WHAT A VISITOR WHO IS NOT SIGNED IN SEES, on every Design My Space screen.
 *
 *   restoring  the stored session is still being checked → a spinner only;
 *              the visitor is neither prompted to sign in nor shown anything
 *   otherwise  a full screen-level gate rather than a redirect, exactly like
 *              Favourites: the user deliberately opened this feature, so
 *              bouncing them to Login would hide what they asked for
 *
 * It offers no board, palette, photo or storage of any kind.
 */
export default function DesignMySpaceGate({
  restoring,
  onBack,
}: {
  restoring: boolean;
  onBack: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('designMySpace.title')} onBack={onBack} />

      {restoring ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primaryInk} />
        </View>
      ) : (
        <View style={styles.centered}>
          <View style={styles.gateIcon}>
            <Ionicons name="color-palette-outline" size={28} color={theme.primaryInk} />
          </View>
          <Text style={styles.gateEyebrow}>{t('designMySpace.entryEyebrow')}</Text>
          <Text style={styles.gateHeading} accessibilityRole="header">
            {t('designMySpace.gateTitle')}
          </Text>
          <Text style={styles.gateBody}>{t('designMySpace.gateDescription')}</Text>

          <Button
            label={t('common.signIn')}
            variant="primary"
            onPress={() => router.push('/login')}
            style={styles.gateAction}
          />
          <Button
            label={t('common.createAccount')}
            variant="secondary"
            onPress={() => router.push('/register')}
            style={styles.gateActionTight}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  gateIcon: {
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
    color: theme.primaryInk,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  gateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.text,
    textAlign: 'center',
  },
  gateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    textAlign: 'center',
  },
  gateAction: { alignSelf: 'stretch', marginTop: Spacing.md },
  gateActionTight: { alignSelf: 'stretch', marginTop: Spacing.sm },
});
